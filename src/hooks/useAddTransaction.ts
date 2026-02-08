import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { Contact } from '@/types'
import { toast } from 'sonner'

interface AddTransactionParams {
    amount: number
    flow: 'IN' | 'OUT'
    mode: 'BUSINESS' | 'PERSONAL'
    contact_id?: string
    category_id?: string
    account_id?: string
    date: Date
    due_date?: Date
    description?: string
}

export function useAddTransaction() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { currentBusinessId } = useAppStore()

    return useMutation({
        mutationFn: async (newTransaction: AddTransactionParams) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            if (newTransaction.mode === 'BUSINESS' && !currentBusinessId) {
                throw new Error('No business selected')
            }

            const { data, error } = await supabase
                .from('transactions')
                .insert({
                    ...newTransaction,
                    user_id: user.id,
                    business_id: newTransaction.mode === 'BUSINESS' ? currentBusinessId : null,
                    date: newTransaction.date.toISOString(),
                    due_date: newTransaction.due_date?.toISOString(),
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onMutate: async (newTransaction) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['transactions'] })
            await queryClient.cancelQueries({ queryKey: ['contacts'] })
            await queryClient.cancelQueries({ queryKey: ['personal-transactions'] })
            await queryClient.cancelQueries({ queryKey: ['accounts'] })
            await queryClient.cancelQueries({ queryKey: ['budgets'] })

            // Snapshot the previous value
            const previousTransactions = queryClient.getQueryData(['transactions', newTransaction.contact_id || 'all'])
            const previousContacts = queryClient.getQueryData(['contacts'])

            // Optimistically update transactions (Business Mode)
            if (newTransaction.contact_id) {
                queryClient.setQueryData(['transactions', newTransaction.contact_id], (old: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const optimisticTransaction = {
                        id: 'temp-' + Date.now(),
                        ...newTransaction,
                        date: newTransaction.date.toISOString(),
                        contacts: { name: 'Loading...', phone: null },
                    }
                    if (!old) return { pages: [[optimisticTransaction]], pageParams: [0] }

                    const newPages = [...old.pages]
                    newPages[0] = [optimisticTransaction, ...newPages[0]]
                    return { ...old, pages: newPages }
                })
            }

            // Optimistically update contact balance
            if (newTransaction.contact_id && newTransaction.mode === 'BUSINESS') {
                queryClient.setQueryData(['contacts'], (old: Contact[] | undefined) => {
                    if (!old) return []
                    return old.map((contact) => {
                        if (contact.id === newTransaction.contact_id) {
                            const amountChange = newTransaction.flow === 'OUT' ? newTransaction.amount : -newTransaction.amount
                            return {
                                ...contact,
                                net_balance: contact.net_balance + amountChange,
                                last_transaction_at: newTransaction.date.toISOString(),
                            }
                        }
                        return contact
                    }).sort((a, b) => new Date(b.last_transaction_at).getTime() - new Date(a.last_transaction_at).getTime())
                })
            }

            return { previousTransactions, previousContacts }
        },
        onError: (err, newTransaction, context) => {
            toast.error('Failed to save transaction')
            if (context?.previousTransactions) {
                queryClient.setQueryData(
                    ['transactions', newTransaction.contact_id || 'all'],
                    context.previousTransactions
                )
            }
            if (context?.previousContacts) {
                queryClient.setQueryData(['contacts'], context.previousContacts)
            }
        },
        onSettled: () => {
            // Invalidate all relevant queries to ensure fresh data
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })
            queryClient.invalidateQueries({ queryKey: ['personal-transactions'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['analytics'] })

            toast.success('Transaction saved')
        },
    })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { Transaction } from './useTransactions'
import { Contact } from './useContacts'
import { toast } from 'sonner'

interface AddTransactionParams {
    amount: number
    flow: 'IN' | 'OUT'
    mode: 'BUSINESS' | 'PERSONAL'
    contact_id?: string
    category_id?: string
    date: Date
    description?: string
}

export function useAddTransaction() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (newTransaction: AddTransactionParams) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data, error } = await supabase
                .from('transactions')
                .insert({
                    ...newTransaction,
                    user_id: user.id,
                    date: newTransaction.date.toISOString(),
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

            // Snapshot the previous value
            const previousTransactions = queryClient.getQueryData(['transactions', newTransaction.contact_id || 'all'])
            const previousContacts = queryClient.getQueryData(['contacts'])

            // Optimistically update transactions
            if (newTransaction.contact_id) {
                queryClient.setQueryData(['transactions', newTransaction.contact_id], (old: any) => {
                    const optimisticTransaction = {
                        id: 'temp-' + Date.now(),
                        ...newTransaction,
                        date: newTransaction.date.toISOString(),
                        contacts: { name: 'Loading...', phone: null }, // We might need to fetch contact name or pass it
                    }
                    if (!old) return { pages: [[optimisticTransaction]], pageParams: [0] }

                    // Assuming infinite query structure
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
        onSettled: (data, error, variables) => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            if (!error) {
                toast.success('Transaction saved')
            }
        },
    })
}

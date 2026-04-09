import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { Contact, Paise, TransactionSplit } from '@/types'
import { rupeesToPaise } from '@/lib/currency'
import { toast } from 'sonner'

interface AddTransactionParams {
    amount: number
    flow: 'IN' | 'OUT'
    mode: 'BUSINESS' | 'PERSONAL'
    contact_id?: string
    category_id?: string
    account_id?: string
    group_id?: string
    payer_id?: string
    payer_group_member_id?: string
    split_type?: 'EQUALLY' | 'BY_AMOUNT' | 'BY_PERCENTAGE'
    date: Date
    due_date?: Date
    name: string
    note?: string
    splits?: Partial<TransactionSplit>[]
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

            // Convert amount from rupees (user input) to integer paise for DB storage
            const amountInPaise = rupeesToPaise(newTransaction.amount)

            // Prepare splits with amounts converted to paise
            const splitsPayload = newTransaction.splits && newTransaction.splits.length > 0
                ? newTransaction.splits.map(split => ({
                    user_id: split.user_id || null,
                    group_member_id: split.group_member_id || null,
                    amount: split.amount != null ? rupeesToPaise(split.amount as number) : 0,
                    percentage: split.percentage ?? null,
                    is_settled: split.is_settled || false,
                    member_name_snapshot: split.member_name_snapshot || null,
                }))
                : null

            // Single atomic RPC call — transaction + splits are inserted in one DB transaction
            const { data, error } = await supabase.rpc('add_transaction_with_splits', {
                p_user_id: user.id,
                p_business_id: newTransaction.mode === 'BUSINESS' ? currentBusinessId : null,
                p_amount: amountInPaise,
                p_flow: newTransaction.flow,
                p_mode: newTransaction.mode,
                p_name: newTransaction.name,
                p_note: newTransaction.note || null,
                p_date: newTransaction.date.toISOString(),
                p_due_date: newTransaction.due_date?.toISOString() || null,
                p_contact_id: newTransaction.contact_id || null,
                p_category_id: newTransaction.category_id || null,
                p_account_id: newTransaction.account_id || null,
                p_group_id: newTransaction.group_id || null,
                p_payer_id: newTransaction.payer_id || user.id,
                p_payer_group_member_id: newTransaction.payer_group_member_id || null,
                p_split_type: newTransaction.split_type || 'EQUALLY',
                p_splits: splitsPayload,
            })

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
                        name: newTransaction.name,
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
                                net_balance: (contact.net_balance + amountChange) as Paise,
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
            queryClient.invalidateQueries({ queryKey: ['groups'] }) // Invalidate groups too
            queryClient.invalidateQueries({ queryKey: ['group-balances'] })

            toast.success('Transaction saved')
        },
    })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { Contact, TransactionSplit } from '@/types'
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

            // 1. Insert Transaction
            const { data: transactionData, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    amount: newTransaction.amount,
                    flow: newTransaction.flow,
                    mode: newTransaction.mode,
                    contact_id: newTransaction.contact_id,
                    category_id: newTransaction.category_id,
                    account_id: newTransaction.account_id,
                    group_id: newTransaction.group_id,
                    payer_id: newTransaction.payer_id || user.id, // Default to current user if not specified
                    payer_group_member_id: newTransaction.payer_group_member_id || null,
                    split_type: newTransaction.split_type || 'EQUALLY',
                    name: newTransaction.name,
                    note: newTransaction.note,

                    user_id: user.id,
                    business_id: newTransaction.mode === 'BUSINESS' ? currentBusinessId : null,
                    date: newTransaction.date.toISOString(),
                    due_date: newTransaction.due_date?.toISOString(),
                })
                .select()
                .single()

            if (transactionError) throw transactionError

            // 2. Insert Splits (if any)
            if (newTransaction.splits && newTransaction.splits.length > 0) {
                const splitsToInsert = newTransaction.splits.map(split => ({
                    transaction_id: transactionData.id,
                    user_id: split.user_id, // Nullable
                    group_member_id: split.group_member_id, // Nullable
                    amount: split.amount,
                    percentage: split.percentage,
                    is_settled: split.is_settled || false,
                    member_name_snapshot: split.member_name_snapshot
                }))

                const { error: splitsError } = await supabase
                    .from('transaction_splits')
                    .insert(splitsToInsert)

                if (splitsError) {
                    // Ideally, rollback transaction here.
                    // For now, throw error.
                    console.error('Failed to insert splits:', splitsError)
                    throw new Error('Transaction created but failed to save splits. Please delete and try again.')
                }
            }

            return transactionData
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
            queryClient.invalidateQueries({ queryKey: ['groups'] }) // Invalidate groups too
            queryClient.invalidateQueries({ queryKey: ['group-balances'] })

            toast.success('Transaction saved')
        },
    })
}

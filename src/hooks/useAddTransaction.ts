import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { Contact, Paise } from '@/types'
import { rupeesToPaise, addPaise } from '@/lib/currency'
import { toast } from 'sonner'

/** Input shape for a single split — amounts are raw rupee values from the UI. */
interface SplitInput {
    user_id?: string | null
    group_member_id?: string | null
    amount?: number
    percentage?: number | null
    is_settled?: boolean
    member_name_snapshot?: string | null
}

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
    splits?: SplitInput[]
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
                    amount: split.amount != null ? rupeesToPaise(split.amount) : 0,
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
            // Cancel any outgoing refetches to avoid race conditions with our optimistic update
            await queryClient.cancelQueries({ queryKey: ['transactions'] })
            await queryClient.cancelQueries({ queryKey: ['contacts'] })
            await queryClient.cancelQueries({ queryKey: ['personal-people'] })
            await queryClient.cancelQueries({ queryKey: ['accounts'] })
            await queryClient.cancelQueries({ queryKey: ['budgets'] })

            // ─── Build the EXACT key shape that useTransactions uses ───────────────────
            // useTransactions normalises its filters to: { contactId, mode } or { groupId, mode }
            // We must mirror that exact object shape here so React Query matches the cache entry.
            const optimisticQueryKey = newTransaction.contact_id
                ? ['transactions', { contactId: newTransaction.contact_id, mode: newTransaction.mode }]
                : newTransaction.group_id
                ? ['transactions', { groupId: newTransaction.group_id, mode: newTransaction.mode }]
                : ['transactions', { mode: newTransaction.mode }]

            // Snapshot the previous values for rollback
            const previousTransactions = queryClient.getQueryData(optimisticQueryKey)
            const previousContacts = queryClient.getQueryData(['contacts'])

            // Optimistically prepend a fake transaction to the first page of the infinite query
            queryClient.setQueryData(optimisticQueryKey, (old: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const optimisticTransaction = {
                    id: `temp-${Date.now()}`,
                    ...newTransaction,
                    // amount is already in Paise from useAddTransaction's mutationFn conversion.
                    // For the optimistic entry we must store the Paise value, not the raw rupee input.
                    date: newTransaction.date.toISOString(),
                    contacts: null,
                    payer: null,
                    group: null,
                    splits: [],
                }
                if (!old) return { pages: [[optimisticTransaction]], pageParams: [0] }
                const newPages = old.pages.map((page: any[], index: number) => // eslint-disable-line @typescript-eslint/no-explicit-any
                    index === 0 ? [optimisticTransaction, ...page] : page
                )
                return { ...old, pages: newPages }
            })

            // Optimistically update the contact's net_balance in the contacts list cache.
            // All values here are Paise — use addPaise from currency.ts.
            if (newTransaction.contact_id && newTransaction.mode === 'BUSINESS') {
                queryClient.setQueryData(['contacts'], (old: Contact[] | undefined) => {
                    if (!old) return []
                    return old
                        .map((contact) => {
                            if (contact.id !== newTransaction.contact_id) return contact
                            // OUT = you gave = owed to you increases (+)
                            // IN  = you got  = owed to you decreases (-)
                            const delta = newTransaction.flow === 'OUT'
                                ? newTransaction.amount   // already Paise
                                : -newTransaction.amount
                            return {
                                ...contact,
                                net_balance: addPaise(contact.net_balance, delta) as Paise,
                                last_transaction_at: newTransaction.date.toISOString(),
                            }
                        })
                        .sort(
                            (a, b) =>
                                new Date(b.last_transaction_at).getTime() -
                                new Date(a.last_transaction_at).getTime()
                        )
                })
            }

            // Return context for rollback in onError
            return { previousTransactions, previousContacts, optimisticQueryKey }
        },
        onError: (_err, _newTransaction, context) => {
            // Roll back to the snapshot values using the same corrected key
            if (context?.previousTransactions !== undefined) {
                queryClient.setQueryData(context.optimisticQueryKey, context.previousTransactions)
            }
            if (context?.previousContacts !== undefined) {
                queryClient.setQueryData(['contacts'], context.previousContacts)
            }
            toast.error('Failed to save transaction. Please check your connection and try again.')
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
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            queryClient.invalidateQueries({ queryKey: ['group-balances'] })
            // Note: toast is shown by the calling component (BusinessTransactionDrawer,
            // PersonalTransactionDrawer, SplitExpenseDrawer, etc.) — NOT here.
        },
    })
}

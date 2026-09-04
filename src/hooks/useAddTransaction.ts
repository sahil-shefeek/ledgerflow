import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTransactionAction } from '@/lib/actions/transactions'
import { useAppStore } from '@/store/useAppStore'
import { Contact, Paise } from '@/types'
import { rupeesToPaise, addPaise, getSignedFlowDelta } from '@/lib/currency'
import { toast } from '@/components/ui/toast'

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
    contact_id?: string | null
    category_id?: string | null
    account_id?: string | null
    group_id?: string | null
    payer_id?: string | null
    payer_group_member_id?: string | null
    split_type?: 'EQUALLY' | 'BY_AMOUNT' | 'BY_PERCENTAGE'
    date: Date
    due_date?: Date | null
    name: string
    note?: string | null
    splits?: SplitInput[] | null
}

export function useAddTransaction() {
    const queryClient = useQueryClient()
    const { currentBusinessId } = useAppStore()

    return useMutation({
        mutationFn: async (newTransaction: AddTransactionParams) => {
            if (newTransaction.mode === 'BUSINESS' && !currentBusinessId) {
                throw new Error('No business selected')
            }

            const amountInPaise = rupeesToPaise(newTransaction.amount)

            const splitsPayload = newTransaction.splits && newTransaction.splits.length > 0
                ? newTransaction.splits.map(split => ({
                    userId: split.user_id || null,
                    groupMemberId: split.group_member_id || null,
                    amount: split.amount != null ? rupeesToPaise(split.amount) : 0,
                    percentage: split.percentage ?? null,
                    isSettled: split.is_settled || false,
                    memberNameSnapshot: split.member_name_snapshot || null,
                }))
                : null

            const result = await createTransactionAction({
                amount: amountInPaise,
                flow: newTransaction.flow,
                mode: newTransaction.mode,
                name: newTransaction.name,
                note: newTransaction.note || null,
                date: newTransaction.date,
                dueDate: newTransaction.due_date || null,
                contactId: newTransaction.contact_id || null,
                categoryId: newTransaction.category_id || null,
                accountId: newTransaction.account_id || null,
                businessId: newTransaction.mode === 'BUSINESS' ? currentBusinessId : null,
                groupId: newTransaction.group_id || null,
                payerId: newTransaction.payer_id || null,
                payerGroupMemberId: newTransaction.payer_group_member_id || null,
                splitType: newTransaction.split_type || 'EQUALLY',
                splits: splitsPayload,
            })
            
            if (result && 'error' in result && result.error === 'ONBOARDING_REQUIRED') {
                throw new Error(`ONBOARDING_REQUIRED:${result.onboardingMode}`);
            }
            
            return result
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
            const previousPersonalPeople = queryClient.getQueryData(['personal-people'])

            // Optimistically prepend a fake transaction to the first page of the infinite query
            queryClient.setQueryData(optimisticQueryKey, (old: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const optimisticTransaction = {
                    id: `temp-${Date.now()}`,
                    ...newTransaction,
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

            // Optimistically update the contact's net_balance in the list cache.
            if (newTransaction.contact_id) {
                const delta = getSignedFlowDelta(newTransaction.flow, newTransaction.amount)
                
                const updateContactFn = (old: Contact[] | undefined) => {
                    if (!old) return []
                    return old
                        .map((contact) => {
                            if (contact.id !== newTransaction.contact_id) return contact
                            return {
                                ...contact,
                                net_balance: addPaise(contact.net_balance, delta) as Paise,
                                last_transaction_at: newTransaction.date.toISOString(),
                            }
                        })
                        .sort(
                            (a, b) =>
                                new Date(b.last_transaction_at ?? 0).getTime() -
                                new Date(a.last_transaction_at ?? 0).getTime()
                        )
                }

                if (newTransaction.mode === 'BUSINESS') {
                    queryClient.setQueryData(['contacts'], updateContactFn)
                } else if (newTransaction.mode === 'PERSONAL') {
                    // Update all query variations of personal-people
                    queryClient.setQueriesData({ queryKey: ['personal-people'] }, updateContactFn)
                }
            }

            // Return context for rollback in onError
            return { previousTransactions, previousContacts, previousPersonalPeople, optimisticQueryKey }
        },
        onError: (err: any, _newTransaction, context) => {
            // Roll back to the snapshot values
            if (context?.previousTransactions !== undefined) {
                queryClient.setQueryData(context.optimisticQueryKey, context.previousTransactions)
            }
            if (context?.previousContacts !== undefined) {
                queryClient.setQueryData(['contacts'], context.previousContacts)
            }
            if (context?.previousPersonalPeople !== undefined) {
                queryClient.setQueryData(['personal-people'], context.previousPersonalPeople)
            }
            
            if (err.message?.startsWith('ONBOARDING_REQUIRED:')) {
                const mode = err.message.split(':')[1]
                toast.error(`Please complete ${mode} setup first to add transactions.`)
            } else {
                toast.error('Failed to save transaction. Please check your connection and try again.')
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
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            queryClient.invalidateQueries({ queryKey: ['group-balances'] })
            // Note: toast is shown by the calling component (BusinessTransactionDrawer,
            // PersonalTransactionDrawer, SplitExpenseDrawer, etc.) — NOT here.
        },
    })
}

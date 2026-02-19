import { useInfiniteQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Transaction } from '@/types'

const PAGE_SIZE = 20

export type TransactionFilters = {
    contactId?: string
    groupId?: string
    mode?: 'BUSINESS' | 'PERSONAL'
}

export function useTransactions(filters?: TransactionFilters | string, mode: 'BUSINESS' | 'PERSONAL' = 'BUSINESS') {
    const supabase = createClient()

    // Handle legacy signature support: useTransactions(contactId, mode)
    const normalizedFilters: TransactionFilters = typeof filters === 'string'
        ? { contactId: filters, mode }
        : { mode, ...filters }

    return useInfiniteQuery({
        queryKey: ['transactions', normalizedFilters],
        queryFn: async ({ pageParam = 0 }) => {
            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    contacts(name, phone),
                    payer:profiles!payer_id(full_name, avatar_url),
                    group:groups(id, name),
                    splits:transaction_splits(user_id, amount, group_member_id, member_name_snapshot)
                `)
                .order('date', { ascending: false })
                .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

            if (normalizedFilters.contactId) {
                query = query.eq('contact_id', normalizedFilters.contactId)
            } else if (normalizedFilters.groupId) {
                query = query.eq('group_id', normalizedFilters.groupId)
            } else {
                query = query.eq('mode', normalizedFilters.mode!)
            }

            const { data, error } = await query

            if (error) throw error
            return data as Transaction[]
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === PAGE_SIZE ? allPages.length : undefined
        },
    })
}

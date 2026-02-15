import { useInfiniteQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Transaction } from '@/types'

const PAGE_SIZE = 20

export function useTransactions(contactId?: string, mode: 'BUSINESS' | 'PERSONAL' = 'BUSINESS') {
    const supabase = createClient()

    return useInfiniteQuery({
        queryKey: ['transactions', contactId || 'all', mode],
        queryFn: async ({ pageParam = 0 }) => {
            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    contacts(name, phone),
                    payer:profiles!payer_id(full_name, avatar_url),
                    group:groups(id, name),
                    splits:transaction_splits(user_id, amount, group_member_id)
                `)
                .order('date', { ascending: false })
                .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

            if (contactId) {
                query = query.eq('contact_id', contactId)
            } else {
                query = query.eq('mode', mode)
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

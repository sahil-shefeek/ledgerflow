import { useInfiniteQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'

export interface Transaction {
    id: string
    amount: number
    flow: 'IN' | 'OUT'
    mode: 'BUSINESS' | 'PERSONAL'
    date: string
    description: string | null
    contact_id: string | null
    contacts?: {
        name: string
        phone: string | null
    }
}

const PAGE_SIZE = 20

export function useTransactions(contactId?: string) {
    const supabase = createClient()

    return useInfiniteQuery({
        queryKey: ['transactions', contactId || 'all'],
        queryFn: async ({ pageParam = 0 }) => {
            let query = supabase
                .from('transactions')
                .select('*, contacts(name, phone)')
                .order('date', { ascending: false })
                .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

            if (contactId) {
                query = query.eq('contact_id', contactId)
            } else {
                // Only show BUSINESS transactions in the main list if not filtering by contact?
                // Or maybe show all? SRS says: "Single Source of Truth".
                // Usually Ledger view shows Business transactions.
                query = query.eq('mode', 'BUSINESS')
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

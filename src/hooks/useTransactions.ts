import { useInfiniteQuery } from '@tanstack/react-query'
import { getTransactionsAction } from '@/lib/actions/transactions'
import { TransactionWithJoins } from '@/types'

const PAGE_SIZE = 20

export type TransactionFilters = {
    contactId?: string
    groupId?: string
    mode?: 'BUSINESS' | 'PERSONAL'
}

export function useTransactions(filters?: TransactionFilters | string, mode: 'BUSINESS' | 'PERSONAL' = 'BUSINESS') {
    // Handle legacy signature support: useTransactions(contactId, mode)
    const normalizedFilters: TransactionFilters = typeof filters === 'string'
        ? { contactId: filters, mode }
        : { mode, ...filters }

    return useInfiniteQuery({
        queryKey: ['transactions', normalizedFilters],
        queryFn: async ({ pageParam = 0 }) => {
            const response = await getTransactionsAction({
                contactId: normalizedFilters.contactId,
                groupId: normalizedFilters.groupId,
                mode: normalizedFilters.mode,
                limit: PAGE_SIZE,
                offset: pageParam * PAGE_SIZE,
            })
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to fetch transactions')
            }
            return response.data as unknown as TransactionWithJoins[]
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === PAGE_SIZE ? allPages.length : undefined
        },
    })
}

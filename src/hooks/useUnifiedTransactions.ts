import { useQuery } from '@tanstack/react-query'
import { getUnifiedTransactionsAction } from '@/lib/actions/transactions'
import { TransactionWithJoins } from '@/types'

export function useUnifiedTransactions() {
    return useQuery({
        queryKey: ['unified-transactions'],
        queryFn: async () => {
            const response = await getUnifiedTransactionsAction({})
            if (!response.success || !response.data) throw new Error(response.error)
            return response.data as unknown as TransactionWithJoins[]
        },
    })
}

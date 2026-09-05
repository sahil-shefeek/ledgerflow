import { useQuery } from '@tanstack/react-query'
import { getTransactionsAction } from '@/lib/actions/transactions'
import { TransactionWithJoins } from '@/types'

export function useContactTransactions(contactId: string) {
    return useQuery({
        queryKey: ['transactions', 'contact', contactId],
        queryFn: async () => {
            const result = await getTransactionsAction({ contactId })
            if (result.error) throw new Error(result.error)
            return (result.data || []) as TransactionWithJoins[]
        },
        enabled: !!contactId,
    })
}

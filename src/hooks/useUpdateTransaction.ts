import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateTransactionAction } from '@/lib/actions/transactions'
import { rupeesToPaise } from '@/lib/currency'
import { toast } from '@/components/ui/toast'

interface UpdateTransactionParams {
    id: string
    amount: number
    flow: 'IN' | 'OUT'
    mode: 'BUSINESS' | 'PERSONAL'
    contact_id?: string | null
    category_id?: string | null
    account_id?: string | null
    date: Date
    due_date?: Date | null
    name: string
    note?: string | null
}

export function useUpdateTransaction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (updatedTransaction: UpdateTransactionParams) => {
            // Convert amount from rupees (user input) to integer paise for DB storage
            const amountInPaise = rupeesToPaise(updatedTransaction.amount)

            const result = await updateTransactionAction({
                id: updatedTransaction.id,
                amount: amountInPaise,
                flow: updatedTransaction.flow,
                mode: updatedTransaction.mode,
                contactId: updatedTransaction.contact_id || null,
                categoryId: updatedTransaction.category_id || null,
                accountId: updatedTransaction.account_id || null,
                date: updatedTransaction.date,
                dueDate: updatedTransaction.due_date || null,
                name: updatedTransaction.name,
                note: updatedTransaction.note || null,
            })
            if (!result.success) throw new Error(result.error)
            return result.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['personal-transactions'] })
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['analytics'] })
            queryClient.invalidateQueries({ queryKey: ['group-balances'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
        },
        onError: (error) => {
            toast.error(`Failed to update: ${error.message}`)
        },
    })
}

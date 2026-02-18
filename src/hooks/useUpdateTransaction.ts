import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface UpdateTransactionParams {
    id: string
    amount: number
    flow: 'IN' | 'OUT'
    mode: 'BUSINESS' | 'PERSONAL'
    contact_id?: string
    category_id?: string
    account_id?: string
    date: Date
    due_date?: Date
    name: string
    note?: string
}

export function useUpdateTransaction() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (updatedTransaction: UpdateTransactionParams) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data, error } = await supabase
                .from('transactions')
                .update({
                    amount: updatedTransaction.amount,
                    flow: updatedTransaction.flow,
                    mode: updatedTransaction.mode,
                    contact_id: updatedTransaction.contact_id,
                    category_id: updatedTransaction.category_id,
                    account_id: updatedTransaction.account_id,
                    date: updatedTransaction.date.toISOString(),
                    due_date: updatedTransaction.due_date?.toISOString(),
                    name: updatedTransaction.name,
                    note: updatedTransaction.note,
                })
                .eq('id', updatedTransaction.id)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            toast.success('Transaction updated')
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['personal-transactions'] })
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
        },
        onError: (error) => {
            toast.error(`Failed to update: ${error.message}`)
        },
    })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function useDeleteRecurringTransaction() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('recurring_transactions')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] })
            toast.success('Recurring transaction deleted')
        },
        onError: (error) => {
            toast.error(`Failed to delete: ${error.message}`)
        },
    })
}

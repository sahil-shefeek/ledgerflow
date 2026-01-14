import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function useAddRecurringTransaction() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            const { error } = await supabase
                .from('recurring_transactions')
                .insert(data)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] })
            toast.success('Recurring transaction created')
        },
        onError: (error) => {
            toast.error(`Failed to create: ${error.message}`)
        },
    })
}

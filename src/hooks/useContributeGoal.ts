import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

interface ContributeGoalParams {
    id: string
    amount: number
}

export function useContributeGoal() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, amount }: ContributeGoalParams) => {
            // 1. Get current amount
            const { data: goal, error: fetchError } = await supabase
                .from('goals')
                .select('current_amount')
                .eq('id', id)
                .single()

            if (fetchError) throw fetchError

            // 2. Update amount
            const { data, error } = await supabase
                .from('goals')
                .update({ current_amount: goal.current_amount + amount })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            toast.success('Added to goal!')
            queryClient.invalidateQueries({ queryKey: ['goals'] })
        },
        onError: (error) => {
            toast.error(`Failed to update goal: ${error.message}`)
        },
    })
}

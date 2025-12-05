import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface AddGoalParams {
    name: string
    target_amount: number
    deadline: Date
}

export function useAddGoal() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: AddGoalParams) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data, error } = await supabase
                .from('goals')
                .insert({
                    name: params.name,
                    target_amount: params.target_amount,
                    deadline: params.deadline.toISOString(),
                    user_id: user.id,
                    current_amount: 0,
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            toast.success('Goal added successfully')
            queryClient.invalidateQueries({ queryKey: ['goals'] })
        },
        onError: (error) => {
            toast.error(`Failed to add goal: ${error.message}`)
        },
    })
}

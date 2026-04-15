import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { rupeesToPaise } from '@/lib/currency'
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
            // Convert amount from rupees (user input) to integer paise for DB storage
            const amountInPaise = rupeesToPaise(amount)

            // Single atomic RPC call — no read-modify-write, no race condition
            const { data, error } = await supabase.rpc('contribute_to_goal', {
                p_goal_id: id,
                p_amount: amountInPaise,
            })

            if (error) throw error
            return data
        },
        onSuccess: () => {
            toast.success('Added to goal!')
            queryClient.invalidateQueries({ queryKey: ['goals'] })
        },
        onError: (error) => {
            if (error.message?.includes('Contribution would exceed goal target')) {
                toast.error('Amount exceeds the remaining goal balance.')
            } else {
                toast.error(`Failed to update goal: ${error.message}`)
            }
        },
    })
}

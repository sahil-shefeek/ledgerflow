import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

interface UpdateCategoryParams {
    id: string
    budget_limit: number
}

export function useUpdateCategory() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, budget_limit }: UpdateCategoryParams) => {
            const { data, error } = await supabase
                .from('categories')
                .update({ budget_limit })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            toast.success('Budget updated')
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
        },
        onError: (error) => {
            toast.error(`Failed to update budget: ${error.message}`)
        },
    })
}

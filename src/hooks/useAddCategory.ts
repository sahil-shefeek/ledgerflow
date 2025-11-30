import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

interface AddCategoryParams {
    name: string
    icon: string
    type: 'INCOME' | 'EXPENSE'
}

export function useAddCategory() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: AddCategoryParams) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data, error } = await supabase
                .from('categories')
                .insert({
                    ...params,
                    user_id: user.id,
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            toast.success('Category added')
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
        },
        onError: (error) => {
            toast.error(`Failed to add category: ${error.message}`)
        },
    })
}

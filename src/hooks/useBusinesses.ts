import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

export interface Business {
    id: string
    name: string
    created_at: string
}

export function useBusinesses() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['businesses'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('businesses')
                .select('*')
                .order('created_at', { ascending: true })

            if (error) throw error
            return data as Business[]
        },
    })
}

export function useCreateBusiness() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (name: string) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data, error } = await supabase
                .from('businesses')
                .insert({
                    user_id: user.id,
                    name,
                })
                .select()
                .single()

            if (error) throw error
            return data as Business
        },
        onSuccess: () => {
            toast.success('Business created')
            queryClient.invalidateQueries({ queryKey: ['businesses'] })
        },
        onError: (error) => {
            toast.error(`Failed to create business: ${error.message}`)
        },
    })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Contact } from '@/types'

export function useAddPerson() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (newPerson: { name: string; phone?: string; image_url?: string; }) => {
            const { data, error } = await supabase
                .from('contacts')
                .insert({
                    name: newPerson.name,
                    phone: newPerson.phone,
                    type: 'OTHER', // Always OTHER for personal people
                    image_url: newPerson.image_url,
                    user_id: (await supabase.auth.getUser()).data.user?.id,
                    business_id: null, // Always null for personal people
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })
            toast.success('Person added')
        },
        onError: (error) => {
            toast.error(`Failed to add person: ${error.message}`)
        },
    })
}

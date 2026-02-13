import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Contact } from '@/types'

type UpdateContactParams = Partial<Contact> & { id: string }

export function useUpdateContact() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: UpdateContactParams) => {
            const { id, ...updates } = params

            const { data, error } = await supabase
                .from('contacts')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (data) => {
            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })

            // Invalidate specific contact detail
            queryClient.invalidateQueries({ queryKey: ['contact', data.id] })

            toast.success('Contact updated successfully')
        },
        onError: (error) => {
            toast.error(`Failed to update contact: ${error.message}`)
        },
    })
}

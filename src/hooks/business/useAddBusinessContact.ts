import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { toast } from 'sonner'
import { Contact } from '@/types'

export function useAddBusinessContact() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { currentBusinessId } = useAppStore()

    return useMutation({
        mutationFn: async (newContact: { name: string; phone?: string; type: Contact['type']; image_url?: string; }) => {
            if (!currentBusinessId) throw new Error('No business selected')

            const { data, error } = await supabase
                .from('contacts')
                .insert({
                    name: newContact.name,
                    phone: newContact.phone,
                    type: newContact.type,
                    image_url: newContact.image_url,
                    user_id: (await supabase.auth.getUser()).data.user?.id,
                    business_id: currentBusinessId,
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            toast.success('Contact added')
        },
        onError: (error) => {
            toast.error(`Failed to add contact: ${error.message}`)
        },
    })
}

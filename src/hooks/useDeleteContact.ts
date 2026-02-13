import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function useDeleteContact() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', id)

            if (error) throw error
            return id
        },
        onSuccess: (id) => {
            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })

            // We might want to remove the specific query or just let it be refetched (and return 404/null)
            queryClient.removeQueries({ queryKey: ['contact', id] })

            toast.success('Contact deleted successfully')
        },
        onError: (error) => {
            toast.error(`Failed to delete contact: ${error.message}`)
        },
    })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function useRemoveFriend() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (friendId: string) => {
            const { error } = await supabase.rpc('remove_friend', { friend_id: friendId })
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['friendships'] })
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })
            toast.success('Friend disconnected successfully')
        },
        onError: (error) => {
            toast.error(`Failed to unfriend: ${error.message}`)
        },
    })
}

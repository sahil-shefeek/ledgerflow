import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useFriendRequestActions() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
        queryClient.invalidateQueries({ queryKey: ['friendships'] })
        queryClient.invalidateQueries({ queryKey: ['contacts'] })
        queryClient.invalidateQueries({ queryKey: ['personal-people'] })
    }

    const sendRequest = useMutation({
        mutationFn: async ({ targetUserId, contactId }: { targetUserId: string, contactId?: string }) => {
            const { data, error } = await supabase.rpc('send_friend_request', {
                p_target_user_id: targetUserId,
                p_contact_id: contactId || null
            })
            if (error) throw error
            return data
        },
        onSuccess: invalidateAll
    })

    const acceptRequest = useMutation({
        mutationFn: async (friendshipId: string) => {
            const { data, error } = await supabase.rpc('accept_in_app_request', {
                p_friendship_id: friendshipId
            })
            if (error) throw error
            return data
        },
        onSuccess: invalidateAll
    })

    const rejectRequest = useMutation({
        mutationFn: async (friendshipId: string) => {
            // 1. Get the friendship record to know the other user id
            const { data: fData, error: fError } = await supabase
                .from('friendships')
                .select('*')
                .eq('id', friendshipId)
                .single()

            if (fError) throw fError

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const otherUserId = fData.user_id_1 === user.id ? fData.user_id_2 : fData.user_id_1

            // 2. Delete the pending friendship
            const { error: deleteError } = await supabase
                .from('friendships')
                .delete()
                .eq('id', friendshipId)

            if (deleteError) throw deleteError

            // 3. Unlink contact just in case it was linked by the sender
            // Unlinking where user_id = me AND linked_user_id = otherUserId
            const { error: unlinkError } = await supabase
                .from('contacts')
                .update({ linked_user_id: null })
                .eq('user_id', user.id)
                .eq('linked_user_id', otherUserId)

            // Ignore unlink error if no contact was found
            if (unlinkError && unlinkError.code !== 'PGRST116') {
                console.error('Failed to unlink contact:', unlinkError)
            }

            return { success: true }
        },
        onSuccess: invalidateAll
    })

    return {
        sendRequest,
        acceptRequest,
        rejectRequest
    }
}

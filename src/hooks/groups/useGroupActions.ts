import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface LinkGhostMemberParams {
    groupId: string
    ghostMemberId: string
    friendUserId: string
}

export function useLinkGhostMember() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ groupId, ghostMemberId, friendUserId }: LinkGhostMemberParams) => {
            const { data, error } = await supabase.rpc('link_ghost_to_friend', {
                p_group_id: groupId,
                p_ghost_member_id: ghostMemberId,
                p_friend_user_id: friendUserId,
            })

            if (error) throw error
            return data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] })
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            toast.success('Member linked successfully')
        },
        onError: (error) => {
            console.error('Error linking member:', error)
            toast.error(error.message || 'Failed to link member')
        },
    })
}

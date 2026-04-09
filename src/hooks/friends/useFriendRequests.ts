import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface PendingFriendRequest {
    id: string // Friendship ID
    type: 'INCOMING' | 'OUTGOING'
    profile: {
        id: string
        full_name: string | null
        avatar_url: string | null
    }
}

export function useFriendRequests() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['friend-requests'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase
                .from('friendships')
                .select(`
                    id,
                    user_id_1,
                    user_id_2,
                    initiator_id,
                    status,
                    profile1:profiles!user_id_1(id, full_name, avatar_url),
                    profile2:profiles!user_id_2(id, full_name, avatar_url)
                `)
                .eq('status', 'PENDING')
                .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)

            if (error) throw error

            const requests: PendingFriendRequest[] = data.map((f: any) => {
                const isUser1 = f.user_id_1 === user.id
                const otherProfile = isUser1 ? f.profile2 : f.profile1
                const isIncoming = f.initiator_id !== user.id

                return {
                    id: f.id,
                    type: isIncoming ? 'INCOMING' : 'OUTGOING',
                    profile: {
                        id: otherProfile.id,
                        full_name: otherProfile.full_name,
                        avatar_url: otherProfile.avatar_url
                    }
                }
            })

            return requests
        }
    })
}

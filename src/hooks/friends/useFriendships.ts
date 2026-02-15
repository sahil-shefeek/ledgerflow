import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Friendship } from '@/types'

export interface Friend {
    friendship_id: string
    profile: {
        id: string
        full_name: string | null
        avatar_url: string | null
        email?: string
    }
}

export function useFriendships() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['friendships'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            // Fetch accept friendships where current user is involved
            const { data, error } = await supabase
                .from('friendships')
                .select(`
                    id,
                    user_id_1,
                    user_id_2,
                    profile1:profiles!user_id_1(id, full_name, avatar_url),
                    profile2:profiles!user_id_2(id, full_name, avatar_url)
                `)
                .eq('status', 'ACCEPTED')
                .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)

            if (error) throw error

            // Transform to a clean list of "People"
            const friends: Friend[] = data.map((f: any) => {
                const isUser1 = f.user_id_1 === user.id
                const otherProfile = isUser1 ? f.profile2 : f.profile1

                return {
                    friendship_id: f.id,
                    profile: {
                        id: otherProfile.id,
                        full_name: otherProfile.full_name,
                        avatar_url: otherProfile.avatar_url,
                    }
                }
            })

            return friends
        },
    })
}

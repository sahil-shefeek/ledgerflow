import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Group, GroupMember } from '@/types'

export interface GroupDetails {
    group: Group
    members: (GroupMember & {
        profiles?: {
            full_name: string | null
            avatar_url: string | null
        }
    })[]
}

export function useGroupDetails(groupId: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ['group', groupId],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            // Fetch group details
            const { data: groupData, error: groupError } = await supabase
                .from('groups')
                .select('*')
                .eq('id', groupId)
                .single()

            if (groupError) throw groupError

            // Fetch members with profiles
            const { data: membersData, error: membersError } = await supabase
                .from('group_members')
                .select('*, profiles(full_name, avatar_url)')
                .eq('group_id', groupId)

            if (membersError) throw membersError

            return {
                group: groupData as Group,
                members: membersData || [],
            } as GroupDetails
        },
        enabled: !!groupId,
    })
}

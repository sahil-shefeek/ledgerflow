import { useQuery } from '@tanstack/react-query'
import { getGroupDetailsAction } from '@/lib/actions/groups'
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
    return useQuery({
        queryKey: ['group', groupId],
        queryFn: async () => {
            const res = await getGroupDetailsAction(groupId)
            if (res.error) throw new Error(res.error)
            return res.data as unknown as GroupDetails
        },
        enabled: !!groupId,
    })
}

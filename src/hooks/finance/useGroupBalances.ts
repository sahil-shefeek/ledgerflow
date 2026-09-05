import { useQuery } from '@tanstack/react-query'
import { getGroupBalancesAction } from '@/lib/actions/groups'
import { GroupMember } from '@/types'

export function useGroupBalances(groupId: string, members: (GroupMember & { profiles?: { full_name: string | null; avatar_url: string | null } })[]) {
    return useQuery({
        queryKey: ['group-balances', groupId],
        queryFn: async () => {
            const res = await getGroupBalancesAction(groupId)
            if (res.error) throw new Error(res.error)
            return res.data
        },
        enabled: !!groupId && members.length > 0,
    })
}

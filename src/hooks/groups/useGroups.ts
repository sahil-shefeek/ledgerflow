import { useQuery } from '@tanstack/react-query'
import { getGroupsAction } from '@/lib/actions/groups'
import { Group } from '@/types'

export function useGroups() {
    return useQuery({
        queryKey: ['groups'],
        queryFn: async () => {
            const res = await getGroupsAction({})
            if (res.error) throw new Error(res.error)
            return res.data as unknown as Group[]
        }
    })
}

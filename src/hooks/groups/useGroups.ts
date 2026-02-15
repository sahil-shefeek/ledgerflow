import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Group } from '@/types'

export function useGroups() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['groups'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            // 1. Get group IDs first
            const { data: memberData, error: memberError } = await supabase
                .from('group_members')
                .select('group_id')
                .eq('user_id', user.id)

            if (memberError) throw memberError

            // If no groups, return empty array immediately to avoid "in ()" syntax error
            // and saving a round trip.
            if (!memberData || memberData.length === 0) {
                return []
            }

            const groupIds = memberData.map(m => m.group_id)

            // 2. Fetch groups
            const { data, error } = await supabase
                .from('groups')
                .select('*')
                .in('id', groupIds)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as Group[]
        }
    })
}

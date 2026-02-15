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

            // Fetch groups where the user is a member
            const { data, error } = await supabase
                .from('groups')
                .select('*')
                .filter('id', 'in', (
                    await supabase
                        .from('group_members')
                        .select('group_id')
                        .eq('user_id', user.id)
                ).data?.map((m: { group_id: string }) => m.group_id) || [])
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as Group[]
        },
    })
}

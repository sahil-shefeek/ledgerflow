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

            // Single query via PostgREST implicit join — requires FK from
            // group_members.group_id → groups.id (standard Supabase schema).
            const { data, error } = await supabase
                .from('group_members')
                .select('groups(*)')
                .eq('user_id', user.id)
                .order('created_at', { referencedTable: 'groups', ascending: false })

            if (error) throw error

            // Unwrap the nested group objects and filter out any nulls
            const groups = data
                .map((row: any) => row.groups) // eslint-disable-line @typescript-eslint/no-explicit-any
                .filter(Boolean) as Group[]

            return groups
        }
    })
}

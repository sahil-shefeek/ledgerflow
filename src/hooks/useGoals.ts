import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Goal {
    id: string
    name: string
    target_amount: number
    current_amount: number
    deadline: string | null
}

export function useGoals() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['goals'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .order('deadline', { ascending: true })

            if (error) throw error
            return data as Goal[]
        },
    })
}

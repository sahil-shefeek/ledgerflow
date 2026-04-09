import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Paise } from '@/types'

export interface Goal {
    id: string
    name: string
    /** Stored as integer paise (100 paise = ₹1). Use currency.ts helpers for arithmetic. */
    target_amount: Paise
    /** Stored as integer paise (100 paise = ₹1). Use currency.ts helpers for arithmetic. */
    current_amount: Paise
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

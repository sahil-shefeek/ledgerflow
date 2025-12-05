import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CategorySpend {
    category_name: string
    category_color: string
    total_spent: number
}

export function useMonthlyCategorySpend(month: number, year: number) {
    const supabase = createClient()

    return useQuery({
        queryKey: ['analytics', month, year],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not found')

            const { data, error } = await supabase.rpc('get_monthly_category_spend', {
                p_user_id: user.id,
                p_month: month,
                p_year: year,
            })

            if (error) throw error
            return data as CategorySpend[]
        },
    })
}

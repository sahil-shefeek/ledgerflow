import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface RecurringTransaction {
    id: string
    amount: number
    name: string
    note?: string
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
    start_date: string
    next_run_date: string
    last_run_date: string | null
    active: boolean
    category_id: string | null
    account_id: string | null
    flow: 'IN' | 'OUT'
    category: {
        name: string
        icon: string
    } | null
    account: {
        name: string
        type: string
    } | null
}

export function useRecurringTransactions() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['recurring-transactions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('recurring_transactions')
                .select(`
                    *,
                    category:categories(name, icon),
                    account:accounts(name, type)
                `)
                .order('next_run_date', { ascending: true })

            if (error) throw error
            return data as unknown as RecurringTransaction[]
        },
    })
}

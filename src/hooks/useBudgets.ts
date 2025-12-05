import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface BudgetCategory {
    id: string
    name: string
    icon: string
    budget_limit: number | null
    spent: number
}

export function useBudgets() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['budgets'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            // 1. Fetch Categories
            const { data: categories, error: catError } = await supabase
                .from('categories')
                .select('*')
                .eq('type', 'EXPENSE')

            if (catError) throw catError

            // 2. Fetch Spending for current month for these categories
            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0, 0, 0, 0)

            const { data: transactions, error: transError } = await supabase
                .from('transactions')
                .select('category_id, amount')
                .eq('mode', 'PERSONAL')
                .eq('flow', 'OUT')
                .gte('date', startOfMonth.toISOString())
                .in('category_id', categories.map(c => c.id))

            if (transError) throw transError

            // 3. Aggregate Spending
            const spendingMap = new Map<string, number>()
            transactions?.forEach(t => {
                const current = spendingMap.get(t.category_id) || 0
                spendingMap.set(t.category_id, current + t.amount)
            })

            // 4. Combine
            return categories.map(cat => ({
                id: cat.id,
                name: cat.name,
                icon: cat.icon,
                budget_limit: cat.budget_limit,
                spent: spendingMap.get(cat.id) || 0
            })) as BudgetCategory[]
        },
    })
}

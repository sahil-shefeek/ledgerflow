import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { rupeesToPaise } from '@/lib/currency'
import { toast } from 'sonner'

interface AddRecurringTransactionParams {
    name: string
    amount: number
    flow: 'IN' | 'OUT'
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
    start_date: string
    next_run_date: string
    category_id?: string
    account_id?: string
    active?: boolean
}

export function useAddRecurringTransaction() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: AddRecurringTransactionParams) => {
            // Auth gate — RLS enforces ownership, this prevents unauthenticated client calls
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            // Convert amount from rupees (user input) to integer paise for DB storage
            const amountInPaise = rupeesToPaise(data.amount)

            const { error } = await supabase
                .from('recurring_transactions')
                .insert({
                    user_id: user.id,
                    name: data.name,
                    amount: amountInPaise,
                    flow: data.flow,
                    frequency: data.frequency,
                    start_date: data.start_date,
                    next_run_date: data.next_run_date,
                    category_id: data.category_id ?? null,
                    account_id: data.account_id ?? null,
                    active: data.active ?? true,
                })

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] })
            toast.success('Recurring transaction created')
        },
        onError: (error) => {
            toast.error(`Failed to create: ${error.message}`)
        },
    })
}

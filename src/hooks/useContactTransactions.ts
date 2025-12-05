import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Transaction {
    id: string
    amount: number
    description: string
    date: string
    flow: 'IN' | 'OUT'
    mode: 'BUSINESS' | 'PERSONAL'
    contact_id?: string
    category_id?: string
    account_id?: string
    due_date?: string
}

export function useContactTransactions(contactId: string) {
    const supabase = createClient()

    return useQuery({
        queryKey: ['transactions', 'contact', contactId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('contact_id', contactId)
                .order('date', { ascending: false })

            if (error) throw error
            return data as Transaction[]
        },
        enabled: !!contactId,
    })
}

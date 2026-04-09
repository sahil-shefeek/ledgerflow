import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Transaction {
    id: string
    amount: number
    description?: string
    name: string
    note?: string
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
                .from('unified_contact_transactions')
                .select('*, category:categories(name, icon), payer:profiles!payer_id(full_name, avatar_url)')
                .eq('local_contact_id', contactId)
                .order('date', { ascending: false })

            if (error) throw error

            // Map the unified view columns to the expected Transaction format
            return data.map((t: any) => ({
                ...t,
                contact_id: t.local_contact_id,
                flow: t.local_flow
            })) as Transaction[]
        },
        enabled: !!contactId,
    })
}

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'

export interface Contact {
    id: string
    name: string
    phone: string | null
    type: 'CUSTOMER' | 'VENDOR'
    net_balance: number
    last_transaction_at: string
}

export function useContacts() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['contacts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .order('last_transaction_at', { ascending: false })

            if (error) throw error
            return data as Contact[]
        },
    })
}

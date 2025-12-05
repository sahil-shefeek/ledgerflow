import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Account {
    id: string
    name: string
    type: 'CASH' | 'BANK' | 'WALLET' | 'OTHER'
    balance: number
    is_default: boolean
}

export function useAccounts() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('accounts')
                .select('*')
                .order('created_at', { ascending: true })

            if (error) throw error
            return data as Account[]
        },
    })
}

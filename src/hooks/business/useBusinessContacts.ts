import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { Contact } from '@/types'

export function useBusinessContacts() {
    const supabase = createClient()
    const { currentBusinessId } = useAppStore()

    return useQuery({
        queryKey: ['contacts', currentBusinessId],
        queryFn: async () => {
            if (!currentBusinessId) return []

            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('business_id', currentBusinessId)
                .order('last_transaction_at', { ascending: false })

            if (error) throw error
            return data as Contact[]
        },
        enabled: !!currentBusinessId,
    })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { toast } from 'sonner'

export interface Contact {
    id: string
    name: string
    phone: string | null
    type: 'CUSTOMER' | 'SUPPLIER' | 'OTHER'
    net_balance: number
    last_transaction_at: string
    business_id: string
    image_url: string | null
}

export function useContacts() {
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

export function useAddContact() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { currentBusinessId } = useAppStore()

    return useMutation({
        mutationFn: async (newContact: { name: string; phone?: string; type: Contact['type']; image_url?: string }) => {
            if (!currentBusinessId) throw new Error('No business selected')

            const { data, error } = await supabase
                .from('contacts')
                .insert({
                    ...newContact,
                    user_id: (await supabase.auth.getUser()).data.user?.id,
                    business_id: currentBusinessId,
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            toast.success('Contact added')
        },
        onError: (error) => {
            toast.error(`Failed to add contact: ${error.message}`)
        },
    })
}

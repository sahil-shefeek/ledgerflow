import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

interface AddContactParams {
    name: string
    phone?: string
    type: 'CUSTOMER' | 'VENDOR'
}

export function useAddContact() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: AddContactParams) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data, error } = await supabase
                .from('contacts')
                .insert({
                    name: params.name,
                    phone: params.phone,
                    type: params.type,
                    user_id: user.id,
                    net_balance: 0,
                    last_transaction_at: new Date().toISOString(),
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            toast.success('Contact added successfully')
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
        },
        onError: (error) => {
            toast.error(`Failed to add contact: ${error.message}`)
        },
    })
}

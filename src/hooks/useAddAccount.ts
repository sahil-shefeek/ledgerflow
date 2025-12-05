import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface AddAccountParams {
    name: string
    type: 'CASH' | 'BANK' | 'WALLET' | 'OTHER'
    balance: number
}

export function useAddAccount() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (newAccount: AddAccountParams) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            const { data, error } = await supabase
                .from('accounts')
                .insert({
                    ...newAccount,
                    user_id: user.id,
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            toast.success('Account created')
        },
        onError: (error) => {
            toast.error('Failed to create account')
            console.error(error)
        },
    })
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useEffect } from 'react'

export type Profile = {
    id: string
    full_name: string | null
    business_name: string | null
    phone: string | null
    avatar_url: string | null
    currency_symbol: string
}

export function useProfile() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (error) throw error
            return data as Profile
        }
    })

    const updateProfile = useMutation({
        mutationFn: async (updates: Partial<Profile>) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] })
            toast.success('Profile updated successfully')
        },
        onError: (error) => {
            console.error('Error updating profile:', error)
            toast.error('Failed to update profile')
        }
    })

    return {
        profile,
        isLoading,
        error,
        updateProfile
    }
}

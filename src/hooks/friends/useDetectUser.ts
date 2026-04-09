import { useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface DetectedUser {
    id: string
    full_name: string | null
    avatar_url: string | null
}

export function useDetectUser() {
    const supabase = createClient()

    return useMutation({
        mutationFn: async (phone: string) => {
            const { data, error } = await supabase
                .rpc('detect_user_by_phone', { p_phone: phone })
            
            if (error) throw error
            // rpc returns a table, so data is an array. We expect 0 or 1 result.
            if (!data || data.length === 0) return null
            return data[0] as DetectedUser
        }
    })
}

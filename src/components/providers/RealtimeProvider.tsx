'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useProfile } from '@/hooks/use-profile'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient()
    const supabase = createClient()
    const { profile } = useProfile()

    useEffect(() => {
        if (!profile?.id) return

        const channel = supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${profile.id}`,
                },
                (payload) => {
                    // Show toast
                    toast(payload.new.title, {
                        description: payload.new.message,
                    })

                    // Invalidate notifications query
                    queryClient.invalidateQueries({ queryKey: ['notifications'] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profile?.id, queryClient, supabase])

    return <>{children}</>
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

interface PageProps {
    params: {
        token: string
    }
}

export default function ContactInvitePage({ params }: PageProps) {
    const { token } = params
    const router = useRouter()
    const supabase = createClient()

    const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING')
    const [message, setMessage] = useState('Connecting you...')

    useEffect(() => {
        const acceptInvite = async () => {
            try {
                // Ensure user is authenticated first
                const { data: { session } } = await supabase.auth.getSession()

                if (!session) {
                    // Redirect to login if not authenticated, passing the return URL
                    router.push(`/auth?returnUrl=/invite/contact/${token}`)
                    return
                }

                // Call the RPC to accept the invite
                const { data, error } = await supabase.rpc('accept_contact_invite', {
                    token: token
                })

                if (error) throw error

                setStatus('SUCCESS')
                setMessage(`Success! You are now friends with ${data.owner_name}. Redirecting...`)

                // Redirect user specified suggestion to dashboard/friends
                setTimeout(() => {
                    router.push('/dashboard/friends')
                }, 2000)

            } catch (err: any) {
                console.error('Error accepting invite:', err)
                setStatus('ERROR')
                setMessage(err.message || 'Invalid or expired link.')
            }
        }

        acceptInvite()
    }, [token, supabase, router])

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="max-w-md w-full p-8 text-center space-y-6">
                {status === 'LOADING' && (
                    <div className="flex flex-col items-center gap-4 text-primary">
                        <Loader2 className="h-12 w-12 animate-spin" />
                        <h2 className="text-xl font-semibold">{message}</h2>
                    </div>
                )}

                {status === 'SUCCESS' && (
                    <div className="flex flex-col items-center gap-4 text-green-600 dark:text-green-500">
                        <CheckCircle2 className="h-16 w-16" />
                        <h2 className="text-xl font-semibold">{message}</h2>
                    </div>
                )}

                {status === 'ERROR' && (
                    <div className="flex flex-col items-center gap-4 text-destructive">
                        <XCircle className="h-16 w-16" />
                        <h2 className="text-xl font-semibold">Invite Failed</h2>
                        <p className="text-muted-foreground text-sm">{message}</p>

                        <button
                            onClick={() => router.push('/dashboard')}
                            className="mt-6 font-medium text-primary hover:underline"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

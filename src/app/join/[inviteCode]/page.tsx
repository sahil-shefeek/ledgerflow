'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, AlertCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface GhostMember {
    id: string
    name: string
    avatar_url: string | null
}

interface GroupDetails {
    group_id: string
    group_name: string
    group_avatar_url: string | null
    ghost_members: GhostMember[] | null
}

export default function JoinGroupPage() {
    const params = useParams()
    const router = useRouter()
    const inviteCode = params.inviteCode as string

    const [isLoading, setIsLoading] = useState(true)
    const [isJoining, setIsJoining] = useState(false)
    const [group, setGroup] = useState<GroupDetails | null>(null)
    const [selectedGhost, setSelectedGhost] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    useEffect(() => {
        async function fetchGroup() {
            if (!inviteCode) return

            try {
                const { data, error } = await supabase.rpc('get_group_by_invite', {
                    invite_code_input: inviteCode,
                })

                if (error) {
                    throw error
                }

                if (!data || data.length === 0) {
                    setError('Invalid or expired link')
                    return
                }

                setGroup(data[0] as GroupDetails)
            } catch (err: any) {
                console.error('Error fetching group:', err)
                setError('Failed to load group details')
            } finally {
                setIsLoading(false)
            }
        }

        fetchGroup()
    }, [inviteCode, supabase])

    const handleJoin = async (claimGhostId: string | null = null) => {
        setIsJoining(true)
        try {
            const { data, error } = await supabase.rpc('join_group', {
                invite_code_input: inviteCode,
                claim_ghost_member_id: claimGhostId,
            })

            if (error) {
                throw error
            }

            if (data?.success) {
                if (data.message === 'Already a member') {
                    toast.info('You are already a member of this group')
                } else {
                    toast.success('Successfully joined the group!')
                }
                router.push(`/dashboard/groups/${data.group_id}`)
            } else {
                throw new Error('Failed to join group')
            }
        } catch (err: any) {
            console.error('Error joining group:', err)
            // Show more user-friendly error if they select an already claimed ghost
            if (err.message?.includes('already claimed')) {
                toast.error('This profile was already claimed. Please refresh or join as new.')
            } else {
                toast.error(err.message || 'Failed to join group')
            }
        } finally {
            setIsJoining(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <Skeleton className="h-24 w-24 rounded-full mx-auto mb-4" />
                        <Skeleton className="h-4 w-32 mx-auto mb-2" />
                        <Skeleton className="h-8 w-48 mx-auto" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-12 w-full mt-6" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (error || !group) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-destructive/10 h-20 w-20 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="h-10 w-10 text-destructive" />
                        </div>
                        <CardTitle className="text-xl">Invalid Invite Link</CardTitle>
                        <CardDescription>{error || 'This invite link is invalid or has expired.'}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button className="w-full" onClick={() => router.push('/dashboard')}>
                            Go to Dashboard
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    const hasGhosts = group.ghost_members && group.ghost_members.length > 0
    const filteredGhosts = (group.ghost_members || []).filter(g => g !== null)
    const validGhosts = hasGhosts ? filteredGhosts.filter(g => g && g.id) : []
    const showGhosts = validGhosts.length > 0

    return (
        <div className="flex min-h-[80vh] items-center justify-center p-4 md:p-8">
            <Card className="w-full max-w-md shadow-xl border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="text-center space-y-4 pb-8">
                    <div className="relative mx-auto h-24 w-24">
                        <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                            <AvatarImage src={group.group_avatar_url || undefined} />
                            <AvatarFallback className="text-3xl bg-primary/10 text-primary uppercase">
                                {group.group_name.slice(0, 2)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground h-8 w-8 rounded-full flex items-center justify-center shadow-sm">
                            <Users className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            You've been invited to join
                        </p>
                        <CardTitle className="text-3xl font-extrabold tracking-tight">
                            {group.group_name}
                        </CardTitle>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {showGhosts ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-muted/50 rounded-xl p-4 text-center border">
                                <p className="text-sm font-medium">Are you one of these people?</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Someone might have already added expenses for you. Claim your profile below.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                                {validGhosts.map((ghost) => (
                                    <button
                                        key={ghost.id}
                                        onClick={() => setSelectedGhost(ghost.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 text-center",
                                            selectedGhost === ghost.id
                                                ? "border-primary bg-primary/5 shadow-sm scale-[1.02]"
                                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                                        )}
                                    >
                                        <Avatar className="h-12 w-12 shadow-sm">
                                            <AvatarImage src={ghost.avatar_url || undefined} />
                                            <AvatarFallback className="uppercase bg-background">
                                                {ghost.name.slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium line-clamp-1 truncate w-full px-1">
                                            {ghost.name}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3 pt-2">
                                <Button
                                    className="w-full h-12 text-base font-medium transition-all"
                                    size="lg"
                                    disabled={!selectedGhost || isJoining}
                                    onClick={() => handleJoin(selectedGhost)}
                                >
                                    {isJoining && selectedGhost ? (
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    ) : null}
                                    {selectedGhost
                                        ? `Yes, I am ${validGhosts.find(g => g.id === selectedGhost)?.name}`
                                        : "Select your profile"}
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-border/50" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground font-medium">
                                            Or
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    className="w-full h-11"
                                    disabled={isJoining}
                                    onClick={() => handleJoin(null)}
                                >
                                    {isJoining && !selectedGhost ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    No, join as a new member
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="pt-4 pb-2">
                            <Button
                                className="w-full h-12 text-base font-medium shadow-md transition-all hover:shadow-lg"
                                size="lg"
                                disabled={isJoining}
                                onClick={() => handleJoin(null)}
                            >
                                {isJoining ? (
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                ) : null}
                                Join Group
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

"use client"

import { useFriendRequests } from "@/hooks/friends/useFriendRequests"
import { useFriendRequestActions } from "@/hooks/friends/useFriendRequestActions"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Loader2, Check, X, Clock } from "lucide-react"

export function PendingRequestsList() {
    const { data: requests, isLoading } = useFriendRequests()
    const { acceptRequest, rejectRequest } = useFriendRequestActions()

    if (isLoading) {
        return (
            <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!requests || requests.length === 0) {
        return null
    }

    const incoming = requests.filter(r => r.type === 'INCOMING')
    const outgoing = requests.filter(r => r.type === 'OUTGOING')

    return (
        <div className="space-y-6 mb-8">
            {incoming.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Incoming Friend Requests</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {incoming.map(req => (
                            <Card key={req.id} className="p-4 flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12 border">
                                        <AvatarImage src={req.profile.avatar_url || ''} />
                                        <AvatarFallback>{req.profile.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-base truncate">{req.profile.full_name}</h4>
                                        <p className="text-sm text-muted-foreground truncate">wants to connect</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        className="flex-1 gap-2"
                                        onClick={() => acceptRequest.mutate(req.id)}
                                        disabled={acceptRequest.isPending || rejectRequest.isPending}
                                    >
                                        {acceptRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        Accept
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1 gap-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
                                        onClick={() => rejectRequest.mutate(req.id)}
                                        disabled={acceptRequest.isPending || rejectRequest.isPending}
                                    >
                                        {rejectRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                        Decline
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {outgoing.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Sent Friend Requests</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {outgoing.map(req => (
                            <Card key={req.id} className="p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={req.profile.avatar_url || ''} />
                                        <AvatarFallback>{req.profile.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <h4 className="font-medium text-sm truncate">{req.profile.full_name}</h4>
                                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                                            <Clock className="h-3 w-3" />
                                            <span>Pending</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                    onClick={() => rejectRequest.mutate(req.id)}
                                    disabled={rejectRequest.isPending}
                                >
                                    {rejectRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel'}
                                </Button>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

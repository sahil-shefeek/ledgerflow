'use client'

import { useParams, useRouter } from 'next/navigation'
import { useGroupDetails } from '@/hooks/groups/useGroupDetails'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Copy, Settings, Plus, Handshake } from 'lucide-react'
import { toast } from 'sonner'
import { GroupSettingsDrawer } from '@/components/groups/GroupSettingsDrawer'
import { SplitExpenseDrawer } from '@/components/groups/SplitExpenseDrawer'
import { SettleUpDrawer } from '@/components/groups/SettleUpDrawer'
import { useProfile } from '@/hooks/use-profile'
import { GroupTransactionList } from '@/components/groups/GroupTransactionList'
import { useGroupBalances } from '@/hooks/finance/useGroupBalances'
import { cn } from '@/lib/utils'

function GroupExpensesList({ groupId }: { groupId: string }) {
    const { profile } = useProfile()

    if (!profile) return null

    return (
        <GroupTransactionList groupId={groupId} currentUserId={profile.id} />
    )
}

function GroupBalancesList({ groupId, members, currentUserId }: {
    groupId: string
    members: any[]
    currentUserId: string
}) {
    const { data: balances, isLoading } = useGroupBalances(groupId, members)

    const getMemberName = (member: any) => {
        if (member.user_id === currentUserId) return 'You'
        return member.ghost_name || member.profiles?.full_name || 'Member'
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Balances</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-16 ml-auto" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        members.map((member) => {
                            const balance = balances?.[member.id] ?? 0
                            const isPositive = balance > 0
                            const isNegative = balance < 0
                            const isSettled = balance === 0

                            return (
                                <div key={member.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={member.avatar_url || member.profiles?.avatar_url} />
                                            <AvatarFallback>
                                                {(member.ghost_name || member.profiles?.full_name || '?').slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-medium">{getMemberName(member)}</div>
                                            <div className="text-xs text-muted-foreground capitalize">
                                                {member.user_id ? 'Member' : 'Ghost User'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "text-sm font-semibold",
                                        isPositive && "text-green-600 dark:text-green-400",
                                        isNegative && "text-red-600 dark:text-red-400",
                                        isSettled && "text-muted-foreground"
                                    )}>
                                        {isPositive && `Gets back ₹${balance.toFixed(2)}`}
                                        {isNegative && `Owes ₹${Math.abs(balance).toFixed(2)}`}
                                        {isSettled && 'Settled'}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </CardContent>
            </Card>

            <SettleUpDrawer groupId={groupId} members={members} currentUserId={currentUserId}>
                <Button variant="outline" className="w-full gap-2">
                    <Handshake className="h-4 w-4" />
                    Settle Up
                </Button>
            </SettleUpDrawer>
        </div>
    )
}

export default function GroupDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const groupId = params.groupId as string

    const { data: groupDetails, isLoading } = useGroupDetails(groupId)
    const { profile } = useProfile()

    if (isLoading) {
        return <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-32 w-full" />
        </div>
    }

    if (!groupDetails) {
        return <div className="p-8 text-center">Group not found</div>
    }

    const { group, members } = groupDetails

    const copyInviteLink = () => {
        const link = `${window.location.origin}/join/${group.invite_code}`
        navigator.clipboard.writeText(link)
        toast.success('Invite link copied to clipboard')
    }

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-xl font-bold tracking-tight">Group Details</h1>
                </div>
                <GroupSettingsDrawer groupDetails={groupDetails}>
                    <Button variant="ghost" size="icon">
                        <Settings className="h-5 w-5" />
                    </Button>
                </GroupSettingsDrawer>
            </div>

            {/* Group Card */}
            <Card>
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={group.avatar_url || undefined} />
                        <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                            {group.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold">{group.name}</h2>
                        <div className="text-sm text-muted-foreground capitalize">{group.type.toLowerCase()} group · {members.length} members</div>
                    </div>

                    <div className="flex gap-2 w-full max-w-xs">
                        <Button className="flex-1" variant="outline" onClick={copyInviteLink}>
                            <Copy className="mr-2 h-4 w-4" />
                            Invite
                        </Button>
                        {profile?.id ? (
                            <SplitExpenseDrawer
                                groupId={group.id}
                                members={members}
                                currentUserId={profile.id}
                            >
                                <Button className="flex-1">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Expense
                                </Button>
                            </SplitExpenseDrawer>
                        ) : (
                            <Button className="flex-1" disabled>
                                <Plus className="mr-2 h-4 w-4" />
                                Loading...
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="expenses" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="expenses">Expenses</TabsTrigger>
                    <TabsTrigger value="balances">Balances</TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 overflow-y-auto mt-4">
                    <TabsContent value="expenses" className="m-0 h-full">
                        <GroupExpensesList groupId={groupId} />
                    </TabsContent>
                    <TabsContent value="balances" className="m-0 h-full">
                        <GroupBalancesList
                            groupId={groupId}
                            members={members}
                            currentUserId={profile?.id || ''}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}


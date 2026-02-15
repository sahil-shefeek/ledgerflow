'use client'

import { useGroups } from '@/hooks/groups/useGroups'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateGroupDrawer } from './CreateGroupDrawer'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { formatDistanceToNow } from 'date-fns'

export function GroupsList() {
    const { data: groups, isLoading } = useGroups()
    const router = useRouter()

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
            </div>
        )
    }

    if (!groups || groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center h-64 border rounded-xl border-dashed">
                <Empty className="py-0">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Users className="h-10 w-10 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyTitle>No Groups Yet</EmptyTitle>
                        <EmptyDescription>
                            Create a group to share expenses with friends, roommates, or for a trip.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
                <div className="mt-4">
                    <CreateGroupDrawer>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Group
                        </Button>
                    </CreateGroupDrawer>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your Groups</h2>
                <CreateGroupDrawer>
                    <Button size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        New Group
                    </Button>
                </CreateGroupDrawer>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {groups.map((group) => (
                    <Card
                        key={group.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-95 duration-200"
                        onClick={() => router.push(`/dashboard/groups/${group.id}`)}
                    >
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                            <Avatar className="h-12 w-12 mb-1">
                                <AvatarImage src={group.avatar_url || undefined} />
                                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                                    {group.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1 w-full overflow-hidden">
                                <h3 className="font-semibold truncate">{group.name}</h3>
                                <div className="text-xs text-muted-foreground truncate capitalize">
                                    {group.type.toLowerCase()}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

'use client'

import { PeopleList } from '@/components/personal/PeopleList'
import { usePersonalPeople } from '@/hooks/personal/usePersonalPeople'
import { Contact } from '@/types'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GroupsList } from '@/components/groups/GroupsList'
import { useProfile } from '@/hooks/use-profile'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PendingRequestsList } from '@/components/friends/PendingRequestsList'

// Define filter types matching the hook
type TimeFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'
type SortOption = 'LATEST' | 'MOST_ACTIVE'

export default function FriendsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const activeTab = searchParams.get('tab') || 'friends'

    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL')
    const [sortBy, setSortBy] = useState<SortOption>('LATEST')

    const { profile } = useProfile()

    const { data: contacts, isLoading } = usePersonalPeople({
        timeFilter,
        sortBy
    })

    const copyInviteLink = () => {
        if (!profile?.friend_invite_token) return
        const link = `${window.location.origin}/invite/friend/${profile.friend_invite_token}`
        navigator.clipboard.writeText(link)
        toast.success('Friend invite link copied to clipboard!')
    }

    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', value)
        router.push(`/dashboard/friends?${params.toString()}`)
    }

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between px-1">
                <h1 className="text-2xl font-bold tracking-tight">Friends & Groups</h1>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={copyInviteLink}
                    className="gap-2"
                    disabled={!profile?.friend_invite_token}
                >
                    <UserPlus className="w-4 h-4" />
                    Invite Friend
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-4 mb-4">
                    <TabsList className="grid w-full max-w-[200px] grid-cols-2">
                        <TabsTrigger value="friends">Friends</TabsTrigger>
                        <TabsTrigger value="groups">Groups</TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    <TabsContent value="friends" className="h-full m-0 space-y-4">
                        {/* Filter Controls for People - only show in People tab */}
                        <div className="flex items-center justify-end gap-2 px-1">
                            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                                <SelectTrigger className="w-[110px] h-8 text-xs">
                                    <SelectValue placeholder="Time" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Time</SelectItem>
                                    <SelectItem value="TODAY">Today</SelectItem>
                                    <SelectItem value="WEEK">This Week</SelectItem>
                                    <SelectItem value="MONTH">This Month</SelectItem>
                                    <SelectItem value="YEAR">This Year</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                    <SelectValue placeholder="Sort" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LATEST">Latest</SelectItem>
                                    <SelectItem value="MOST_ACTIVE">Most Active</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <PendingRequestsList />

                        <PeopleList
                            contacts={contacts}
                            isLoading={isLoading}
                            title="Your Friends"
                            emptyMessage="No people found"
                            emptyDescription={timeFilter !== 'ALL' ? "Try changing the time filter." : "Add someone to start tracking."}
                            showAddButton={true}
                            onContactClick={(contact) => {
                                router.push(`/dashboard/friends/${contact.id}`)
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="groups" className="h-full m-0">
                        <GroupsList />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}


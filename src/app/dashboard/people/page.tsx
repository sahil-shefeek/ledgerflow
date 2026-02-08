'use client'

import { PeopleList } from '@/components/personal/PeopleList'
import { usePersonalPeople } from '@/hooks/personal/usePersonalPeople'
import { Contact } from '@/types'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Filter, SortAsc } from 'lucide-react'

// Define filter types matching the hook
type TimeFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'
type SortOption = 'LATEST' | 'MOST_ACTIVE'

export default function PeoplePage() {
    const router = useRouter()
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL')
    const [sortBy, setSortBy] = useState<SortOption>('LATEST')

    const { data: contacts, isLoading } = usePersonalPeople({
        timeFilter,
        sortBy
    })

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between px-1">
                <h1 className="text-2xl font-bold tracking-tight">People</h1>

                <div className="flex items-center gap-2">
                    {/* Time Filter */}
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

                    {/* Sort */}
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
            </div>

            <div className="flex-1 min-h-0">
                <PeopleList
                    contacts={contacts}
                    isLoading={isLoading}
                    title="Your People"
                    emptyMessage="No people found"
                    emptyDescription={timeFilter !== 'ALL' ? "Try changing the time filter." : "Add someone to start tracking."}
                    showAddButton={true}
                    onContactClick={(contact) => {
                        router.push(`/dashboard/people/${contact.id}`)
                    }}
                />
            </div>
        </div>
    )
}

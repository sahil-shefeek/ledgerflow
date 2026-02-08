'use client'

import { usePersonalPeople } from '@/hooks/personal/usePersonalPeople'
import { Contact } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddPersonDrawer } from './AddPersonDrawer'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

interface PeopleListProps {
    contacts?: Contact[]
    isLoading?: boolean
    title?: string
    showAddButton?: boolean
    onContactClick?: (contact: Contact) => void
    emptyMessage?: string
    emptyDescription?: string
}

export function PeopleList({
    contacts: propContacts,
    isLoading: propIsLoading,
    title = "People",
    showAddButton = true,
    onContactClick,
    emptyMessage = "No people found",
    emptyDescription = "Add someone to start tracking.",
}: PeopleListProps = {}) {
    // Fallback fetching if props not provided
    const { data: fetchedContacts, isLoading: isQueryLoading, error } = usePersonalPeople()
    const [searchQuery, setSearchQuery] = useState('')
    const router = useRouter()

    const contacts = propContacts ?? fetchedContacts
    const isLoading = propIsLoading ?? isQueryLoading

    if (isLoading) {
        return (
            <Card className="h-full border-0 shadow-none">
                <CardHeader className="px-4 pb-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-7 w-24" />
                        <Skeleton className="h-9 w-24" />
                    </div>

                    <Skeleton className="h-10 w-full" />

                    <div className="flex gap-2">
                        <Skeleton className="h-9 flex-1" />
                        <Skeleton className="h-9 flex-1" />
                        <Skeleton className="h-9 flex-1" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y relative">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-20" />
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error && !propContacts) {
        return (
            <div className="flex h-40 items-center justify-center text-destructive">
                Error loading people
            </div>
        )
    }

    const filteredContacts = contacts?.filter(contact => {
        const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesSearch
    })

    const handleContactClick = (contact: Contact) => {
        if (onContactClick) {
            onContactClick(contact)
        } else {
            router.push(`/dashboard/people/${contact.id}`)
        }
    }

    return (
        <Card className="h-full border-0 shadow-none">
            <CardHeader className="px-4 pb-2 space-y-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold">{title}</CardTitle>
                    {showAddButton && (
                        <AddPersonDrawer>
                            <Button size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Add New
                            </Button>
                        </AddPersonDrawer>
                    )}
                </div>

                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {filteredContacts?.length === 0 ? (
                        <Empty className="py-12">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Users />
                                </EmptyMedia>
                                <EmptyTitle>{emptyMessage}</EmptyTitle>
                                <EmptyDescription>
                                    {emptyDescription}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        filteredContacts?.map((contact) => (
                            <div
                                key={contact.id}
                                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => handleContactClick(contact)}
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar className="border border-muted">
                                        <AvatarImage src={contact.image_url || undefined} className="object-cover" />
                                        <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-medium flex items-center gap-2">
                                            {contact.name}
                                            {contact.transaction_count > 0 && (
                                                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-normal">
                                                    {contact.transaction_count} txns
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {contact.last_transaction_at ? formatDistanceToNow(new Date(contact.last_transaction_at), {
                                                addSuffix: true,
                                            }) : 'No transactions'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div
                                        className={cn(
                                            'font-bold',
                                            contact.net_balance > 0
                                                ? 'text-green-600'
                                                : contact.net_balance < 0
                                                    ? 'text-red-600'
                                                    : 'text-muted-foreground'
                                        )}
                                    >
                                        {contact.net_balance === 0
                                            ? 'Settled'
                                            : `₹${Math.abs(contact.net_balance).toLocaleString()}`}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {contact.net_balance > 0
                                            ? 'You will get'
                                            : contact.net_balance < 0
                                                ? 'You will give'
                                                : ''}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

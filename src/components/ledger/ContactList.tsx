import { useContacts } from '@/hooks/useContacts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddContactDrawer } from './AddContactDrawer'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function ContactList() {
    const { data: contacts, isLoading, error } = useContacts()
    const [searchQuery, setSearchQuery] = useState('')
    const [filter, setFilter] = useState('ALL')
    const router = useRouter()

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

    if (error) {
        return (
            <div className="flex h-40 items-center justify-center text-destructive">
                Error loading contacts
            </div>
        )
    }

    const filteredContacts = contacts?.filter(contact => {
        const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesFilter =
            filter === 'ALL' ? true :
                contact.type === filter

        return matchesSearch && matchesFilter
    })

    return (
        <Card className="h-full border-0 shadow-none">
            <CardHeader className="px-4 pb-2 space-y-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold">Contacts</CardTitle>
                    <AddContactDrawer>
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add New
                        </Button>
                    </AddContactDrawer>
                </div>

                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search contacts..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <ToggleGroup type="single" value={filter} onValueChange={(val) => val && setFilter(val)} className="justify-start w-full">
                    <ToggleGroupItem value="ALL" className="flex-1">All</ToggleGroupItem>
                    <ToggleGroupItem value="CUSTOMER" className="flex-1">Customers</ToggleGroupItem>
                    <ToggleGroupItem value="SUPPLIER" className="flex-1">Suppliers</ToggleGroupItem>
                </ToggleGroup>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {filteredContacts?.length === 0 ? (
                        <Empty className="py-12">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Users />
                                </EmptyMedia>
                                <EmptyTitle>No contacts found</EmptyTitle>
                                <EmptyDescription>
                                    Try adjusting your search or filters.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        filteredContacts?.map((contact) => (
                            <div
                                key={contact.id}
                                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => router.push(`/dashboard/ledger/${contact.id}`)}
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={`https://avatar.vercel.sh/${contact.name}`} />
                                        <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-medium">{contact.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(contact.last_transaction_at), {
                                                addSuffix: true,
                                            })}
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

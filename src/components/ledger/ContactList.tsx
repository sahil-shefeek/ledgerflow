'use client'

import { useContacts } from '@/hooks/useContacts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddContactDrawer } from './AddContactDrawer'

export function ContactList() {
    const { data: contacts, isLoading, error } = useContacts()

    if (isLoading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-40 items-center justify-center text-destructive">
                Error loading contacts
            </div>
        )
    }

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">Contacts</CardTitle>
                <AddContactDrawer>
                    <Button size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Add New
                    </Button>
                </AddContactDrawer>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {contacts?.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No contacts found. Add one to start.
                        </div>
                    ) : (
                        contacts?.map((contact) => (
                            <div
                                key={contact.id}
                                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
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

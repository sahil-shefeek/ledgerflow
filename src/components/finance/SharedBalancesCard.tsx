'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePersonalPeople } from '@/hooks/personal/usePersonalPeople'
import { Users, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'

export function SharedBalancesCard() {
    const router = useRouter()
    const { data: contacts, isLoading } = usePersonalPeople({
        sortBy: 'LATEST',
        timeFilter: 'ALL'
    })

    const { totalOwed, totalOwe, recentActive } = useMemo(() => {
        if (!contacts) return { totalOwed: 0, totalOwe: 0, recentActive: [] }

        let owed = 0
        let owe = 0
        const activeContacts = [...contacts]
            .filter(c => c.net_balance !== 0 || c.last_transaction_at)
            .sort((a, b) => {
                const dateA = a.last_transaction_at ? new Date(a.last_transaction_at).getTime() : 0;
                const dateB = b.last_transaction_at ? new Date(b.last_transaction_at).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, 3)

        contacts.forEach(c => {
            if (c.net_balance > 0) {
                owed += c.net_balance
            } else if (c.net_balance < 0) {
                owe += Math.abs(c.net_balance)
            }
        })

        return { totalOwed: owed, totalOwe: owe, recentActive: activeContacts }
    }, [contacts])

    return (
        <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">Shared Balances</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/friends')}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage People
                </Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col pt-4 overflow-hidden">
                {isLoading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="h-20 bg-muted rounded-xl w-full" />
                            <div className="h-20 bg-muted rounded-xl w-full" />
                        </div>
                        <div className="space-y-3 mt-4">
                            <div className="h-10 bg-muted rounded w-full" />
                            <div className="h-10 bg-muted rounded w-full" />
                            <div className="h-10 bg-muted rounded w-full" />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="flex flex-col space-y-1 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                                <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center">
                                    <ArrowDownLeft className="h-4 w-4 mr-1" />
                                    Get back
                                </span>
                                <span className="text-2xl font-bold text-green-700 dark:text-green-500">
                                    ₹{totalOwed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div className="flex flex-col space-y-1 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                                <span className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center">
                                    <ArrowUpRight className="h-4 w-4 mr-1" />
                                    You owe
                                </span>
                                <span className="text-2xl font-bold text-red-700 dark:text-red-500">
                                    ₹{totalOwe.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4 flex-1 flex flex-col">
                            <h4 className="text-sm font-medium text-muted-foreground">Recent Activity</h4>
                            {recentActive.length > 0 ? (
                                <div className="space-y-1 overflow-y-auto pr-2 pb-2">
                                    {recentActive.map(contact => (
                                        <div
                                            key={contact.id}
                                            className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                                            onClick={() => router.push(`/dashboard/friends/${contact.id}`)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={contact.image_url || undefined} />
                                                    <AvatarFallback>
                                                        {contact.name.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{contact.name}</span>
                                                    {contact.last_transaction_at && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatDistanceToNow(new Date(contact.last_transaction_at), { addSuffix: true })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                {contact.net_balance !== 0 ? (
                                                    <span className={`text-sm font-medium ${contact.net_balance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {contact.net_balance > 0 ? 'Owes you ' : 'You owe '}
                                                        ₹{Math.abs(contact.net_balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm font-medium text-muted-foreground">Settled up</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground text-center py-4">
                                    No recent activity.
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

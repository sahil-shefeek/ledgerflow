'use client'

import { useParams, useRouter } from 'next/navigation'
import { useContacts } from '@/hooks/useContacts'
import { useContactTransactions } from '@/hooks/useContactTransactions'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTransactionDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import { TransactionDrawer } from '@/components/ledger/TransactionDrawer'
import { useState } from 'react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Loader2 } from 'lucide-react'

export default function LedgerPage() {
    const params = useParams()
    const router = useRouter()
    const contactId = params.contactId as string
    const { data: contacts } = useContacts()
    const { data: transactions, isLoading } = useContactTransactions(contactId)
    const [drawerOpen, setDrawerOpen] = useState(false)

    const contact = contacts?.find(c => c.id === contactId)

    if (!contact) {
        return <div>Contact not found</div>
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">{contact.name}</h1>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">
                            {contact.net_balance > 0 ? 'You will get' : contact.net_balance < 0 ? 'You will give' : 'Settled'}
                        </div>
                        <div className={cn(
                            "text-4xl font-bold",
                            contact.net_balance > 0 ? "text-green-600" : contact.net_balance < 0 ? "text-red-600" : "text-muted-foreground"
                        )}>
                            ₹{Math.abs(contact.net_balance).toLocaleString()}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Transactions</h2>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : transactions?.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Receipt />
                            </EmptyMedia>
                            <EmptyTitle>No transactions yet</EmptyTitle>
                            <EmptyDescription>
                                Start tracking transactions with {contact.name}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <div className="space-y-4">
                        {transactions?.map((t) => (
                            <Card key={t.id}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="font-medium">{t.description || 'No description'}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatTransactionDate(new Date(t.date))}
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "font-bold",
                                        t.flow === 'IN' ? "text-green-600" : "text-red-600"
                                    )}>
                                        {t.flow === 'IN' ? '+' : '-'}₹{t.amount.toLocaleString()}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Button
                size="icon"
                className="fixed bottom-20 md:bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
                onClick={() => setDrawerOpen(true)}
            >
                <Plus className="h-6 w-6" />
            </Button>

            <TransactionDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                initialData={{ contact_id: contactId }}
            />
        </div>
    )
}

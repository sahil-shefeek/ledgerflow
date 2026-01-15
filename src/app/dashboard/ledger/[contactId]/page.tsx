'use client'

import { useParams, useRouter } from 'next/navigation'
import { useContacts } from '@/hooks/useContacts'
import { useContactTransactions } from '@/hooks/useContactTransactions'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Receipt, Filter, ArrowUpDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTransactionDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import { TransactionDrawer } from '@/components/ledger/TransactionDrawer'
import { TransactionDetailsDrawer } from '@/components/finance/TransactionDetailsDrawer'
import { useState, useMemo } from 'react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type TimeFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'
type SortOption = 'LATEST' | 'OLDEST' | 'HIGHEST' | 'LOWEST'

interface Transaction {
    id: string
    amount: number
    date: string
    flow: string
    description?: string
    note?: string
    category?: { name: string; icon: string } | null
    account?: { name: string } | null
    name?: string // For contact transactions sometimes name is used?
}

export default function LedgerPage() {
    const params = useParams()
    const router = useRouter()
    const contactId = params.contactId as string
    const { data: contacts } = useContacts()
    const { data: transactions, isLoading } = useContactTransactions(contactId)
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL')
    const [sortBy, setSortBy] = useState<SortOption>('LATEST')
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
    const [editOpen, setEditOpen] = useState(false)


    const contact = contacts?.find(c => c.id === contactId)

    const filteredTransactions = useMemo(() => {
        if (!transactions) return []

        let result = [...transactions]

        // Apply Time Filter
        const now = new Date()
        if (timeFilter === 'TODAY') {
            const start = startOfDay(now)
            result = result.filter(t => isAfter(new Date(t.date), start))
        } else if (timeFilter === 'WEEK') {
            const start = startOfWeek(now)
            result = result.filter(t => isAfter(new Date(t.date), start))
        } else if (timeFilter === 'MONTH') {
            const start = startOfMonth(now)
            result = result.filter(t => isAfter(new Date(t.date), start))
        } else if (timeFilter === 'YEAR') {
            const start = startOfYear(now)
            result = result.filter(t => isAfter(new Date(t.date), start))
        }

        // Apply Sorting
        result.sort((a, b) => {
            switch (sortBy) {
                case 'LATEST':
                    return new Date(b.date).getTime() - new Date(a.date).getTime()
                case 'OLDEST':
                    return new Date(a.date).getTime() - new Date(b.date).getTime()
                case 'HIGHEST':
                    return b.amount - a.amount
                case 'LOWEST':
                    return a.amount - b.amount
                default:
                    return 0
            }
        })

        return result
    }, [transactions, timeFilter, sortBy])

    if (!contact) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center">
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <div className="p-3 bg-muted rounded-full">
                                <ArrowLeft className="h-6 w-6 text-muted-foreground" />
                            </div>
                        </EmptyMedia>
                        <EmptyTitle>Contact Not Found</EmptyTitle>
                        <EmptyDescription>
                            The contact you are looking for does not exist or has been deleted.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button onClick={() => router.push('/dashboard')}>
                            Go Back to Dashboard
                        </Button>
                    </EmptyContent>
                </Empty>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-muted">
                        <AvatarImage src={contact.image_url || undefined} alt={contact.name} className="object-cover" />
                        <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h1 className="text-2xl font-bold tracking-tight">{contact.name}</h1>
                </div>
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
                    <div className="flex gap-2">
                        <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                            <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue placeholder="Filter" />
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
                            <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue placeholder="Sort" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LATEST">Latest</SelectItem>
                                <SelectItem value="OLDEST">Oldest</SelectItem>
                                <SelectItem value="HIGHEST">Highest Amount</SelectItem>
                                <SelectItem value="LOWEST">Lowest Amount</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredTransactions?.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Receipt />
                            </EmptyMedia>
                            <EmptyTitle>No transactions found</EmptyTitle>
                            <EmptyDescription>
                                Try adjusting your filters or add a new transaction.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <div className="space-y-4">
                        {filteredTransactions?.map((t) => (
                            <Card
                                key={t.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                    setSelectedTransaction(t)
                                    setDetailsOpen(true)
                                }}
                            >
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="font-medium">{t.description || t.name || 'No description'}</div>
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

            <TransactionDrawer
                initialData={{ contact_id: contactId }}
            />

            <TransactionDetailsDrawer
                transaction={selectedTransaction}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onEdit={(transaction) => {
                    setEditingTransaction(transaction)
                    setDetailsOpen(false)
                    setEditOpen(true)
                }}
            />

            <TransactionDrawer
                open={editOpen}
                onOpenChange={setEditOpen}
                initialData={editingTransaction}
                hideTrigger={true}
            />
        </div>
    )
}

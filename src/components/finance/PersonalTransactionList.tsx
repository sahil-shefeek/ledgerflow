import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Receipt, Filter, ArrowUpDown } from 'lucide-react'
import { formatTransactionDate } from '@/lib/date-utils'
import { TransactionDetailsDrawer } from './TransactionDetailsDrawer'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { TransactionDrawer } from '@/components/ledger/TransactionDrawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter } from 'date-fns'

interface PersonalTransaction {
    id: string
    amount: number
    flow: 'IN' | 'OUT'
    name: string
    note?: string
    date: string
    category: {
        name: string
        icon: string
    } | null
    account: {
        name: string
        type: string
    } | null
}

type TimeFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'
type SortOption = 'LATEST' | 'OLDEST' | 'HIGHEST' | 'LOWEST'

export function PersonalTransactionList() {
    const supabase = createClient()
    const [selectedTransaction, setSelectedTransaction] = useState<PersonalTransaction | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<PersonalTransaction | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL')
    const [sortBy, setSortBy] = useState<SortOption>('LATEST')

    const { data: transactions, isLoading } = useQuery({
        queryKey: ['personal-transactions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('transactions')
                .select(`
                    id,
                    amount,
                    amount,
                    flow,
                    name,
                    note,
                    date,
                    category_id,
                    account_id,
                    category:categories(name, icon),
                    account:accounts(name, type)
                `)
                .eq('mode', 'PERSONAL')
                .order('date', { ascending: false })
                .limit(100) // Increased limit for client-side filtering

            if (error) throw error
            return data as unknown as PersonalTransaction[]
        },
    })

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

    return (
        <>
            <Card className="flex flex-col">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle>Recent Transactions</CardTitle>
                        <div className="flex gap-2">
                            <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
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
                            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
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
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                    {isLoading ? (
                        <div className="space-y-4 h-full overflow-y-auto pr-2 pb-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-2">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="space-y-2">
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            ))}
                        </div>
                    ) : filteredTransactions?.length === 0 ? (
                        <Empty className="mt-8">
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
                        <div className="space-y-4 h-full overflow-y-auto pr-2 pb-4">
                            {filteredTransactions?.map((t) => (
                                <div
                                    key={t.id}
                                    className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                                    onClick={() => {
                                        setSelectedTransaction(t)
                                        setDetailsOpen(true)
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                                            {t.category?.icon || '💰'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm">
                                                    {t.name}
                                                </p>
                                                {t.category && (
                                                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5">
                                                        {t.category.name}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {formatTransactionDate(t.date)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`font-medium ${t.flow === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.flow === 'IN' ? '+' : '-'}₹{t.amount.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>



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
        </>
    )
}

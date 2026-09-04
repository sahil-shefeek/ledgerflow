import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getPersonalTransactionsAction } from '@/lib/actions/transactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Icon } from "@/components/ui/icon";
import { ReceiptIcon } from "@hugeicons/core-free-icons";
import { formatTransactionDate, filterAndSortTransactions } from '@/lib/date-utils'
import { TransactionDetailsDrawer } from './TransactionDetailsDrawer'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { PersonalTransactionDrawer } from '@/components/personal/PersonalTransactionDrawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { paiseToRupees } from "@/lib/currency";

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
    contact: {
        id: string
        name: string
    } | null
    mode: 'PERSONAL' | 'BUSINESS'
    group?: {
        id: string
        name: string
    } | null
}

type TimeFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'
type SortOption = 'LATEST' | 'OLDEST' | 'HIGHEST' | 'LOWEST'

interface PersonalTransactionListProps {
    onEdit?: (transaction: PersonalTransaction) => void
}

export function PersonalTransactionList({ onEdit }: PersonalTransactionListProps = {}) {
    const [selectedTransaction, setSelectedTransaction] = useState<PersonalTransaction | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<PersonalTransaction | null>(null)
    const [editDrawerOpen, setEditDrawerOpen] = useState(false)
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL')
    const [sortBy, setSortBy] = useState<SortOption>('LATEST')
    const router = useRouter()

    const { data: transactions, isLoading } = useQuery({
        queryKey: ['personal-transactions'],
        queryFn: async () => {
            const data = await getPersonalTransactionsAction()
            return data as unknown as PersonalTransaction[]
        },
    })

    const filteredTransactions = useMemo(() => {
        return filterAndSortTransactions(transactions, timeFilter, sortBy)
    }, [transactions, timeFilter, sortBy])

    return (
        <>
            <Card className="flex flex-col" data-testid="personal-transactions-card">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle>Recent Transactions</CardTitle>
                        <div className="flex gap-2">
                            <Select items={[ {value: 'ALL', label: 'All Time'}, {value: 'TODAY', label: 'Today'}, {value: 'WEEK', label: 'This Week'}, {value: 'MONTH', label: 'This Month'}, {value: 'YEAR', label: 'This Year'} ]} value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
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
                            <Select items={[ {value: 'LATEST', label: 'Latest'}, {value: 'OLDEST', label: 'Oldest'}, {value: 'HIGHEST', label: 'Highest Amount'}, {value: 'LOWEST', label: 'Lowest Amount'} ]} value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
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
                                    <Icon icon={ReceiptIcon} />
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
                                    data-testid="transaction-item"
                                    className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                                    onClick={() => {
                                        setSelectedTransaction(t)
                                        setDetailsOpen(true)
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                                            {t.category?.icon || (t.group ? '👥' : '💰')}
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
                                                {t.contact && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-[10px] px-1 py-0 h-5 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 hover:bg-purple-200 cursor-pointer flex items-center gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            router.push(`/dashboard/friends/${t.contact!.id}`)
                                                        }}
                                                    >
                                                        👤 {t.contact.name}
                                                    </Badge>
                                                )}
                                                {t.group && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-[10px] px-1 py-0 h-5 bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer flex items-center gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            router.push(`/dashboard/groups/${t.group!.id}`)
                                                        }}
                                                    >
                                                        👥 {t.group.name}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {formatTransactionDate(t.date)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`font-medium ${t.flow === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.flow === 'IN' ? '+' : '-'}₹{paiseToRupees(t.amount).toNumber().toLocaleString()}
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
                onEdit={(tx) => {
                    setDetailsOpen(false)
                    setEditingTransaction(tx)
                    setEditDrawerOpen(true)
                    onEdit?.(tx)
                }}
            />

            <PersonalTransactionDrawer
                open={editDrawerOpen}
                onOpenChange={setEditDrawerOpen}
                initialData={editingTransaction}
                hideTrigger={true}
            />
        </>
    )
}

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt } from 'lucide-react'
import { formatTransactionDate } from '@/lib/date-utils'
import { TransactionDetailsDrawer } from '@/components/finance/TransactionDetailsDrawer'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTransactions } from '@/hooks/useTransactions'
import { Transaction } from '@/types'

interface GroupTransactionListProps {
    groupId: string
    currentUserId: string
}

export function GroupTransactionList({ groupId, currentUserId }: GroupTransactionListProps) {
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    // Use our updated hook with groupId filter
    const { data, isLoading } = useTransactions({ groupId, mode: 'PERSONAL' })

    const transactions = useMemo(() => {
        if (!data) return []
        return data.pages.flatMap(page => page)
    }, [data])

    const getPayerDisplay = (transaction: Transaction) => {
        // If I paid
        if (transaction.payer_id === currentUserId) {
            return {
                name: 'You',
                avatar: null, // You can fetch your own avatar if needed, or handle in conditional
                isMe: true
            }
        }

        // If someone else paid
        // The transaction object from useTransactions includes `payer` relation
        // defined in the hook: payer:profiles!payer_id(full_name, avatar_url)
        // BUT strict Typescript might need us to check type or use 'any' if generic Transaction type doesn't have it fully typed yet
        // The `Transaction` type in `types.ts` has `payer_id`. It doesn't explicitly have `payer` object in the interface shown earlier.
        // However, the hook uses `.select('..., payer:profiles!payer_id(...)')`
        // So at runtime it is there. I will treat it safely.

        const payer = (transaction as any).payer
        return {
            name: payer?.full_name || 'Member',
            avatar: payer?.avatar_url,
            isMe: false
        }
    }

    return (
        <>
            <Card className="flex flex-col border-none shadow-none">
                <CardContent className="flex-1 overflow-hidden p-0">
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
                    ) : transactions.length === 0 ? (
                        <Empty className="mt-8">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Receipt />
                                </EmptyMedia>
                                <EmptyTitle>No expenses yet</EmptyTitle>
                                <EmptyDescription>
                                    Add an expense to split with the group.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        <div className="space-y-4 h-full overflow-y-auto pr-2 pb-4">
                            {transactions.map((t) => {
                                const payer = getPayerDisplay(t)

                                return (
                                    <div
                                        key={t.id}
                                        className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                                        onClick={() => {
                                            setSelectedTransaction(t)
                                            setDetailsOpen(true)
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Payer Avatar as primary icon */}
                                            <Avatar className="h-10 w-10 border">
                                                <AvatarImage src={payer.avatar || undefined} />
                                                <AvatarFallback>{payer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>

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
                                                    {payer.isMe ? 'You paid' : `${payer.name} paid`} • {formatTransactionDate(t.date)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-medium">
                                                ₹{t.amount.toLocaleString()}
                                            </span>
                                            {/* We could show "You borrowed" or "You lent" info here if we calculate user's split */}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <TransactionDetailsDrawer
                transaction={selectedTransaction}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onEdit={() => { }}
            />
        </>
    )
}

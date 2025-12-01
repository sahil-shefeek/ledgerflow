import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Receipt } from 'lucide-react'
import { formatTransactionDate } from '@/lib/date-utils'
import { TransactionDetailsDrawer } from './TransactionDetailsDrawer'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { TransactionDrawer } from '@/components/ledger/TransactionDrawer'

interface PersonalTransaction {
    id: string
    amount: number
    flow: 'IN' | 'OUT'
    description: string
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

export function PersonalTransactionList() {
    const supabase = createClient()
    const [selectedTransaction, setSelectedTransaction] = useState<PersonalTransaction | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<PersonalTransaction | null>(null)
    const [editOpen, setEditOpen] = useState(false)

    const { data: transactions, isLoading } = useQuery({
        queryKey: ['personal-transactions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('transactions')
                .select(`
                    id,
                    amount,
                    flow,
                    description,
                    date,
                    category_id,
                    account_id,
                    category:categories(name, icon),
                    account:accounts(name, type)
                `)
                .eq('mode', 'PERSONAL')
                .order('date', { ascending: false })
                .limit(20)

            if (error) throw error
            return data as unknown as PersonalTransaction[]
        },
    })

    return (
        <>
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : transactions?.length === 0 ? (
                        <Empty className="mt-8">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Receipt />
                                </EmptyMedia>
                                <EmptyTitle>No transactions yet</EmptyTitle>
                                <EmptyDescription>
                                    Add your first expense or income to start tracking.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {transactions?.map((t) => (
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
                                                    {t.description || 'Transaction'}
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
            />
        </>
    )
}

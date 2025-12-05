'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions'
import { useDeleteRecurringTransaction } from '@/hooks/useDeleteRecurringTransaction'
import { RecurringTransactionDrawer } from './RecurringTransactionDrawer'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Repeat, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export function RecurringTransactionsList() {
    const { data: transactions, isLoading } = useRecurringTransactions()
    const { mutate: deleteTransaction } = useDeleteRecurringTransaction()

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Subscriptions & Recurring</CardTitle>
                <RecurringTransactionDrawer>
                    <Button size="sm" variant="outline" className="h-8">
                        <Plus className="mr-2 h-4 w-4" />
                        Add
                    </Button>
                </RecurringTransactionDrawer>
            </CardHeader>
            <CardContent className="pt-6">
                {isLoading ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : transactions?.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Repeat />
                            </EmptyMedia>
                            <EmptyTitle>No recurring payments</EmptyTitle>
                            <EmptyDescription>
                                Set up subscriptions or salary to track them automatically.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                        {transactions?.map((t) => (
                            <div
                                key={t.id}
                                className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                                        {t.category?.icon || '🔄'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm">
                                                {t.name}
                                            </p>
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-5">
                                                {t.frequency}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Next: {format(new Date(t.next_run_date), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`font-medium ${t.flow === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.flow === 'IN' ? '+' : '-'}₹{t.amount.toLocaleString()}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => {
                                            if (confirm('Are you sure you want to delete this recurring payment?')) {
                                                deleteTransaction(t.id)
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

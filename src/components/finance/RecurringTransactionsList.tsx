'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions'
import { useDeleteRecurringTransaction } from '@/hooks/useDeleteRecurringTransaction'
import { useUpdateRecurringTransaction } from '@/hooks/useUpdateRecurringTransaction'
import { RecurringTransactionDrawer } from './RecurringTransactionDrawer'
import { ActionDrawer, ActionDrawerItem } from '@/components/ui/action-drawer'
import { Button } from '@/components/ui/button'
import { Icon } from "@/components/ui/icon";
import { LoaderIcon, RepeatIcon, TrashIcon, AlertCircleIcon, Edit04Icon, PlayIcon, PlusIcon } from "@hugeicons/core-free-icons";
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { paiseToRupees } from "@/lib/currency"
import { RecurringTransaction } from '@/types'

export function RecurringTransactionsList() {
    const { data: transactions, isLoading } = useRecurringTransactions()
    const { mutate: deleteTransaction } = useDeleteRecurringTransaction()
    const { mutate: updateTransaction, isPending: isUpdating } = useUpdateRecurringTransaction()
    const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null)
    const [editDrawerOpen, setEditDrawerOpen] = useState(false)

    const handleEdit = (transaction: RecurringTransaction) => {
        setEditingTransaction(transaction)
        setEditDrawerOpen(true)
    }

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this recurring payment?')) {
            deleteTransaction(id)
        }
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle>Subscriptions & Recurring</CardTitle>
                    <RecurringTransactionDrawer>
                        <Button size="sm" variant="outline" className="h-8">
                            <Icon icon={PlusIcon} className="mr-2 h-4 w-4" />
                            Add
                        </Button>
                    </RecurringTransactionDrawer>
                </CardHeader>
                <CardContent className="pt-6 @container">
                    {isLoading ? (
                        <div className="flex justify-center p-4">
                            <Icon icon={LoaderIcon} className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : transactions?.length === 0 ? (
                        <Empty>
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <Icon icon={RepeatIcon} />
                                </EmptyMedia>
                                <EmptyTitle>No recurring payments</EmptyTitle>
                                <EmptyDescription>
                                    Set up subscriptions or salary to track them automatically.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                            {transactions?.map((t) => {
                                const isPaused = !t.active || t.failure_count >= 3
                                const mobileActions: ActionDrawerItem[] = [
                                    ...(isPaused
                                        ? [
                                              {
                                                  label: 'Resume Subscription',
                                                  icon: PlayIcon,
                                                  onClick: () =>
                                                      updateTransaction({
                                                          id: t.id,
                                                          data: { active: true },
                                                      }),
                                              },
                                          ]
                                        : []),
                                    {
                                        label: 'Edit Subscription',
                                        icon: Edit04Icon,
                                        onClick: () => handleEdit(t),
                                    },
                                    {
                                        label: 'Delete Subscription',
                                        icon: TrashIcon,
                                        variant: 'destructive' as const,
                                        onClick: () => handleDelete(t.id),
                                    },
                                ]

                                return (
                                    <div
                                        key={t.id}
                                        data-testid="recurring-transaction-item"
                                        className={`flex flex-col gap-2 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors group ${
                                            isPaused ? 'border-destructive/50 bg-destructive/5' : ''
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                                                    {t.category?.icon || '🔄'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-medium text-sm">{t.name}</p>
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-5">
                                                            {t.frequency}
                                                        </Badge>
                                                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5">
                                                            {t.schedule_mode === 'FIXED_INTERVAL' ? 'FIXED' : 'CALENDAR'}
                                                        </Badge>
                                                        {isPaused && (
                                                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-5 flex items-center gap-1">
                                                                <Icon icon={AlertCircleIcon} className="h-3 w-3" /> Paused
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Next: {format(new Date(t.next_run_date), 'MMM d, yyyy')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium mr-1 ${t.flow === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {t.flow === 'IN' ? '+' : '-'}₹{paiseToRupees(t.amount).toNumber().toLocaleString()}
                                                </span>

                                                {/* Desktop actions: hover-revealed without degrading mobile */}
                                                <div data-testid="desktop-actions" className="desktop-actions hidden @sm:flex items-center gap-1">
                                                    {isPaused && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs px-2 text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                                                            disabled={isUpdating}
                                                            onClick={() =>
                                                                updateTransaction({
                                                                    id: t.id,
                                                                    data: { active: true },
                                                                })
                                                            }
                                                        >
                                                            <Icon icon={PlayIcon} className="h-3 w-3 mr-1" /> Resume
                                                        </Button>
                                                    )}

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                                                        onClick={() => handleEdit(t)}
                                                        aria-label={`Edit ${t.name}`}
                                                    >
                                                        <Icon icon={Edit04Icon} className="h-4 w-4" />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                                                        onClick={() => handleDelete(t.id)}
                                                        aria-label={`Delete ${t.name}`}
                                                    >
                                                        <Icon icon={TrashIcon} className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                {/* Mobile actions: explicit "..." button opening ActionDrawer Bottom Sheet */}
                                                <div className="flex @sm:hidden">
                                                    <ActionDrawer
                                                        title={t.name}
                                                        description={`${t.frequency} • ₹${paiseToRupees(t.amount).toNumber().toLocaleString()}`}
                                                        triggerAriaLabel={`More options for ${t.name}`}
                                                        actions={mobileActions}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {isPaused && t.last_failure_reason && (
                                            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded flex items-center gap-1.5">
                                                <Icon icon={AlertCircleIcon} className="h-3.5 w-3.5 shrink-0" />
                                                <span>Reason: {t.last_failure_reason}</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <RecurringTransactionDrawer
                open={editDrawerOpen}
                onOpenChange={setEditDrawerOpen}
                initialData={editingTransaction}
                hideTrigger={true}
            />
        </>
    )
}

'use client'

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { formatTransactionDate } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'
import { Trash2, Edit } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

import { BusinessTransactionDrawer } from '@/components/business/BusinessTransactionDrawer'
import { PersonalTransactionDrawer } from '@/components/personal/PersonalTransactionDrawer'

interface TransactionDetailsDrawerProps {
    transaction: {
        id: string
        amount: number
        date: string
        flow: string
        name: string
        note?: string | null
        category?: { name: string; icon: string } | null
        account?: { name: string } | null
        mode: 'BUSINESS' | 'PERSONAL'
        group_id?: string | null
    } | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onEdit: (transaction: any) => void
}

export function TransactionDetailsDrawer({ transaction, open, onOpenChange, onEdit }: TransactionDetailsDrawerProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [editOpen, setEditOpen] = useState(false)

    const handleEdit = () => {
        setEditOpen(true)
        if (onEdit) onEdit(transaction)
    }

    if (!transaction) return null

    const handleDelete = async () => {
        try {
            setIsDeleting(true)
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', transaction.id)

            if (error) throw error

            toast.success('Transaction deleted')
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['personal-transactions'] })
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            onOpenChange(false)
        } catch (error) {
            toast.error('Failed to delete transaction')
            console.error(error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Transaction Details</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 space-y-6">
                        <div className="text-center space-y-2">
                            <div className="text-4xl font-bold">
                                {transaction.flow === 'IN' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                            </div>
                            <div className="text-muted-foreground">
                                {formatTransactionDate(transaction.date)}
                            </div>
                        </div>

                        <div className="space-y-4 rounded-lg border p-4">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Category</span>
                                <span className="font-medium flex items-center gap-2">
                                    {transaction.category?.icon} {transaction.category?.name || 'Uncategorized'}
                                </span>
                            </div>
                            <div className="grid gap-1">
                                {transaction.name && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Description</span>
                                        <span className="font-medium">{transaction.name}</span>
                                    </div>
                                )}
                                {transaction.note && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Note</span>
                                        <span className="font-medium">{transaction.note}</span>
                                    </div>
                                )}
                                {transaction.account && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Account</span>
                                        <span className="font-medium">{transaction.account.name}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={handleEdit}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </div>

                            {transaction.group_id && (
                                <Button
                                    variant="ghost"
                                    className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => {
                                        onOpenChange(false)
                                        window.location.href = `/dashboard/groups/${transaction.group_id}`
                                    }}
                                >
                                    View Group Details
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DrawerContent>
            {transaction.mode === 'BUSINESS' ? (
                <BusinessTransactionDrawer
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    initialData={transaction}
                    hideTrigger={true}
                />
            ) : (
                <PersonalTransactionDrawer
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    initialData={transaction}
                    hideTrigger={true}
                />
            )}
        </Drawer>
    )
}

'use client'

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { formatTransactionDate } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'
import { Trash2, Edit } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

interface TransactionDetailsDrawerProps {
    transaction: any
    open: boolean
    onOpenChange: (open: boolean) => void
    onEdit: (transaction: any) => void
}

export function TransactionDetailsDrawer({ transaction, open, onOpenChange, onEdit }: TransactionDetailsDrawerProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const supabase = createClient()
    const queryClient = useQueryClient()

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
            queryClient.invalidateQueries({ queryKey: ['personal-transactions'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
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
                            {transaction.description && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Description</span>
                                    <span className="font-medium">{transaction.description}</span>
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
                                onClick={() => onEdit(transaction)}
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
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

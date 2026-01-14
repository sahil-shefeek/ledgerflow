'use client'

import { useState } from 'react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface CategoryActionDialogProps {
    category: { id: string; name: string; type: 'INCOME' | 'EXPENSE'; icon: string } | null
    action: 'DELETE' | 'DISABLE' | null
    onClose: () => void
}

export function CategoryActionDialog({ category, action, onClose }: CategoryActionDialogProps) {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [isPending, setIsPending] = useState(false)
    const [targetCategoryId, setTargetCategoryId] = useState<string>('uncategorized')

    // Fetch transaction count for this category
    const { data: transactionCount, isLoading: countLoading } = useQuery({
        queryKey: ['category-transaction-count', category?.id],
        queryFn: async () => {
            if (!category?.id) return 0
            const { count, error } = await supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('category_id', category.id)

            if (error) throw error
            return count || 0
        },
        enabled: !!category?.id
    })

    // Fetch other categories for "Move to" option
    const { data: otherCategories } = useQuery({
        queryKey: ['other-categories', category?.id],
        queryFn: async () => {
            if (!category) return []
            const { data } = await supabase
                .from('categories')
                .select('id, name, icon')
                .neq('id', category.id)
                .eq('type', category.type) // Only same type
                .eq('active', true)
            return data || []
        },
        enabled: !!category?.id
    })

    const handleAction = async () => {
        if (!category) return
        setIsPending(true)

        try {
            // 1. Handle Transactions if any
            if (transactionCount && transactionCount > 0) {
                if (targetCategoryId === 'uncategorized') {
                    // Set category_id to null
                    const { error } = await supabase
                        .from('transactions')
                        .update({ category_id: null })
                        .eq('category_id', category.id)
                    if (error) throw error
                } else {
                    // Move to target category
                    const { error } = await supabase
                        .from('transactions')
                        .update({ category_id: targetCategoryId })
                        .eq('category_id', category.id)
                    if (error) throw error
                }
            }

            // 2. Perform Action (Delete or Disable)
            if (action === 'DELETE') {
                const { error } = await supabase
                    .from('categories')
                    .delete()
                    .eq('id', category.id)
                if (error) throw error
                toast.success('Category deleted')
            } else {
                const { error } = await supabase
                    .from('categories')
                    .update({ active: false })
                    .eq('id', category.id)
                if (error) throw error
                toast.success('Category disabled')
            }

            queryClient.invalidateQueries({ queryKey: ['categories'] })
            onClose()
        } catch (error: unknown) {
            if (error instanceof Error) {
                toast.error(error.message)
            } else {
                toast.error('An unknown error occurred')
            }
        } finally {
            setIsPending(false)
        }
    }

    if (!category || !action) return null

    const hasTransactions = transactionCount && transactionCount > 0

    return (
        <AlertDialog open={!!action} onOpenChange={() => onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {action === 'DELETE' ? 'Delete Category' : 'Disable Category'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to {action === 'DELETE' ? 'delete' : 'disable'} <strong>{category.name}</strong>?
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {countLoading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : hasTransactions ? (
                    <div className="py-4 space-y-4">
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-sm text-yellow-600 dark:text-yellow-400">
                            Warning: This category has <strong>{transactionCount}</strong> associated transactions.
                        </div>

                        <div className="space-y-2">
                            <Label>What should happen to these transactions?</Label>
                            <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="uncategorized">Remove Category (Uncategorized)</SelectItem>
                                    {otherCategories?.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>
                                            Move to {cat.icon} {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ) : (
                    <div className="py-2 text-sm text-muted-foreground">
                        No transactions found. Safe to {action === 'DELETE' ? 'delete' : 'disable'}.
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <Button variant="destructive" onClick={handleAction} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {action === 'DELETE' ? 'Delete' : 'Disable'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'

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
}

export function PersonalTransactionList() {
    const supabase = createClient()

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
                    category:categories(name, icon)
                `)
                .eq('mode', 'PERSONAL')
                .order('date', { ascending: false })
                .limit(20)

            if (error) throw error
            return data as unknown as PersonalTransaction[]
        },
    })

    return (
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
                    <div className="text-center text-sm text-muted-foreground py-8">
                        No transactions yet
                    </div>
                ) : (
                    <div className="space-y-4">
                        {transactions?.map((t) => (
                            <div key={t.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
                                        {t.category?.icon || '💰'}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            {t.description || t.category?.name || 'Uncategorized'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(t.date), 'MMM d, yyyy')}
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
    )
}

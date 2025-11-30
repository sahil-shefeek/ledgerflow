'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface BudgetCardProps {
    category: string
    spent: number
    limit: number
}

export function BudgetCard({ category, spent, limit }: BudgetCardProps) {
    const percentage = Math.min((spent / limit) * 100, 100)

    let statusColor = 'bg-green-500'
    if (percentage > 85) statusColor = 'bg-red-500'
    else if (percentage > 50) statusColor = 'bg-yellow-500'

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{category}</CardTitle>
                <span className="text-xs text-muted-foreground">
                    ₹{spent.toLocaleString()} / ₹{limit.toLocaleString()}
                </span>
            </CardHeader>
            <CardContent>
                <Progress value={percentage} className="h-2" indicatorClassName={statusColor} />
                <p className="mt-2 text-xs text-muted-foreground">
                    {percentage.toFixed(0)}% used
                </p>
            </CardContent>
        </Card>
    )
}

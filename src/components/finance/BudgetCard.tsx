'use client'


import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export interface BudgetCardProps {
    category: string
    spent: number
    limit: number | null
}

export function BudgetRow({ category, spent, limit }: BudgetCardProps) {
    const hasLimit = limit !== null && limit > 0
    const percentage = hasLimit ? Math.min((spent / (limit as number)) * 100, 100) : 0

    let statusColor = 'bg-green-500'
    if (percentage > 85) statusColor = 'bg-red-500'
    else if (percentage > 50) statusColor = 'bg-yellow-500'

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{category}</span>
                <span className="text-muted-foreground">
                    ₹{spent.toLocaleString()} {hasLimit ? `/ ₹${limit?.toLocaleString()}` : ''}
                </span>
            </div>
            {hasLimit && <Progress value={percentage} className="h-2" indicatorClassName={statusColor} />}
        </div>
    )
}

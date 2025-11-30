'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { ContributeGoalDrawer } from './ContributeGoalDrawer'

interface GoalCardProps {
    id: string
    name: string
    current: number
    target: number
    deadline: Date
}

export function GoalCard({ id, name, current, target, deadline }: GoalCardProps) {
    const percentage = Math.min((current / target) * 100, 100)
    const daysRemaining = Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    const dailySavingNeeded = Math.max(0, (target - current) / daysRemaining)

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{name}</CardTitle>
                <ContributeGoalDrawer goalId={id} goalName={name}>
                    <Button size="icon" variant="ghost" className="h-6 w-6">
                        <Plus className="h-4 w-4" />
                    </Button>
                </ContributeGoalDrawer>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₹{current.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                    of ₹{target.toLocaleString()}
                </p>
                <Progress value={percentage} className="mt-4 h-2" />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{percentage.toFixed(0)}%</span>
                    <span>{daysRemaining} days left</span>
                </div>
                <div className="mt-4 rounded-md bg-muted p-2 text-xs">
                    Save <strong>₹{dailySavingNeeded.toFixed(0)}</strong> / day to reach goal
                </div>
            </CardContent>
        </Card>
    )
}

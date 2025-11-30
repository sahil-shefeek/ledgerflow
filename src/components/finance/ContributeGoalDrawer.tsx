'use client'

import { useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useContributeGoal } from '@/hooks/useContributeGoal'
import { Loader2, Plus } from 'lucide-react'

interface ContributeGoalDrawerProps {
    goalId: string
    goalName: string
    children: React.ReactNode
}

export function ContributeGoalDrawer({ goalId, goalName, children }: ContributeGoalDrawerProps) {
    const [open, setOpen] = useState(false)
    const [amount, setAmount] = useState('')
    const { mutate: contribute, isPending } = useContributeGoal()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const val = parseFloat(amount)
        if (!val || val <= 0) return

        contribute({ id: goalId, amount: val }, {
            onSuccess: () => {
                setOpen(false)
                setAmount('')
            }
        })
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {children}
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Add to {goalName}</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Amount to Save</Label>
                                <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isPending || !amount}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Funds
                            </Button>
                        </form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

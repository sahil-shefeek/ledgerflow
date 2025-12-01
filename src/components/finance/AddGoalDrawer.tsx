'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useAddGoal } from '@/hooks/useAddGoal'
import { Loader2, Plus } from 'lucide-react'

const goalSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    target_amount: z.coerce.number().min(1, 'Target must be greater than 0'),
    deadline: z.coerce.date(),
})

export function AddGoalDrawer({ children }: { children?: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const { mutate: addGoal, isPending } = useAddGoal()

    const form = useForm({
        resolver: zodResolver(goalSchema),
        defaultValues: {
            name: '',
            target_amount: 0,
            deadline: new Date(),
        },
    })

    function onSubmit(values: z.infer<typeof goalSchema>) {
        addGoal(values, {
            onSuccess: () => {
                setOpen(false)
                form.reset()
            },
        })
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {children || (
                    <Button size="sm" variant="outline" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Goal
                    </Button>
                )}
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>New Savings Goal</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Goal Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="New Laptop" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="target_amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Target Amount (₹)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="50000"
                                                    {...field}
                                                    value={field.value as number}
                                                    onChange={e => field.onChange(e.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deadline"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Target Date</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="date"
                                                    {...field}
                                                    value={field.value instanceof Date ? field.value.toISOString().split('T')[0] : ''}
                                                    onChange={e => field.onChange(new Date(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Goal
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

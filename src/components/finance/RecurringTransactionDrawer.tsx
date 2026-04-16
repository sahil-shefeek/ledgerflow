'use client'

import { useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAddRecurringTransaction } from '@/hooks/useAddRecurringTransaction'
import { useAccounts } from '@/hooks/useAccounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { Loader2, Plus } from 'lucide-react'
import { useBudgets } from '@/hooks/useBudgets'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const recurringSchema = z.object({
    amount: z.coerce.number().min(1, 'Amount must be greater than 0'),
    name: z.string().min(1, 'Name is required'),
    note: z.string().optional(),
    category_id: z.string().optional(),
    account_id: z.string().min(1, 'Account is required'),
    start_date: z.coerce.date(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    flow: z.enum(['IN', 'OUT']),
})

export function RecurringTransactionDrawer({
    children
}: {
    children?: React.ReactNode
}) {
    const { data: budgets } = useBudgets()
    const { data: accounts } = useAccounts()
    const { mutate: addRecurring, isPending } = useAddRecurringTransaction()
    const [open, setOpen] = useState(false)
    const [flow, setFlow] = useState<'IN' | 'OUT'>('OUT')

    const form = useForm({
        resolver: zodResolver(recurringSchema),
        defaultValues: {
            amount: '' as unknown as number,
            name: '',
            note: '',
            start_date: new Date(),
            frequency: 'MONTHLY' as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
            flow: 'OUT' as 'IN' | 'OUT',
        },
    })



    // Better way to handle submit with user_id
    const handleSubmit = async (values: z.infer<typeof recurringSchema>) => {
        if (!values.category_id && flow === 'OUT') {
            toast.error('Please select a category')
            return
        }

        // Get current user
        // We can't easily get it here without a hook.
        // I'll assume the hook `useAddRecurringTransaction` handles it or I need to pass it.
        // Let's update `useAddRecurringTransaction` to attach user_id if missing?
        // Or just use `supabase.auth.getUser()` here.

        // Actually, let's just use the client to get the user.
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            toast.error('You must be logged in')
            return
        }

        const data = {
            ...values,
            flow,
            user_id: user.id,
            next_run_date: values.start_date.toISOString(),
        }

        addRecurring({ ...data, start_date: data.start_date.toISOString() }, {
            onSuccess: () => {
                setOpen(false)
                form.reset()
                setFlow('OUT')
                toast.success('Subscription added')
            }
        })
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {children || (
                    <Button size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Subscription
                    </Button>
                )}
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>Add Recurring Payment</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8">
                        <Tabs defaultValue="OUT" className="w-full mb-4" onValueChange={(v) => setFlow(v as 'IN' | 'OUT')}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="OUT">Expense</TabsTrigger>
                                <TabsTrigger value="IN">Income</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount (₹)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="0.00"
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
                                    name="frequency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Frequency</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select frequency" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="DAILY">Daily</SelectItem>
                                                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                                                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                                                    <SelectItem value="YEARLY">Yearly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {flow === 'OUT' && (
                                    <FormField
                                        control={form.control}
                                        name="category_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Category</FormLabel>
                                                <FormControl>
                                                    <ToggleGroup
                                                        type="single"
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        className="justify-start flex-wrap gap-2"
                                                    >
                                                        {budgets?.map((cat) => (
                                                            <ToggleGroupItem
                                                                key={cat.id}
                                                                value={cat.id}
                                                                aria-label={cat.name}
                                                                className="h-9 px-3 border border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                                            >
                                                                <span className="mr-2">{cat.icon}</span>
                                                                {cat.name}
                                                            </ToggleGroupItem>
                                                        ))}
                                                    </ToggleGroup>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                <FormField
                                    control={form.control}
                                    name="account_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Account</FormLabel>
                                            <FormControl>
                                                <ToggleGroup
                                                    type="single"
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    className="justify-start flex-wrap gap-2"
                                                >
                                                    {accounts?.map((acc) => (
                                                        <ToggleGroupItem
                                                            key={acc.id}
                                                            value={acc.id}
                                                            aria-label={acc.name}
                                                            className="h-9 px-3 border border-input data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                                        >
                                                            {acc.name}
                                                        </ToggleGroupItem>
                                                    ))}
                                                </ToggleGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="start_date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Start Date</FormLabel>
                                            <DateTimePicker
                                                date={field.value as Date | undefined}
                                                setDate={field.onChange}
                                            />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Netflix, Rent, etc." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="note"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Note (Optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Shared plan, etc." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Subscription
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

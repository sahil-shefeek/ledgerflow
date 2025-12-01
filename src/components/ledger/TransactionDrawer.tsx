'use client'

import { useState, useEffect } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAddTransaction } from '@/hooks/useAddTransaction'
import { useUpdateTransaction } from '@/hooks/useUpdateTransaction'
import { useAccounts } from '@/hooks/useAccounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Loader2, Minus, Plus } from 'lucide-react'
import { useContacts } from '@/hooks/useContacts'
import { useAppStore } from '@/store/useAppStore'
import { useBudgets } from '@/hooks/useBudgets'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { format } from 'date-fns'
import { DateTimePicker } from '@/components/ui/date-time-picker'

const transactionSchema = z.object({
    amount: z.coerce.number().min(1, 'Amount must be greater than 0'),
    description: z.string().optional(),
    contact_id: z.string().optional(),
    category_id: z.string().optional(),
    account_id: z.string().optional(),
    date: z.coerce.date(),
    due_date: z.coerce.date().optional(),
    flow: z.enum(['IN', 'OUT']),
})

export function TransactionDrawer({
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    initialData
}: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: any
} = {}) {
    const { mode } = useAppStore()
    const { data: contacts } = useContacts()
    const { data: budgets } = useBudgets() // We use budgets to get categories
    const { data: accounts } = useAccounts()
    const { mutate: addTransaction, isPending: isAdding } = useAddTransaction()
    const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction()
    const isPending = isAdding || isUpdating
    const [internalOpen, setInternalOpen] = useState(false)

    const open = controlledOpen ?? internalOpen
    const setOpen = setControlledOpen ?? setInternalOpen

    const [flow, setFlow] = useState<'IN' | 'OUT'>('OUT')

    const form = useForm({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            amount: '' as any,
            description: '',
            date: new Date(),
            flow: 'OUT' as 'IN' | 'OUT',
        },
    })

    // Effect to populate form when initialData changes
    useEffect(() => {
        if (initialData) {
            form.reset({
                amount: initialData.amount,
                description: initialData.description || '',
                date: new Date(initialData.date),
                flow: initialData.flow,
                contact_id: initialData.contact_id,
                category_id: initialData.category_id,
                account_id: initialData.account_id,
            })
            setFlow(initialData.flow)
        }
    }, [initialData, form])

    function onSubmit(values: any) {
        if (mode === 'business' && !values.contact_id) {
            toast.error('Please select a contact')
            return
        }
        if (mode === 'personal' && !values.category_id && flow === 'OUT') {
            toast.error('Please select a category')
            return
        }
        if (mode === 'personal' && !values.account_id) {
            toast.error('Please select an account')
            return
        }

        const transactionData = {
            ...values,
            mode: mode === 'business' ? 'BUSINESS' : 'PERSONAL',
            flow: flow,
        }

        const options = {
            onSuccess: () => {
                setOpen(false)
                form.reset({
                    amount: '' as any,
                    description: '',
                    date: new Date(),
                    flow: 'OUT',
                })
                setFlow('OUT') // Reset flow default
                toast.success(initialData?.id ? 'Transaction updated' : 'Transaction saved')
            },
            onError: (error: any) => {
                toast.error(`Failed to save: ${error.message}`)
            }
        }

        if (initialData?.id) {
            updateTransaction({ ...transactionData, id: initialData.id }, options)
        } else {
            addTransaction(transactionData, options)
        }
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button
                    size="icon"
                    className="fixed bottom-20 md:bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
                >
                    <Plus className="h-6 w-6" />
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>
                            {mode === 'business' ? 'New Transaction' : 'Add Expense / Income'}
                        </DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8">
                        <Tabs defaultValue="OUT" className="w-full mb-4" onValueChange={(v) => setFlow(v as 'IN' | 'OUT')}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="OUT" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-900">
                                    {mode === 'business' ? 'You Gave' : 'Expense'}
                                </TabsTrigger>
                                <TabsTrigger value="IN" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-900">
                                    {mode === 'business' ? 'You Got' : 'Income'}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                                {mode === 'business' ? (
                                    <FormField
                                        control={form.control}
                                        name="contact_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select contact" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {contacts?.map((contact) => (
                                                            <SelectItem key={contact.id} value={contact.id}>
                                                                {contact.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ) : (
                                    <>
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
                                                                    {acc.name} (₹{acc.balance})
                                                                </ToggleGroupItem>
                                                            ))}
                                                        </ToggleGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </>
                                )}

                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Date & Time</FormLabel>
                                            <DateTimePicker
                                                date={field.value as Date | undefined}
                                                setDate={field.onChange}
                                            />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {mode === 'business' && (
                                    <FormField
                                        control={form.control}
                                        name="due_date"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Due Date (Optional)</FormLabel>
                                                <DateTimePicker
                                                    date={field.value as Date | undefined}
                                                    setDate={field.onChange}
                                                />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description (Optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Dinner, Taxi, etc." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Transaction
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAddTransaction } from '@/hooks/useAddTransaction'
import { useUpdateTransaction } from '@/hooks/useUpdateTransaction'
import { useContacts } from '@/hooks/useContacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Loader2, Plus } from 'lucide-react'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const businessTransactionSchema = z.object({
    amount: z.coerce.number().min(1, 'Amount must be greater than 0'),
    name: z.string().min(1, 'Name is required'),
    note: z.string().optional(),
    contact_id: z.string().min(1, 'Contact is required'),
    date: z.coerce.date(),
    due_date: z.coerce.date().optional(),
    flow: z.enum(['IN', 'OUT']),
    // These fields are not used in Business mode but returned by DB as null
    category_id: z.string().nullable().optional(),
    account_id: z.string().nullable().optional(),
})

export function BusinessTransactionDrawer({
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    initialData,
    hideTrigger
}: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: any // eslint-disable-line @typescript-eslint/no-explicit-any
    hideTrigger?: boolean
} = {}) {
    const { data: contacts } = useContacts()
    const { mutate: addTransaction, isPending: isAdding } = useAddTransaction()
    const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction()
    const isPending = isAdding || isUpdating
    const [internalOpen, setInternalOpen] = useState(false)

    const open = controlledOpen ?? internalOpen
    const setOpen = setControlledOpen ?? setInternalOpen

    const [flow, setFlow] = useState<'IN' | 'OUT'>('OUT')

    const form = useForm({
        resolver: zodResolver(businessTransactionSchema),
        defaultValues: {
            amount: '' as any,
            name: '',
            note: '',
            date: new Date(),
            flow: 'OUT',
            contact_id: '',
        } as any,
    })

    // Effect to populate form when initialData changes
    useEffect(() => {
        if (initialData) {
            form.reset({
                amount: initialData.amount ?? ('' as unknown as number),
                name: initialData.name || '',
                note: initialData.note || '',
                date: initialData.date ? new Date(initialData.date) : new Date(),
                flow: initialData.flow || 'OUT',
                contact_id: initialData.contact_id || '',
                due_date: initialData.due_date ? new Date(initialData.due_date) : undefined,
                category_id: initialData.category_id,
                account_id: initialData.account_id,
            })
            if (initialData.flow) {
                setTimeout(() => setFlow(initialData.flow), 0)
            }
        }
    }, [initialData, form])

    function onSubmit(values: z.infer<typeof businessTransactionSchema>) {
        const transactionData = {
            ...values,
            mode: 'BUSINESS' as const,
            flow: flow,
        }

        const options = {
            onSuccess: () => {
                setOpen(false)
                form.reset({
                    amount: '' as unknown as number,
                    name: '',
                    note: '',
                    date: new Date(),
                    flow: 'OUT',
                    contact_id: '',
                })
                setFlow('OUT') // Reset flow default
                toast.success(initialData?.id ? 'Transaction updated' : 'Transaction saved')
            },
            onError: (error: Error) => {
                toast.error(`Failed to save: ${error.message}`)
            }
        }

        if (initialData?.id) {
            // @ts-ignore - types mismatch on optional fields but runtime is fine
            updateTransaction({ ...transactionData, id: initialData.id }, options)
        } else {
            // @ts-ignore
            addTransaction(transactionData, options)
        }
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            {!hideTrigger && (
                <DrawerTrigger asChild>
                    <Button
                        size="default"
                        className="fixed bottom-20 md:bottom-6 right-6 shadow-lg z-40 rounded-full h-14 px-6"
                    >
                        <Plus className="h-6 w-6 mr-2" />
                        <span className="hidden md:inline">Add Transaction</span>
                        <span className="md:hidden">Add</span>
                    </Button>
                </DrawerTrigger>
            )}
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>New Transaction</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8">
                        <Tabs defaultValue="OUT" className="w-full mb-4" onValueChange={(v) => {
                            setFlow(v as 'IN' | 'OUT')
                            form.setValue('flow', v as 'IN' | 'OUT')
                        }} value={flow}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger
                                    value="OUT"
                                    className="data-[state=active]:bg-red-100 data-[state=active]:text-red-900 dark:data-[state=active]:bg-red-900/50 dark:data-[state=active]:text-red-100"
                                >
                                    You Gave
                                </TabsTrigger>
                                <TabsTrigger
                                    value="IN"
                                    className="data-[state=active]:bg-green-100 data-[state=active]:text-green-900 dark:data-[state=active]:bg-green-900/50 dark:data-[state=active]:text-green-100"
                                >
                                    You Got
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

                                <FormField
                                    control={form.control}
                                    name="contact_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contact</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
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

                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Payment for goods, Invoice #123"
                                                    {...field}
                                                />
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
                                                <Input
                                                    placeholder="Payment details, etc."
                                                    {...field}
                                                />
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

"use client"
import { useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from '@/components/ui/toast'
import { useAddTransaction } from '@/hooks/useAddTransaction'
import { useUpdateTransaction } from '@/hooks/useUpdateTransaction'
import { useBusinessContacts } from '@/hooks/business/useBusinessContacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Icon } from "@/components/ui/icon";
import { LoaderIcon, PlusIcon } from "@hugeicons/core-free-icons";
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { paiseToRupees } from '@/lib/currency'
import { getDefaultAccount } from '@/lib/account-utils'

const businessTransactionSchema = z.object({
    amount: z.any().transform(v => (v === '' || v === undefined || v === null ? undefined : Number(v))).superRefine((val, ctx) => {
        if (val === undefined) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'How much was this for?' });
        } else if (Number.isNaN(val)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please enter a valid number' });
        } else if (val <= 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount must be greater than zero' });
        }
    }),
    name: z.string().trim().min(1, 'What was this for? Please add a title'),
    note: z.string().optional(),
    contact_id: z.string().min(1, 'Who is this transaction with?'),
    date: z.coerce.date(),
    due_date: z.coerce.date().optional(),
    flow: z.enum(['IN', 'OUT']),
    // These fields are not used in Business mode but returned by DB as null
    category_id: z.string().nullable().optional(),
    account_id: z.string().nullable().optional(),
})

export function getBusinessTransactionFormDefaults(initialData?: any, accounts?: any[] | null) {
    const initialAmountInRupees = initialData?.amount !== undefined && initialData?.amount !== null
        ? paiseToRupees(initialData.amount).toNumber()
        : ('' as unknown as number)

    const defaultAcc = getDefaultAccount(accounts)

    return {
        amount: initialAmountInRupees,
        name: initialData?.name || '',
        note: initialData?.note || '',
        date: initialData?.date ? new Date(initialData.date) : new Date(),
        flow: (initialData?.flow as 'IN' | 'OUT') || 'OUT',
        contact_id: initialData?.contact_id || initialData?.contact?.id || '',
        due_date: initialData?.due_date ? new Date(initialData.due_date) : undefined,
        category_id: initialData?.category_id || initialData?.category?.id || null,
        account_id: initialData?.account_id || initialData?.account?.id || defaultAcc?.id || null,
    }
}

export function BusinessTransactionDrawer({
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    initialData,
    hideTrigger,
    hideContactSelect,
}: {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: any // eslint-disable-line @typescript-eslint/no-explicit-any
    hideTrigger?: boolean
    hideContactSelect?: boolean
} = {}) {
    const { data: contacts } = useBusinessContacts()
    const { mutate: addTransaction, isPending: isAdding } = useAddTransaction()
    const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction()
    const isPending = isAdding || isUpdating
    const [internalOpen, setInternalOpen] = useState(false)

    const open = controlledOpen ?? internalOpen
    const setOpen = setControlledOpen ?? setInternalOpen

    const defaultValues = getBusinessTransactionFormDefaults(initialData)
    const [flow, setFlow] = useState<'IN' | 'OUT'>(defaultValues.flow)

    const form = useForm({
        resolver: zodResolver(businessTransactionSchema),
        defaultValues: defaultValues as any,
    })

    const resetFormValues = (nextOpen: boolean) => {
        if (nextOpen) {
            const defaults = getBusinessTransactionFormDefaults(initialData)
            form.reset(defaults as any)
            setFlow(defaults.flow)
        }
    }

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen)
        resetFormValues(nextOpen)
    }

    function onSubmit(values: z.infer<typeof businessTransactionSchema>) {
        const transactionData = {
            ...values,
            contact_id: values.contact_id || initialData?.contact_id || '',
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

    const currentContactId = form.watch('contact_id') || initialData?.contact_id
    const selectedContact = contacts?.find(c => c.id === currentContactId)
    const contactDisplayName = selectedContact?.name || initialData?.contact_name || initialData?.contact?.name

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            {!hideTrigger && (
                <DrawerTrigger render={<Button
                        size="default"
                        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-[calc(1.5rem+env(safe-area-inset-right,0px))] shadow-lg z-40 rounded-full h-14 px-6"
                     />}>
                        <Icon icon={PlusIcon} className="h-6 w-6 mr-2" />
                        <span className="hidden md:inline">Add Transaction</span>
                        <span className="md:hidden">Add</span>
                    </DrawerTrigger>
            )}
            <DrawerContent className="max-h-[90dvh]">
                <div className="mx-auto w-full max-w-sm flex flex-col min-h-0 max-h-[90dvh]">
                    <DrawerHeader className="shrink-0">
                        <DrawerTitle>New Transaction</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8 overflow-y-auto flex-1 min-h-0">
                        <Tabs defaultValue="OUT" className="w-full mb-4" onValueChange={(v) => {
                            setFlow(v as 'IN' | 'OUT')
                            form.setValue('flow', v as 'IN' | 'OUT')
                        }} value={flow}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger
                                    value="OUT"
                                    className="data-active:bg-red-100 data-active:text-red-900 dark:data-active:bg-red-900/50 dark:data-active:text-red-100"
                                >
                                    You Gave
                                </TabsTrigger>
                                <TabsTrigger
                                    value="IN"
                                    className="data-active:bg-green-100 data-active:text-green-900 dark:data-active:bg-green-900/50 dark:data-active:text-green-100"
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

                                {!hideContactSelect ? (
                                    <FormField
                                        control={form.control}
                                        name="contact_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact</FormLabel>
                                                <Select items={contacts?.map((i: any) => ({ value: i.id || i.value || String(i), label: i.name || i.label || String(i) })) || []} onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
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
                                ) : (contactDisplayName || currentContactId) ? (
                                    <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg text-sm border border-border/50">
                                        <span className="text-muted-foreground">Contact</span>
                                        <span className="font-semibold text-foreground">{contactDisplayName || 'Selected Contact'}</span>
                                    </div>
                                ) : null}

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
                                    {isPending && <Icon icon={LoaderIcon} className="mr-2 h-4 w-4 animate-spin" />}
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

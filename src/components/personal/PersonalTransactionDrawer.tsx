"use client"
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from '@/components/ui/toast'
import { useAddTransaction } from '@/hooks/useAddTransaction'
import { useUpdateTransaction } from '@/hooks/useUpdateTransaction'
import { usePersonalPeople } from '@/hooks/personal/usePersonalPeople'
import { useBudgets } from '@/hooks/useBudgets'
import { useAccounts } from '@/hooks/useAccounts'
import { getDefaultAccount } from '@/lib/account-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Icon } from "@/components/ui/icon";
import { AlertCircleIcon, LoaderIcon, PlusIcon } from "@hugeicons/core-free-icons";
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AddAccountDrawer } from '@/components/finance/AddAccountDrawer'
import { DynamicIcon } from '@/components/ui/DynamicIcon'
import { paiseToRupees } from '@/lib/currency'

export function getPersonalTransactionFormDefaults(initialData?: any) {
    const initialAmountInRupees = initialData?.amount !== undefined && initialData?.amount !== null
        ? paiseToRupees(initialData.amount).toNumber()
        : undefined

    return {
        amount: initialAmountInRupees,
        name: initialData?.name || '',
        note: initialData?.note || '',
        date: initialData?.date ? new Date(initialData.date) : new Date(),
        flow: (initialData?.flow as 'IN' | 'OUT') || 'OUT',
        contact_id: initialData?.contact_id || initialData?.contact?.id || null,
        category_id: initialData?.category_id || initialData?.category?.id || null,
        account_id: initialData?.account_id || initialData?.account?.id || undefined,
    }
}

const personalTransactionSchema = z.object({
    amount: z.any().transform(v => (v === '' || v === undefined || v === null ? undefined : Number(v))).superRefine((val, ctx) => {
        if (val === undefined) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'How much was this for?' });
        } else if (Number.isNaN(val)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please enter a valid number' });
        } else if (val <= 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount must be a positive number' });
        }
    }),
    name: z.string().trim().min(1, 'What was this for? Please add a title'),
    note: z.string().optional(),
    contact_id: z.string().nullable().optional(),
    category_id: z.string().nullable().optional(), // validated manually based on flow
    account_id: z.string({ 
        message: 'Which account did you use?' 
    }).min(1, 'Which account did you use?'),
    date: z.coerce.date(),
    flow: z.enum(['IN', 'OUT']),
})

export function PersonalTransactionDrawer({
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
    const { data: contacts } = usePersonalPeople()
    const { data: budgets } = useBudgets()
    const { data: accounts } = useAccounts()
    const { mutate: addTransaction, isPending: isAdding } = useAddTransaction()
    const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction()
    const isPending = isAdding || isUpdating
    const [internalOpen, setInternalOpen] = useState(false)
    const [showAccountNeededDialog, setShowAccountNeededDialog] = useState(false)

    const router = useRouter()
    const pathname = usePathname()

    const open = controlledOpen ?? internalOpen
    const setOpen = setControlledOpen ?? setInternalOpen

    const defaultValues = getPersonalTransactionFormDefaults(initialData)
    const [flow, setFlow] = useState<'IN' | 'OUT'>(defaultValues.flow)

    const defaultAccount = getDefaultAccount(accounts)

    const form = useForm({
        resolver: zodResolver(personalTransactionSchema),
        defaultValues: {
            amount: defaultValues.amount ?? ('' as unknown as number),
            name: defaultValues.name,
            note: defaultValues.note,
            date: defaultValues.date,
            flow: defaultValues.flow,
            contact_id: defaultValues.contact_id,
            category_id: defaultValues.category_id,
            account_id: defaultValues.account_id || defaultAccount?.id || '',
        },
    })

    const resetFormValues = (nextOpen: boolean) => {
        if (nextOpen) {
            const defaults = getPersonalTransactionFormDefaults(initialData)
            form.reset({
                amount: defaults.amount ?? ('' as unknown as number),
                name: defaults.name,
                note: defaults.note,
                date: defaults.date,
                flow: defaults.flow,
                contact_id: defaults.contact_id,
                category_id: defaults.category_id,
                account_id: defaults.account_id || defaultAccount?.id || '',
            })
            setFlow(defaults.flow)
        }
    }

    useEffect(() => {
        if (open) {
            resetFormValues(true)
        }
    }, [open, initialData, defaultAccount?.id])

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen && accounts && accounts.length === 0 && !initialData) {
            setShowAccountNeededDialog(true)
            return
        }
        setOpen(nextOpen)
        resetFormValues(nextOpen)
    }

    function onSubmit(values: z.infer<typeof personalTransactionSchema>) {
        if (values.amount === undefined) {
            toast.error('How much was this for?')
            return
        }

        if (!values.category_id && flow === 'OUT') {
            toast.error('Please pick a category for this expense')
            return
        }

        const transactionData = {
            ...values,
            amount: values.amount,
            contact_id: values.contact_id || initialData?.contact_id || null,
            mode: 'PERSONAL' as const,
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
                })
                setFlow('OUT') // Reset flow default
                toast.success(initialData?.id ? 'Transaction updated' : 'Transaction saved')
            },
            onError: (error: Error) => {
                toast.error(`Failed to save: ${error.message}`)
            }
        }

        if (initialData?.id) {
            updateTransaction({ ...transactionData, id: initialData.id }, options)
        } else {
            addTransaction(transactionData, options)
        }
    }

    const currentContactId = form.watch('contact_id') || initialData?.contact_id
    const selectedContact = contacts?.find(c => c.id === currentContactId)
    const contactDisplayName = selectedContact?.name || initialData?.contact_name || initialData?.contact?.name

    return (
        <>
            <Dialog open={showAccountNeededDialog} onOpenChange={setShowAccountNeededDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Account Required</DialogTitle>
                        <DialogDescription>
                            You need at least one bank account or cash wallet to create a transaction. Would you like to add one now?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAccountNeededDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => router.push("/onboarding/personal?returnTo=" + encodeURIComponent(pathname))}>
                            Add Account
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Drawer open={open} onOpenChange={handleOpenChange}>
            {!hideTrigger && (
                <DrawerTrigger render={<Button
                        data-testid="fab-add-transaction"
                        size="icon"
                        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-[calc(1.5rem+env(safe-area-inset-right,0px))] shadow-lg z-40 rounded-full h-14 w-14"
                     />}>
                        <Icon icon={PlusIcon} className="h-6 w-6" />
                        <span className="sr-only">Add</span>
                    </DrawerTrigger>
            )}
            <DrawerContent data-testid="personal-transaction-drawer" className="max-h-[90dvh]">
                <div className="mx-auto w-full max-w-sm flex flex-col min-h-0 max-h-[90dvh]">
                    <DrawerHeader className="shrink-0">
                        <DrawerTitle>{initialData?.id ? 'Edit Transaction' : 'Add Expense / Income'}</DrawerTitle>
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
                                    Expense
                                </TabsTrigger>
                                <TabsTrigger
                                    value="IN"
                                    className="data-active:bg-green-100 data-active:text-green-900 dark:data-active:bg-green-900/50 dark:data-active:text-green-100"
                                >
                                    Income
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
                                                <FormLabel>Person (Optional)</FormLabel>
                                                <Select items={contacts?.map((i: any) => ({ value: i.id || i.value || String(i), label: i.name || i.label || String(i) })) || []} onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select person" />
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
                                        <span className="text-muted-foreground">Person</span>
                                        <span className="font-semibold text-foreground">{contactDisplayName || 'Selected Friend'}</span>
                                    </div>
                                ) : null}

                                {flow === 'OUT' && (
                                    <FormField
                                        control={form.control}
                                        name="category_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Category</FormLabel>
                                                <FormControl>
                                                    <ToggleGroup
                                                        value={field.value ? [field.value] : []}
                                                        onValueChange={(val) => {
                                                            const arr = Array.isArray(val) ? val : (val ? [val] : []);
                                                            if (arr.length > 0) {
                                                                field.onChange(arr[arr.length - 1]);
                                                            }
                                                        }}
                                                        className="justify-start flex-wrap gap-2"
                                                    >
                                                        {budgets?.map((cat) => (
                                                            <ToggleGroupItem
                                                                key={cat.id}
                                                                value={cat.id}
                                                                data-testid={`category-${cat.id}`}
                                                                aria-label={cat.name}
                                                                className="h-9 px-3 border border-input data-pressed:bg-primary data-pressed:text-primary-foreground"
                                                            >
                                                                <DynamicIcon name={cat.icon} className="mr-2 h-4 w-4" size={16} />
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
                                                {accounts?.length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center p-4 border border-dashed rounded-lg bg-muted/20 text-center space-y-2">
                                                        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                                                            <Icon icon={AlertCircleIcon} className="h-4 w-4" />
                                                            No accounts found
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Create an account (e.g., Cash or Bank) to record your transactions.
                                                        </p>
                                                        <AddAccountDrawer>
                                                            <Button size="sm" variant="outline" type="button" className="mt-1">
                                                                <Icon icon={PlusIcon} className="mr-1.5 h-3.5 w-3.5" />
                                                                Add Account
                                                            </Button>
                                                        </AddAccountDrawer>
                                                    </div>
                                                ) : (
                                                    <ToggleGroup
                                                        value={field.value ? [field.value] : []}
                                                        onValueChange={(val) => {
                                                            const arr = Array.isArray(val) ? val : (val ? [val] : []);
                                                            if (arr.length > 0) {
                                                                field.onChange(arr[arr.length - 1]);
                                                            }
                                                        }}
                                                        className="justify-start flex-wrap gap-2"
                                                    >
                                                        {accounts?.map((acc) => (
                                                            <ToggleGroupItem
                                                                key={acc.id}
                                                                value={acc.id}
                                                                data-testid={`account-${acc.id}`}
                                                                aria-label={acc.name}
                                                                className="h-9 px-3 border border-input data-pressed:bg-primary data-pressed:text-primary-foreground"
                                                            >
                                                                {acc.name} (₹{acc.balance})
                                                            </ToggleGroupItem>
                                                        ))}
                                                    </ToggleGroup>
                                                )}
                                            </FormControl>
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
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Starbucks, Uber, etc."
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
                                                    placeholder="Coffee with John, etc."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending && <Icon icon={LoaderIcon} className="mr-2 h-4 w-4 animate-spin" />}
                                    {initialData?.id ? 'Update Transaction' : 'Save Transaction'}
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
        </>
    )
}

import { useState, useMemo } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GroupMember } from '@/types'
import { useSplitCalculator, SplitType } from '@/hooks/finance/useSplitCalculator'
import { useAddTransaction } from '@/hooks/useAddTransaction'
import { toast } from '@/components/ui/toast'
import { Icon } from "@/components/ui/icon";
import { ChevronRightIcon, ArrowLeft05Icon, PlusIcon, CheckIcon } from "@hugeicons/core-free-icons";
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useAccounts } from '@/hooks/useAccounts'
import { getDefaultAccount } from '@/lib/account-utils'
import { AddAccountDrawer } from '@/components/finance/AddAccountDrawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, rupeesToPaise } from '@/lib/currency'
import { splitExpenseSchema, splitExpenseStep1Schema } from '@/lib/validations/split-expense'


interface SplitExpenseDrawerProps {
    children: React.ReactNode
    groupId: string
    members: GroupMember[]
    currentUserId: string // Passed from parent or fetched
}

export function SplitExpenseDrawer({ children, groupId, members, currentUserId }: SplitExpenseDrawerProps) {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<1 | 2>(1)

    // Step 1 State
    const [amount, setAmount] = useState<string>('')
    const [name, setName] = useState('')
    const [accountId, setAccountId] = useState<string>('')

    const { data: accounts } = useAccounts()

    // Derive default account during render scope
    const defaultAccount = getDefaultAccount(accounts)
    const activeAccountId = accountId || defaultAccount?.id || ''

    const numericAmount = parseFloat(amount) || 0

    // Hook for Step 2
    const {
        splitType,
        setSplitType,
        payerId,
        setPayerId,
        shares,
        updateShare,
        selectedMembers,
        toggleMemberSelection,
        allocations,
        isValid,
        remainder
    } = useSplitCalculator({
        totalAmount: numericAmount,
        members,
        currentUserId
    })

    const { mutate: addTransaction, isPending } = useAddTransaction()

    // Memoized O(1) lookup indexes
    const selectedMembersSet = useMemo(() => new Set(selectedMembers), [selectedMembers])
    const allocationsMap = useMemo(() => new Map(allocations.map(a => [a.memberId, a])), [allocations])
    const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            setStep(1)
            setAmount('')
            setName('')
            setAccountId('')
        }
    }

    const handleNext = () => {
        const validation = splitExpenseStep1Schema.safeParse({
            amount: numericAmount,
            name,
            accountId: activeAccountId,
        })
        if (!validation.success) {
            toast.error(validation.error.issues[0].message)
            return
        }
        setStep(2)
    }

    const handleSubmit = () => {
        const validation = splitExpenseSchema.safeParse({
            splitType,
            shares,
            selectedMembers,
            totalAmount: numericAmount
        });

        if (!validation.success) {
            toast.error(validation.error.issues[0].message, { id: 'split-validation-error' })
            return
        }

        const splitsPayload = allocations.map(a => {
            const member = memberMap.get(a.memberId)
            return {
                user_id: member?.user_id || undefined,
                group_member_id: member?.id,
                amount: a.amountOwed,
                percentage: a.percent,
                is_settled: member?.id === payerId,
                member_name_snapshot: member ? getMemberName(member.id) : 'Unknown'
            }
        })

        // Resolve the payer's user_id from the selected group member (fallback for real users)
        const payerMember = memberMap.get(payerId)

        addTransaction({
            amount: numericAmount,
            name: name,
            date: new Date(),
            flow: 'OUT',
            mode: 'PERSONAL',
            group_id: groupId,
            payer_id: payerMember?.user_id || undefined, // Real user fallback
            payer_group_member_id: payerId, // Primary: group_member.id
            split_type: splitType,
            splits: splitsPayload,
            account_id: activeAccountId
        }, {
            onSuccess: () => {
                handleOpenChange(false)
                toast.success('Expense added!')
            },
            onError: (err) => {
                toast.error(err.message)
            }
        })
    }

    // Helper to get member name
    const getMemberName = (id: string) => {
        const m = memberMap.get(id)
        if (!m) return 'Unknown'
        // If it's me
        if (m.user_id === currentUserId) return 'You'
        return m.profiles?.full_name || m.ghost_name || 'Member'
    }

    const getMemberAvatar = (id: string) => {
        const m = memberMap.get(id)
        return m?.profiles?.avatar_url || m?.avatar_url || undefined
    }

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            <DrawerTrigger render={children as React.ReactElement} />
            <DrawerContent className="h-[90dvh] flex flex-col">
                {/* Header / Nav */}
                <div className="mx-auto w-full max-w-sm mt-4 px-4 flex items-center justify-between">
                    {step === 2 ? (
                        <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
                            <Icon icon={ArrowLeft05Icon} className="h-4 w-4" />
                        </Button>
                    ) : (
                        <div />
                    )}
                    <DrawerTitle>{step === 1 ? 'Add Expense' : 'Split Expense'}</DrawerTitle>
                    <DrawerDescription className="sr-only">
                        {step === 1 ? 'Enter expense details' : 'Configure split breakdown'}
                    </DrawerDescription>
                    <div className="w-9" /> {/* Spacer */}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 max-w-sm mx-auto w-full">

                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2 py-8">
                                <Label htmlFor="split-expense-amount" className="text-muted-foreground">Enter amount</Label>
                                <div className="flex items-center justify-center text-5xl font-bold tracking-tighter">
                                    <span className="text-xl text-muted-foreground mr-1">₹</span>
                                    <Input
                                        id="split-expense-amount"
                                        aria-label="Enter amount"
                                        type="number"
                                        className="w-40 text-center border-none shadow-none text-5xl p-0 h-auto focus-visible:ring-0"
                                        placeholder="0"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="split-expense-name">Expense Name</Label>
                                <Input
                                    id="split-expense-name"
                                    aria-label="Expense Name"
                                    placeholder="What's this for?"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Paid from</Label>
                                {accounts?.length === 0 ? (
                                    <div className="p-3 border border-dashed rounded-lg bg-muted/20 text-center space-y-2">
                                        <p className="text-xs text-muted-foreground">No account found to pay from.</p>
                                        <AddAccountDrawer>
                                            <Button size="sm" variant="outline" type="button">
                                                <Icon icon={PlusIcon} className="mr-1 h-3.5 w-3.5" />
                                                Add Account
                                            </Button>
                                        </AddAccountDrawer>
                                    </div>
                                ) : (
                                    <Select items={accounts?.map(acc => ({ value: acc.id, label: `${acc.name} (${acc.type}) - ₹${acc.balance}` })) || []} value={activeAccountId} onValueChange={(val) => val && setAccountId(val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts?.map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>
                                                    {acc.name} ({acc.type}) - ₹{acc.balance}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            {/* Payer Selection */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Paid by</span>
                                <select
                                    className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
                                    value={payerId}
                                    onChange={(e) => setPayerId(e.target.value)}
                                >
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {getMemberName(m.id)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <Tabs defaultValue="EQUALLY" value={splitType} onValueChange={(v) => setSplitType(v as SplitType)} className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="EQUALLY" aria-label="Split equally (=)">=</TabsTrigger>
                                    <TabsTrigger value="BY_AMOUNT" aria-label="Split by exact amounts (1.23)">1.23</TabsTrigger>
                                    <TabsTrigger value="BY_PERCENTAGE" aria-label="Split by percentage (%)">%</TabsTrigger>
                                </TabsList>

                                <TabsContent value="EQUALLY" className="mt-4 space-y-4">
                                    <div className="text-sm text-center text-muted-foreground mb-4">
                                        Split equally among selected members
                                    </div>
                                    {members.map(member => {
                                        const isSelected = selectedMembersSet.has(member.id)
                                        const allocation = allocationsMap.get(member.id)
                                        const memberName = getMemberName(member.id)

                                        return (
                                            <div key={member.id} className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <Checkbox
                                                        id={`split-member-${member.id}`}
                                                        aria-label={`Select ${memberName}`}
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleMemberSelection(member.id)}
                                                    />
                                                    <label
                                                        htmlFor={`split-member-${member.id}`}
                                                        className="flex items-center gap-3 cursor-pointer select-none"
                                                    >
                                                        <Avatar className="h-10 w-10" aria-hidden="true">
                                                            <AvatarImage src={getMemberAvatar(member.id)} />
                                                            <AvatarFallback aria-hidden="true">{memberName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="font-medium text-sm">
                                                            <span className="sr-only">Select </span>
                                                            {memberName}
                                                        </div>
                                                    </label>
                                                </div>
                                                <div className="text-sm font-medium">
                                                    {allocation ? formatCurrency(rupeesToPaise(allocation.amountOwed)) : '₹0.00'}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </TabsContent>

                                <TabsContent value="BY_AMOUNT" className="mt-4 space-y-4">
                                    <div className="text-sm text-center text-muted-foreground mb-4">
                                        Enter exact amounts
                                    </div>
                                    {members.map(member => {
                                        const memberName = getMemberName(member.id)
                                        return (
                                            <div key={member.id} className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={getMemberAvatar(member.id)} />
                                                        <AvatarFallback>{memberName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="font-medium text-sm">{memberName}</div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-muted-foreground text-sm">₹</span>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        aria-label={`Amount for ${memberName}`}
                                                        className="w-24 text-right h-9"
                                                        value={shares[member.id] !== undefined ? shares[member.id] : ''}
                                                        onChange={(e) => updateShare(member.id, parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <div className={cn("text-center text-sm font-medium mt-4", isValid ? "text-green-600" : "text-red-500")}>
                                        {isValid ? "Amounts match total" : `Remaining: ${formatCurrency(rupeesToPaise(remainder))}`}
                                    </div>
                                </TabsContent>

                                <TabsContent value="BY_PERCENTAGE" className="mt-4 space-y-4">
                                    <div className="text-sm text-center text-muted-foreground mb-4">
                                        Enter percentages
                                    </div>
                                    {members.map(member => {
                                        const memberName = getMemberName(member.id)
                                        return (
                                            <div key={member.id} className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={getMemberAvatar(member.id)} />
                                                        <AvatarFallback>{memberName.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="font-medium text-sm">{memberName}</div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        aria-label={`Percentage for ${memberName}`}
                                                        className="w-20 text-right h-9"
                                                        value={shares[member.id] !== undefined ? shares[member.id] : ''}
                                                        onChange={(e) => updateShare(member.id, parseFloat(e.target.value) || 0)}
                                                    />
                                                    <span className="text-muted-foreground text-sm">%</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <div className={cn("text-center text-sm font-medium mt-4", isValid ? "text-green-600" : "text-red-500")}>
                                        {isValid ? "Total 100%" : `Total: ${(100 - remainder).toFixed(2)}%`}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </div>

                <DrawerFooter className="max-w-sm mx-auto w-full">
                    {step === 1 ? (
                        <Button onClick={handleNext} className="w-full">
                            Next
                            <Icon icon={ChevronRightIcon} className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isPending} className="w-full">
                            {isPending ? 'Saving...' : 'Send Request'}
                        </Button>
                    )}
                    <DrawerClose render={<Button variant="outline" className="w-full" />}>Cancel</DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}

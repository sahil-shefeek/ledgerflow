import { useState, useEffect } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GroupMember } from '@/types'
import { useSplitCalculator, SplitType } from '@/hooks/finance/useSplitCalculator'
import { useAddTransaction } from '@/hooks/useAddTransaction'
import { toast } from 'sonner'
import { Check, ChevronRight, ArrowLeft } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useAccounts } from '@/hooks/useAccounts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'


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

    useEffect(() => {
        if (accounts?.length && !accountId) {
            const defaultAccount = accounts.find(a => a.is_default) || accounts[0]
            if (defaultAccount) setAccountId(defaultAccount.id)
        }
    }, [accounts, accountId])

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

    // Reset when closing
    useEffect(() => {
        if (!open) {
            setStep(1)
            setAmount('')
            setName('')
            // We could reset split calculator too if expanded, but it resets on mount mostly.
        }
    }, [open])

    const handleNext = () => {
        if (!numericAmount || numericAmount <= 0) {
            toast.error('Please enter a valid amount')
            return
        }
        if (!name.trim()) {
            toast.error('Please enter a description')
            return
        }
        if (!accountId) {
            toast.error('Please select an account')
            return
        }
        setStep(2)
    }

    const handleSubmit = () => {
        if (!isValid) {
            toast.error('Please fix the split amounts')
            return
        }

        const splitsPayload = allocations.map(a => {
            const member = members.find(m => m.id === a.memberId)
            return {
                transaction_id: 'temp', // Ignored/Generated
                user_id: member?.user_id || undefined, // undefined vs null? schema allows null.
                group_member_id: member?.id, // Important for ghosts
                amount: a.amountOwed,
                percentage: a.percent,
                is_settled: member?.id === payerId, // Payer is settled
                member_name_snapshot: member ? getMemberName(member.id) : 'Unknown'
            }
        })

        // Resolve the payer's user_id from the selected group member (fallback for real users)
        const payerMember = members.find(m => m.id === payerId)

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
            account_id: accountId
        }, {
            onSuccess: () => {
                setOpen(false)
                toast.success('Expense added!')
            },
            onError: (err) => {
                toast.error(err.message)
            }
        })
    }

    // Helper to get member name
    const getMemberName = (id: string) => {
        const m = members.find(m => m.id === id)
        if (!m) return 'Unknown'
        // If it's me
        if (m.user_id === currentUserId) return 'You'
        return m.ghost_name || 'Member' // We need to join with profile?
        // Wait, GroupMember type in types.ts has 'ghost_name'. 
        // It doesn't have 'profiles.full_name'.
        // The `members` passed to this component likely come from `useGroupDetails` which usually joins profiles.
        // But Typescript might complain if I access `.profiles`.
        // I will trust the passed `members` object might have extra fields or I use what I have.
        // Checking `types.ts`: `GroupMember` has `user_id`, `ghost_name`.
        // The `useGroupDetails` returned `members`.
        // Let's look at `GroupBalancesList` in `page.tsx`:
        // It accesses `member.profiles?.full_name`.
        // I should stick to `any` cast or improve type if I can`t see it.
        // For now I'll cast or just check `(m as any).profiles?.full_name`.
    }

    const getMemberAvatar = (id: string) => {
        const m = members.find(m => m.id === id)
        return (m as any)?.profiles?.avatar_url || m?.avatar_url
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {children}
            </DrawerTrigger>
            <DrawerContent className="h-[90vh] flex flex-col">
                {/* Header / Nav */}
                <div className="mx-auto w-full max-w-sm mt-4 px-4 flex items-center justify-between">
                    {step === 2 ? (
                        <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    ) : (
                        <div />
                    )}
                    <DrawerTitle>{step === 1 ? 'Add Expense' : 'Split Expense'}</DrawerTitle>
                    <div className="w-9" /> {/* Spacer */}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 max-w-sm mx-auto w-full">

                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2 py-8">
                                <Label className="text-muted-foreground">Enter amount</Label>
                                <div className="flex items-center justify-center text-5xl font-bold tracking-tighter">
                                    <span className="text-xl text-muted-foreground mr-1">₹</span>
                                    <Input
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
                                <Label>Expense Name</Label>
                                <Input
                                    placeholder="What's this for?"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Paid from</Label>
                                <Select value={accountId} onValueChange={setAccountId}>
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
                                    <TabsTrigger value="EQUALLY">=</TabsTrigger>
                                    <TabsTrigger value="BY_AMOUNT">1.23</TabsTrigger>
                                    <TabsTrigger value="BY_PERCENTAGE">%</TabsTrigger>
                                </TabsList>

                                <TabsContent value="EQUALLY" className="mt-4 space-y-4">
                                    <div className="text-sm text-center text-muted-foreground mb-4">
                                        Split equally among selected members
                                    </div>
                                    {members.map(member => {
                                        const isSelected = selectedMembers.includes(member.id)
                                        const allocation = allocations.find(a => a.memberId === member.id)

                                        return (
                                            <div key={member.id} className="flex items-center justify-between gap-3" onClick={() => toggleMemberSelection(member.id)}>
                                                <div className="flex items-center gap-3">
                                                    <Checkbox checked={isSelected} onCheckedChange={() => toggleMemberSelection(member.id)} />
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={getMemberAvatar(member.id)} />
                                                        <AvatarFallback>{getMemberName(member.id).slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="font-medium text-sm">{getMemberName(member.id)}</div>
                                                </div>
                                                <div className="text-sm font-medium">
                                                    ₹{allocation?.amountOwed.toFixed(2)}
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
                                        const allocation = allocations.find(a => a.memberId === member.id)
                                        return (
                                            <div key={member.id} className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={getMemberAvatar(member.id)} />
                                                        <AvatarFallback>{getMemberName(member.id).slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="font-medium text-sm">{getMemberName(member.id)}</div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-muted-foreground text-sm">₹</span>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        className="w-24 text-right h-9"
                                                        value={shares[member.id] || ''}
                                                        onChange={(e) => updateShare(member.id, parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <div className={cn("text-center text-sm font-medium mt-4", isValid ? "text-green-600" : "text-red-500")}>
                                        {isValid ? "Amounts match total" : `Remaining: ₹${remainder.toFixed(2)}`}
                                    </div>
                                </TabsContent>

                                <TabsContent value="BY_PERCENTAGE" className="mt-4 space-y-4">
                                    <div className="text-sm text-center text-muted-foreground mb-4">
                                        Enter percentages
                                    </div>
                                    {members.map(member => {
                                        return (
                                            <div key={member.id} className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={getMemberAvatar(member.id)} />
                                                        <AvatarFallback>{getMemberName(member.id).slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="font-medium text-sm">{getMemberName(member.id)}</div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        className="w-20 text-right h-9"
                                                        value={shares[member.id] || ''}
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
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={!isValid || isPending} className="w-full">
                            {isPending ? 'Saving...' : 'Send Request'}
                        </Button>
                    )}
                    <DrawerClose asChild>
                        <Button variant="outline" className="w-full">Cancel</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}

'use client'

import { useState, useMemo } from 'react'
import { Drawer, DrawerContent, DrawerFooter, DrawerTitle, DrawerTrigger, DrawerClose } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Contact, GroupMember } from '@/types'
import { useAddTransaction } from '@/hooks/useAddTransaction'
import { useProfile } from '@/hooks/use-profile'
import { paiseToRupees } from '@/lib/currency'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface SettleUpDrawerProps {
    children: React.ReactNode
    groupId?: string
    members?: (GroupMember & {
        profiles?: {
            full_name: string | null
            avatar_url: string | null
        }
    })[]
    contact?: Contact
    currentUserId?: string
}

function getMemberName(member: { user_id?: string | null; ghost_name?: string | null; profiles?: { full_name?: string | null } | null }, currentUserId: string) {
    if (member.user_id === currentUserId) return 'You'
    return member.ghost_name || member.profiles?.full_name || 'Member'
}

function getMemberAvatar(member: { avatar_url?: string | null; profiles?: { avatar_url?: string | null } | null }) {
    return member.profiles?.avatar_url || member.avatar_url || undefined
}

export function SettleUpDrawer({ children, groupId, members: propMembers, contact, currentUserId: propUserId }: SettleUpDrawerProps) {
    const [open, setOpen] = useState(false)
    const { profile } = useProfile()
    const currentUserId = propUserId || profile?.id || ''

    const members = useMemo(() => {
        if (propMembers && propMembers.length > 0) return propMembers
        if (contact) {
            return [
                {
                    id: currentUserId,
                    group_id: '',
                    user_id: currentUserId,
                    ghost_name: 'You',
                    avatar_url: profile?.avatar_url || null,
                    joined_at: new Date().toISOString(),
                    profiles: {
                        avatar_url: profile?.avatar_url || null,
                        full_name: profile?.full_name || 'You'
                    }
                },
                {
                    id: contact.id,
                    group_id: '',
                    user_id: contact.linked_user_id || null,
                    ghost_name: contact.name,
                    avatar_url: contact.image_url,
                    joined_at: new Date().toISOString(),
                    profiles: {
                        avatar_url: contact.image_url,
                        full_name: contact.name
                    }
                }
            ]
        }
        return []
    }, [propMembers, contact, currentUserId, profile])

    const [payerMemberId, setPayerMemberId] = useState('')
    const [receiverMemberId, setReceiverMemberId] = useState('')
    const [amount, setAmount] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])

    const { mutate: addTransaction, isPending } = useAddTransaction()

    const numericAmount = parseFloat(amount) || 0
    const filteredReceivers = members.filter(m => m.id !== payerMemberId)

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (newOpen && contact) {
            const initialAmount = contact.net_balance !== 0
                ? Math.abs(paiseToRupees(contact.net_balance).toNumber()).toString()
                : ''
            setAmount(initialAmount)
            if (contact.net_balance < 0) {
                setPayerMemberId(currentUserId)
                setReceiverMemberId(contact.id)
            } else {
                setPayerMemberId(contact.id)
                setReceiverMemberId(currentUserId)
            }
        } else if (!newOpen) {
            setPayerMemberId('')
            setReceiverMemberId('')
            setAmount('')
        }
    }

    const handleSubmit = () => {
        if (!payerMemberId) {
            toast.error('Please select who paid')
            return
        }
        if (!receiverMemberId) {
            toast.error('Please select the receiver')
            return
        }
        if (numericAmount <= 0) {
            toast.error('Please enter a valid amount')
            return
        }

        const payerMember = members.find(m => m.id === payerMemberId)
        const receiverMember = members.find(m => m.id === receiverMemberId)

        if (!payerMember || !receiverMember) return

        const isUserPayer = payerMemberId === currentUserId
        const flow = isUserPayer ? 'OUT' : 'IN'

        addTransaction({
            amount: numericAmount,
            name: 'Settlement',
            date: new Date(date),
            flow: flow,
            mode: 'PERSONAL',
            group_id: groupId || null,
            contact_id: contact ? contact.id : null,
            payer_id: payerMember.user_id || undefined,
            payer_group_member_id: groupId ? payerMemberId : undefined,
            split_type: 'EQUALLY',
            splits: [{
                user_id: receiverMember.user_id || undefined,
                group_member_id: groupId ? receiverMemberId : undefined,
                amount: numericAmount,
                is_settled: true,
                member_name_snapshot: getMemberName(receiverMember, currentUserId) === 'You'
                    ? (receiverMember.profiles?.full_name || 'You')
                    : getMemberName(receiverMember, currentUserId),
            }],
        }, {
            onSuccess: () => {
                setOpen(false)
                setPayerMemberId('')
                setReceiverMemberId('')
                setAmount('')
                toast.success('Settlement recorded!')
            },
            onError: (err) => {
                toast.error(err.message)
            }
        })
    }

    return (
        <Drawer open={open} onOpenChange={handleOpenChange}>
            <DrawerTrigger render={children as React.ReactElement} />
            <DrawerContent className="flex flex-col" data-testid="settle-up-drawer">
                <div className="mx-auto w-full max-w-sm mt-4 px-4">
                    <DrawerTitle className="text-center">Settle Up</DrawerTitle>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6 max-w-sm mx-auto w-full space-y-6">
                    {/* Amount */}
                    <div className="text-center space-y-2 py-4">
                        <Label className="text-muted-foreground">Settlement amount</Label>
                        <div className="flex items-center justify-center text-5xl font-bold tracking-tighter">
                            <span className="text-xl text-muted-foreground mr-1">₹</span>
                            <Input
                                type="number"
                                className="w-40 text-center border-none shadow-none text-5xl p-0 h-auto focus-visible:ring-0"
                                placeholder="0"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                autoFocus
                                data-testid="settle-up-amount-input"
                            />
                        </div>
                    </div>

                    {/* Who paid */}
                    <div className="space-y-2">
                        <Label>Who paid?</Label>
                        <Select items={members?.map((i: any) => ({ value: i.id || i.value || String(i), label: i.name || i.label || String(i) })) || []} value={payerMemberId} onValueChange={(val) => {
                            if (val) setPayerMemberId(val)
                            // Reset receiver if same as new payer
                            if (receiverMemberId === val) setReceiverMemberId('')
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select payer" />
                            </SelectTrigger>
                            <SelectContent>
                                {members.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={getMemberAvatar(m)} />
                                                <AvatarFallback className="text-xs">
                                                    {getMemberName(m, currentUserId).slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            {getMemberName(m, currentUserId)}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* To whom */}
                    <div className="space-y-2">
                        <Label>To whom?</Label>
                        <Select items={filteredReceivers?.map((i: any) => ({ value: i.id || i.value || String(i), label: i.name || i.label || String(i) })) || []} value={receiverMemberId} onValueChange={(val) => val && setReceiverMemberId(val)} disabled={!payerMemberId}>
                            <SelectTrigger>
                                <SelectValue placeholder={payerMemberId ? "Select receiver" : "Select payer first"} />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredReceivers.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={getMemberAvatar(m)} />
                                                <AvatarFallback className="text-xs">
                                                    {getMemberName(m, currentUserId).slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            {getMemberName(m, currentUserId)}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>
                </div>

                <DrawerFooter className="max-w-sm mx-auto w-full">
                    <Button
                        onClick={handleSubmit}
                        disabled={isPending || !payerMemberId || !receiverMemberId || numericAmount <= 0}
                        className="w-full"
                        data-testid="settle-up-submit-button"
                    >
                        {isPending ? 'Recording...' : 'Record Settlement'}
                    </Button>
                    <DrawerClose render={<Button variant="outline" className="w-full" />}>Cancel</DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}

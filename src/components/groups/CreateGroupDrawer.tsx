'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Icon } from "@/components/ui/icon";
import { Cancel01Icon, LoaderIcon, UserPlusIcon, UsersIcon, PlusIcon } from "@hugeicons/core-free-icons";
import { toast } from '@/components/ui/toast'
import { createGroupAction } from '@/lib/actions/groups'
import { useQueryClient } from '@tanstack/react-query'
import { useFriendships } from '@/hooks/friends/useFriendships'

import { Button } from '@/components/ui/button'
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'

import { createGroupSchema as formSchema } from '@/lib/validations/group'

interface Member {
    id?: string // Real user ID
    name: string
    type: 'REAL' | 'GHOST'
    avatar_url?: string | null
    isSelected?: boolean
}

export function CreateGroupDrawer({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [members, setMembers] = useState<Member[]>([])
    const [ghostName, setGhostName] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const queryClient = useQueryClient()
    const { data: friends } = useFriendships()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            type: 'GENERAL',
        },
    })

    const handleAddGhost = () => {
        if (!ghostName.trim()) return
        setMembers(prev => [...prev, { name: ghostName, type: 'GHOST', isSelected: true }])
        setGhostName('')
    }

    const toggleMember = (memberId: string | undefined, memberName: string, type: 'REAL' | 'GHOST', avatarUrl?: string | null) => {
        setMembers(prev => {
            const exists = prev.find(m => (m.id === memberId && type === 'REAL') || (m.name === memberName && type === 'GHOST'))
            if (exists) {
                return prev.filter(m => m !== exists)
            }
            return [...prev, { id: memberId, name: memberName, type, avatar_url: avatarUrl, isSelected: true }]
        })
    }

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSubmitting(true)
        try {
            const res = await createGroupAction({
                name: values.name,
                type: values.type,
                members: members.map(m => ({
                    id: m.type === 'REAL' ? m.id : undefined,
                    name: m.name,
                    type: m.type,
                    avatar_url: m.avatar_url,
                })),
            })

            if (res.error) {
                const firstError = res.fieldErrors ? Object.values(res.fieldErrors).flat().filter(Boolean)[0] : undefined;
                toast.error(firstError || res.error);
                return;
            }

            toast.success('Group created successfully')
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            setOpen(false)
            form.reset()
            setMembers([])
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || 'Failed to create group')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger render={children as React.ReactElement} />
            <DrawerContent className="h-[90dvh]">
                <div className="mx-auto w-full max-w-sm h-full flex flex-col">
                    <DrawerHeader>
                        <DrawerTitle>Create New Group</DrawerTitle>
                        <DrawerDescription>Create a group to split expenses with friends.</DrawerDescription>
                    </DrawerHeader>

                    <div className="flex-1 overflow-y-auto px-4 pb-4">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Group Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Goa Trip, Apartment 302" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type</FormLabel>
                                            <Select items={[ {value: 'GENERAL', label: 'General'}, {value: 'TRIP', label: 'Trip'}, {value: 'HOME', label: 'Home'}, {value: 'COUPLE', label: 'Couple'}, {value: 'OTHER', label: 'Other'} ]} onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a group type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="GENERAL">General</SelectItem>
                                                    <SelectItem value="TRIP">Trip</SelectItem>
                                                    <SelectItem value="HOME">Home</SelectItem>
                                                    <SelectItem value="COUPLE">Couple</SelectItem>
                                                    <SelectItem value="OTHER">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <FormLabel>Members ({members.length})</FormLabel>
                                    </div>

                                    {/* Selected Members Preview */}
                                    {members.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {members.map((member, i) => (
                                                <div key={i} className="flex flex-col items-center gap-1 min-w-[60px]">
                                                    <div className="relative">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={member.avatar_url || undefined} />
                                                            <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleMember(member.id, member.name, member.type)}
                                                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                                                        >
                                                            <Icon icon={Cancel01Icon} className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                    <span className="text-[10px] truncate w-full text-center">{member.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Add person without account..."
                                                value={ghostName}
                                                onChange={(e) => setGhostName(e.target.value)}
                                            />
                                            <Button type="button" size="sm" onClick={handleAddGhost} disabled={!ghostName} aria-label="Add person">
                                                <Icon icon={PlusIcon} className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-4">
                                            Friends on LedgerFlow
                                        </div>

                                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                            {friends?.map((friend) => {
                                                const isSelected = members.some(m => m.id === friend.profile.id)
                                                return (
                                                    <div
                                                        key={friend.profile.id}
                                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                                                        onClick={() => toggleMember(friend.profile.id, friend.profile.full_name || 'Unknown', 'REAL', friend.profile.avatar_url)}
                                                    >
                                                        <Checkbox checked={isSelected} />
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={friend.profile.avatar_url || undefined} />
                                                            <AvatarFallback>{(friend.profile.full_name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm font-medium">{friend.profile.full_name}</span>
                                                    </div>
                                                )
                                            })}
                                            {(!friends || friends.length === 0) && (
                                                <div className="text-sm text-muted-foreground py-2 text-center">
                                                    No friends found. Add friends or use ghost users.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <DrawerFooter className="px-0">
                                    <Button type="submit" disabled={isSubmitting} data-testid="create-group-submit">
                                        {isSubmitting && <Icon icon={LoaderIcon} className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Group
                                    </Button>
                                    <DrawerClose render={<Button variant="outline" />}>Cancel</DrawerClose>
                                </DrawerFooter>
                            </form>
                        </Form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

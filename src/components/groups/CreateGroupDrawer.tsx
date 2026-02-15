'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Loader2, Plus, X, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
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

const formSchema = z.object({
    name: z.string().min(1, 'Group name is required'),
    type: z.string(),
})

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

    const supabase = createClient()
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
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            // 1. Create Group
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .insert({
                    name: values.name,
                    type: values.type,
                    created_by: user.id,
                })
                .select()
                .single()

            if (groupError) throw groupError

            // 2. Add Members
            // Always add creator
            const membersToAdd = [
                { group_id: group.id, user_id: user.id },
                ...members.map(m => ({
                    group_id: group.id,
                    user_id: m.type === 'REAL' ? m.id : null,
                    ghost_name: m.type === 'GHOST' ? m.name : null,
                }))
            ]

            const { error: membersError } = await supabase
                .from('group_members')
                .insert(membersToAdd)

            if (membersError) throw membersError

            toast.success('Group created successfully')
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            setOpen(false)
            form.reset()
            setMembers([])
        } catch (error) {
            console.error(error)
            toast.error('Failed to create group')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>{children}</DrawerTrigger>
            <DrawerContent className="h-[90vh]">
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
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                                            <X className="h-3 w-3" />
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
                                            <Button type="button" size="sm" onClick={handleAddGhost} disabled={!ghostName.trim()}>
                                                <Plus className="h-4 w-4" />
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
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Group
                                    </Button>
                                    <DrawerClose asChild>
                                        <Button variant="outline">Cancel</Button>
                                    </DrawerClose>
                                </DrawerFooter>
                            </form>
                        </Form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

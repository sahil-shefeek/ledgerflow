'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Loader2, Settings, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { GroupDetails } from '@/hooks/groups/useGroupDetails'

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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const formSchema = z.object({
    name: z.string().min(1, 'Group name is required'),
})

interface GroupSettingsDrawerProps {
    children: React.ReactNode
    groupDetails: GroupDetails
}

export function GroupSettingsDrawer({ children, groupDetails }: GroupSettingsDrawerProps) {
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [transactionCount, setTransactionCount] = useState<number | null>(null)

    const supabase = createClient()
    const queryClient = useQueryClient()
    const router = useRouter()

    const { group, members } = groupDetails

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: group.name,
        },
    })

    const onUpdate = async (values: z.infer<typeof formSchema>) => {
        setIsSubmitting(true)
        try {
            const { error } = await supabase
                .from('groups')
                .update({ name: values.name })
                .eq('id', group.id)

            if (error) throw error

            toast.success('Group updated')
            queryClient.invalidateQueries({ queryKey: ['group', group.id] })
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            setOpen(false)
        } catch (error) {
            console.error(error)
            toast.error('Failed to update group')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Fetch transaction count when opening delete dialog
    const checkTransactions = async () => {
        const { count, error } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)

        if (!error) {
            setTransactionCount(count)
        }
    }

    const onDeleteGroup = async () => {
        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from('groups')
                .delete()
                .eq('id', group.id)

            if (error) throw error

            toast.success('Group deleted')
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            router.push('/dashboard/people?tab=groups')
        } catch (error) {
            console.error(error)
            toast.error('Failed to delete group')
        } finally {
            setIsDeleting(false)
        }
    }

    const onRemoveMember = async (memberId: string) => {
        try {
            const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('id', memberId)

            if (error) throw error

            toast.success('Member removed')
            queryClient.invalidateQueries({ queryKey: ['group', group.id] })
        } catch (error) {
            console.error(error)
            toast.error('Failed to remove member')
        }
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>{children}</DrawerTrigger>
            <DrawerContent className="h-[90vh]">
                <div className="mx-auto w-full max-w-sm h-full flex flex-col">
                    <DrawerHeader>
                        <DrawerTitle>Group Settings</DrawerTitle>
                        <DrawerDescription>Manage your group details and members.</DrawerDescription>
                    </DrawerHeader>

                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-8">
                        {/* Section 1: Rename */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">General</h4>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Group Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Group Name" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" size="sm" disabled={isSubmitting || !form.formState.isDirty}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Changes
                                    </Button>
                                </form>
                            </Form>
                        </div>

                        {/* Section 2: Members */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Members ({members.length})
                            </h4>
                            <div className="space-y-3">
                                {members.map((member) => (
                                    <div key={member.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.avatar_url || member.profiles?.avatar_url || undefined} />
                                                <AvatarFallback>
                                                    {(member.ghost_name || member.profiles?.full_name || '?').slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="text-sm font-medium">
                                                {member.ghost_name || member.profiles?.full_name}
                                                {member.user_id === group.created_by && (
                                                    <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Owner</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Only show Remove if NOT the owner being removed, and current user IS owner */}
                                        {/* Since we don't have auth context here easily without hook, let's assume UI hides triggers if not admin
                                            Actually, let's just make it simple: Owner cannot remove themselves casually here. */}
                                        {member.user_id !== group.created_by && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => onRemoveMember(member.id)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 3: Danger Zone */}
                        <div className="space-y-4 pt-4 border-t">
                            <h4 className="text-sm font-medium text-destructive uppercase tracking-wider">Danger Zone</h4>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        className="w-full"
                                        onClick={checkTransactions}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Group
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete {group.name}?</AlertDialogTitle>
                                        <div className="space-y-3 py-2">
                                            {transactionCount !== null && transactionCount > 0 ? (
                                                <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-900">
                                                    <div className="flex items-start gap-2">
                                                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                        <div className="space-y-1">
                                                            <p className="font-medium">Group History Warning</p>
                                                            <p>
                                                                This group has <span className="font-bold">{transactionCount} transactions</span>.
                                                                Deleting the group will <span className="font-bold">preserve</span> these transactions
                                                                but move them to your personal history.
                                                            </p>
                                                            <p className="text-xs opacity-90 mt-1">
                                                                Note: Any unsettled balances will become individual transactions and you will lose the group tracking context.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the group
                                                    and remove all associated data.
                                                </AlertDialogDescription>
                                            )}
                                        </div>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={onDeleteGroup}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            {transactionCount && transactionCount > 0 ? 'Delete & Keep History' : 'Delete'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

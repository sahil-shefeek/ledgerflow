'use client'

import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Contact } from '@/types'
import { Trash2, Edit, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

interface PersonDetailsDrawerProps {
    person: Contact | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function PersonDetailsDrawer({ person, open, onOpenChange }: PersonDetailsDrawerProps) {
    const supabase = createClient()
    const queryClient = useQueryClient()

    if (!person) return null

    const handleDelete = async () => {
        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', person.id)

        if (error) {
            toast.error('Failed to delete person')
        } else {
            toast.success('Person deleted')
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })
            onOpenChange(false)
        }
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle className="text-center text-xl">{person.name}</DrawerTitle>
                        <DrawerDescription className="text-center">Person Details</DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 space-y-6">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <Avatar className="h-20 w-20 border-2 border-muted">
                                <AvatarImage src={person.image_url || ''} alt={person.name} className="object-cover" />
                                <AvatarFallback className="text-2xl">{person.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-primary">
                                    {person.net_balance < 0 ? '-' : ''}₹{Math.abs(person.net_balance)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {person.net_balance < 0 ? 'You will give' : 'You will get'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <Phone className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Phone</p>
                                    <p className="text-sm text-muted-foreground">{person.phone || 'N/A'}</p>
                                </div>
                            </div>

                            {person.linked_user_id ? (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 text-primary">
                                    <div className="flex items-center gap-2 font-medium">
                                        <span>✅</span>
                                        <span>Connected Friend</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 p-3 rounded-lg border border-border">
                                    <p className="text-sm font-medium">Not on LedgerFlow?</p>
                                    <Button
                                        variant="secondary"
                                        className="w-full gap-2"
                                        onClick={() => {
                                            const link = `${window.location.origin}/invite/contact/${person.invite_token}`
                                            navigator.clipboard.writeText(link)
                                            toast.success('Invite link copied')
                                        }}
                                    >
                                        Copy Invite Link
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1 gap-2" onClick={() => toast.info('Edit feature coming soon')}>
                                <Edit className="h-4 w-4" />
                                Edit
                            </Button>
                            <Button variant="destructive" className="flex-1 gap-2" onClick={handleDelete}>
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                        </div>
                    </div>
                    <DrawerFooter>
                        <DrawerClose asChild>
                            <Button variant="outline">Close</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

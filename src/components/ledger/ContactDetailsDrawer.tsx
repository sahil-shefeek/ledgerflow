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
import { Button } from '@/components/ui/button'
import { Contact } from '@/hooks/useContacts'
import { format } from 'date-fns'
import { Trash2, Edit, Phone, User } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

interface ContactDetailsDrawerProps {
    contact: Contact | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ContactDetailsDrawer({ contact, open, onOpenChange }: ContactDetailsDrawerProps) {
    const supabase = createClient()
    const queryClient = useQueryClient()

    if (!contact) return null

    const handleDelete = async () => {
        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', contact.id)

        if (error) {
            toast.error('Failed to delete contact')
        } else {
            toast.success('Contact deleted')
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            onOpenChange(false)
        }
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle className="text-center text-xl">{contact.name}</DrawerTitle>
                        <DrawerDescription className="text-center">Contact Details</DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 space-y-6">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-primary">
                                    {contact.net_balance < 0 ? '-' : ''}₹{Math.abs(contact.net_balance)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {contact.net_balance < 0 ? 'You will give' : 'You will get'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <Phone className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Phone</p>
                                    <p className="text-sm text-muted-foreground">{contact.phone || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <div className="h-5 w-5 flex items-center justify-center text-muted-foreground font-bold text-xs">ID</div>
                                <div>
                                    <p className="text-sm font-medium">Contact ID</p>
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{contact.id}</p>
                                </div>
                            </div>
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

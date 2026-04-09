'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { useAddPerson } from '@/hooks/personal/useAddPerson'
import { useUpdateContact } from '@/hooks/useUpdateContact'
import { Loader2 } from 'lucide-react'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { Contact } from '@/types'
import { useDetectUser, DetectedUser } from '@/hooks/friends/useDetectUser'
import { useFriendRequestActions } from '@/hooks/friends/useFriendRequestActions'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const personSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().optional(),
    image_url: z.string().optional(),
})

interface AddPersonDrawerProps {
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: Contact
}

export function AddPersonDrawer({ children, open, onOpenChange, initialData }: AddPersonDrawerProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = open !== undefined
    const isOpen = isControlled ? open : internalOpen
    const setIsOpen = isControlled ? onOpenChange : setInternalOpen

    const { mutate: addPerson, isPending: isAdding } = useAddPerson()
    const { mutate: updatePerson, isPending: isUpdating } = useUpdateContact()
    const isPending = isAdding || isUpdating

    const [detectedUser, setDetectedUser] = useState<DetectedUser | null>(null)
    const { mutate: detectUser, isPending: isDetecting } = useDetectUser()
    const { sendRequest } = useFriendRequestActions()

    const form = useForm<z.infer<typeof personSchema>>({
        resolver: zodResolver(personSchema),
        defaultValues: {
            name: initialData?.name || '',
            phone: initialData?.phone || '',
            image_url: initialData?.image_url || '',
        },
    })

    const phoneValue = form.watch('phone')

    useEffect(() => {
        if (phoneValue && phoneValue.length > 8) {
            const timeoutId = setTimeout(() => {
                detectUser(phoneValue, {
                    onSuccess: (data) => setDetectedUser(data || null),
                    onError: () => setDetectedUser(null)
                })
            }, 500)
            return () => clearTimeout(timeoutId)
        } else {
            setDetectedUser(null)
        }
    }, [phoneValue, detectUser])

    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name,
                phone: initialData.phone || '',
                image_url: initialData.image_url || '',
            })
        } else {
            form.reset({
                name: '',
                phone: '',
                image_url: '',
            })
        }
    }, [initialData, form])

    function onSubmit(values: z.infer<typeof personSchema>) {
        if (initialData) {
            updatePerson({ id: initialData.id, ...values }, {
                onSuccess: () => {
                    if (detectedUser) {
                        sendRequest.mutate({ targetUserId: detectedUser.id, contactId: initialData.id }, {
                            onSuccess: () => {
                                setIsOpen?.(false)
                                form.reset()
                                setDetectedUser(null)
                            }
                        })
                    } else {
                        setIsOpen?.(false)
                        form.reset()
                        setDetectedUser(null)
                    }
                }
            })
        } else {
            addPerson(values, {
                onSuccess: (contact) => {
                    if (detectedUser && contact) {
                        sendRequest.mutate({ targetUserId: detectedUser.id, contactId: contact.id }, {
                            onSuccess: () => {
                                setIsOpen?.(false)
                                form.reset()
                                setDetectedUser(null)
                            }
                        })
                    } else {
                        setIsOpen?.(false)
                        form.reset()
                        setDetectedUser(null)
                    }
                },
            })
        }
    }

    return (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            {children && <DrawerTrigger asChild>{children}</DrawerTrigger>}
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>{initialData ? 'Edit Person' : 'Add New Person'}</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="image_url"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Photo</FormLabel>
                                            <FormControl>
                                                <AvatarUpload
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    name={form.watch('name')}
                                                    folder="contacts"
                                                />
                                            </FormControl>
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
                                                <Input placeholder="Jane Doe" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone (Optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="+91..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {detectedUser && (
                                    <Card className="p-3 bg-muted/50 border-primary/20 flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border border-border">
                                                    <AvatarImage src={detectedUser.avatar_url || ''} />
                                                    <AvatarFallback>{detectedUser.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h4 className="font-medium text-sm">{detectedUser.full_name}</h4>
                                                    <p className="text-xs text-muted-foreground">User found on LedgerFlow!</p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                                LedgerFlow
                                            </Badge>
                                        </div>
                                    </Card>
                                )}

                                <Button type="submit" className="w-full" disabled={isPending || sendRequest.isPending || isDetecting}>
                                    {(isPending || sendRequest.isPending || isDetecting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {detectedUser ? 'Save & Send Friend Request' : initialData ? 'Save Changes' : 'Add Person'}
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer >
    )
}

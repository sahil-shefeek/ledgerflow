'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAddBusinessContact } from '@/hooks/business/useAddBusinessContact'
import { useUpdateContact } from '@/hooks/useUpdateContact'
import { Loader2 } from 'lucide-react'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { Contact } from '@/types'

const contactSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().optional(),
    type: z.enum(['CUSTOMER', 'SUPPLIER', 'OTHER']),
    image_url: z.string().optional(),
})

interface AddBusinessContactDrawerProps {
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: Contact
}

export function AddBusinessContactDrawer({ children, open, onOpenChange, initialData }: AddBusinessContactDrawerProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = open !== undefined
    const isOpen = isControlled ? open : internalOpen
    const setIsOpen = isControlled ? onOpenChange : setInternalOpen

    const { mutate: addContact, isPending: isAdding } = useAddBusinessContact()
    const { mutate: updateContact, isPending: isUpdating } = useUpdateContact()
    const isPending = isAdding || isUpdating

    const form = useForm<z.infer<typeof contactSchema>>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: initialData?.name || '',
            phone: initialData?.phone || '',
            type: initialData?.type || 'CUSTOMER',
            image_url: initialData?.image_url || '',
        },
    })

    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name,
                phone: initialData.phone || '',
                type: initialData.type,
                image_url: initialData.image_url || '',
            })
        } else {
            form.reset({
                name: '',
                phone: '',
                type: 'CUSTOMER',
                image_url: '',
            })
        }
    }, [initialData, form])

    function onSubmit(values: z.infer<typeof contactSchema>) {
        if (initialData) {
            updateContact({ id: initialData.id, ...values }, {
                onSuccess: () => {
                    setIsOpen?.(false)
                    form.reset()
                }
            })
        } else {
            addContact(values, {
                onSuccess: () => {
                    setIsOpen?.(false)
                    form.reset()
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
                        <DrawerTitle>{initialData ? 'Edit Contact' : 'Add New Contact'}</DrawerTitle>
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
                                                <Input placeholder="John Doe" {...field} />
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
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                                                    <SelectItem value="SUPPLIER">Supplier</SelectItem>
                                                    <SelectItem value="OTHER">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {initialData ? 'Save Changes' : 'Add Contact'}
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer >
    )
}

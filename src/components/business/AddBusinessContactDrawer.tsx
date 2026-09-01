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
import { Icon } from "@/components/ui/icon";
import { LoaderIcon } from "@hugeicons/core-free-icons";
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { Contact } from '@/types'

import { baseContactSchema } from '@/lib/validations/contact'

const contactSchema = baseContactSchema.extend({
    type: z.enum(['CUSTOMER', 'SUPPLIER', 'OTHER']),
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
            {children && <DrawerTrigger render={children as React.ReactElement} />}
            <DrawerContent className="max-h-[90dvh]">
                <div className="mx-auto w-full max-w-sm flex flex-col min-h-0 max-h-[90dvh]">
                    <DrawerHeader className="shrink-0">
                        <DrawerTitle>{initialData ? 'Edit Contact' : 'Add New Contact'}</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8 overflow-y-auto flex-1 min-h-0">
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
                                            <Select items={[ {value: 'CUSTOMER', label: 'Customer'}, {value: 'SUPPLIER', label: 'Supplier'}, {value: 'OTHER', label: 'Other'} ]} onValueChange={field.onChange} defaultValue={field.value}>
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
                                    {isPending && <Icon icon={LoaderIcon} className="mr-2 h-4 w-4 animate-spin" />}
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

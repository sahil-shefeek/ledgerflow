'use client'

import { useState, useEffect } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Loader2, Plus } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const categorySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    icon: z.string().min(1, 'Icon is required'), // In a real app, use an emoji picker
    type: z.enum(['INCOME', 'EXPENSE']),
})

interface CategoryDrawerProps {
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    initialData?: any
}

export function CategoryDrawer({
    children,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    initialData
}: CategoryDrawerProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen ?? internalOpen
    const setOpen = setControlledOpen ?? setInternalOpen

    const supabase = createClient()
    const queryClient = useQueryClient()
    const [isPending, setIsPending] = useState(false)

    const form = useForm({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: '',
            icon: '💰',
            type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
        },
    })

    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name,
                icon: initialData.icon,
                type: initialData.type,
            })
        } else {
            form.reset({
                name: '',
                icon: '💰',
                type: 'EXPENSE',
            })
        }
    }, [initialData, form, open])

    const handleSubmit = async (values: any) => {
        setIsPending(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            if (initialData?.id) {
                const { error } = await supabase
                    .from('categories')
                    .update({ ...values })
                    .eq('id', initialData.id)
                if (error) throw error
                toast.success('Category updated')
            } else {
                const { error } = await supabase
                    .from('categories')
                    .insert({ ...values, user_id: user.id, active: true })
                if (error) throw error
                toast.success('Category created')
            }

            queryClient.invalidateQueries({ queryKey: ['categories'] })
            setOpen(false)
            form.reset()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {children}
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle>{initialData ? 'Edit Category' : 'Add Category'}</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Groceries, Rent, etc." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="icon"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Icon (Emoji)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="🍔" {...field} />
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
                                                        <SelectItem value="EXPENSE">Expense</SelectItem>
                                                        <SelectItem value="INCOME">Income</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {initialData ? 'Update Category' : 'Create Category'}
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

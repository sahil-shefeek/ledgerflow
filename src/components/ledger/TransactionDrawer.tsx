'use client'

import { useState } from 'react'
import { Drawer } from 'vaul'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAddTransaction } from '@/hooks/useAddTransaction'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Loader2, Minus, Plus } from 'lucide-react'
import { useContacts } from '@/hooks/useContacts'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

const transactionSchema = z.object({
    amount: z.number().min(1, 'Amount must be greater than 0'),
    description: z.string().optional(),
    contact_id: z.string().optional(),
    date: z.date(),
    flow: z.enum(['IN', 'OUT']),
})

export function TransactionDrawer() {
    const [open, setOpen] = useState(false)
    const { mutate: addTransaction, isPending } = useAddTransaction()
    const { data: contacts } = useContacts()

    const [amountString, setAmountString] = useState('')
    const [flow, setFlow] = useState<'IN' | 'OUT'>('OUT')

    const form = useForm<z.infer<typeof transactionSchema>>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            amount: 0,
            description: '',
            date: new Date(),
            flow: 'OUT',
        },
    })

    const handleNumberClick = (num: string) => {
        if (num === '.' && amountString.includes('.')) return
        setAmountString((prev) => prev + num)
        form.setValue('amount', parseFloat((amountString + num)))
    }

    const handleBackspace = () => {
        setAmountString((prev) => {
            const newStr = prev.slice(0, -1)
            form.setValue('amount', newStr ? parseFloat(newStr) : 0)
            return newStr
        })
    }

    const onSubmit = (values: z.infer<typeof transactionSchema>) => {
        if (!values.contact_id) {
            // Handle error or require contact
            return
        }

        addTransaction(
            {
                ...values,
                mode: 'BUSINESS',
                flow: flow,
            },
            {
                onSuccess: () => {
                    setOpen(false)
                    setAmountString('')
                    form.reset()
                },
            }
        )
    }

    return (
        <Drawer.Root open={open} onOpenChange={setOpen}>
            <Drawer.Trigger asChild>
                <Button className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg md:bottom-8 md:right-8">
                    <Plus className="h-6 w-6" />
                </Button>
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 mt-24 flex h-[90vh] flex-col rounded-t-[10px] bg-background outline-none">
                    <div className="flex-1 overflow-y-auto rounded-t-[10px] p-4">
                        <div className="mx-auto mb-8 h-1.5 w-12 flex-shrink-0 rounded-full bg-muted" />
                        <div className="mx-auto max-w-md">
                            <Drawer.Title className="mb-4 text-center text-xl font-bold">
                                New Transaction
                            </Drawer.Title>

                            <div className="mb-6 flex justify-center gap-4">
                                <Button
                                    variant={flow === 'OUT' ? 'destructive' : 'outline'}
                                    className={cn('w-32', flow === 'OUT' && 'bg-red-600 hover:bg-red-700')}
                                    onClick={() => {
                                        setFlow('OUT')
                                        form.setValue('flow', 'OUT')
                                    }}
                                >
                                    <Minus className="mr-2 h-4 w-4" />
                                    Gave
                                </Button>
                                <Button
                                    variant={flow === 'IN' ? 'default' : 'outline'}
                                    className={cn('w-32', flow === 'IN' && 'bg-green-600 hover:bg-green-700')}
                                    onClick={() => {
                                        setFlow('IN')
                                        form.setValue('flow', 'IN')
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Got
                                </Button>
                            </div>

                            <div className="mb-8 text-center">
                                <div className={cn("text-4xl font-bold", flow === 'OUT' ? 'text-red-600' : 'text-green-600')}>
                                    ₹{amountString || '0'}
                                </div>
                            </div>

                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Contact</Label>
                                    <Select
                                        onValueChange={(value: string) => form.setValue('contact_id', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select contact" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {contacts?.map((contact) => (
                                                <SelectItem key={contact.id} value={contact.id}>
                                                    {contact.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input {...form.register('description')} placeholder="Note (optional)" />
                                </div>

                                {/* Number Pad */}
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                                        <Button
                                            key={num}
                                            type="button"
                                            variant="outline"
                                            className="h-12 text-lg"
                                            onClick={() => handleNumberClick(num.toString())}
                                        >
                                            {num}
                                        </Button>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-12"
                                        onClick={handleBackspace}
                                    >
                                        ⌫
                                    </Button>
                                </div>

                                <Button type="submit" className="w-full mt-4" disabled={isPending || !amountString}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Transaction
                                </Button>
                            </form>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}

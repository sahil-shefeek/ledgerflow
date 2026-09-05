'use client'

import { useParams, useRouter } from 'next/navigation'
import { useBusinessContacts } from '@/hooks/business/useBusinessContacts'
import { useContactTransactions } from '@/hooks/useContactTransactions'
import { Button } from '@/components/ui/button'
import { Icon } from "@/components/ui/icon";
import { MoreVerticalIcon, ArrowUpDownIcon, FilterIcon, ArrowLeft05Icon, TrashIcon, ReceiptIcon, Edit04Icon, PlusIcon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTransactionDate, filterAndSortTransactions, TimeFilter, SortOption } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import { AddBusinessContactDrawer } from '@/components/business/AddBusinessContactDrawer'
import { BusinessTransactionDrawer } from '@/components/business/BusinessTransactionDrawer'
import { TransactionDetailsDrawer } from '@/components/finance/TransactionDetailsDrawer'
import { useState, useMemo } from 'react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ActionDrawer } from '@/components/ui/action-drawer'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDeleteContact } from '@/hooks/useDeleteContact'
import { LoaderIcon } from "@hugeicons/core-free-icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { TransactionWithJoins } from '@/types'
import { paiseToRupees } from "@/lib/currency";

export default function LedgerPage() {
    const params = useParams()
    const router = useRouter()
    const contactId = params.contactId as string
    const { data: contacts } = useBusinessContacts()
    const { data: transactions, isLoading } = useContactTransactions(contactId)
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL')
    const [sortBy, setSortBy] = useState<SortOption>('LATEST')
    const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithJoins | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<TransactionWithJoins | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [contactEditOpen, setContactEditOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

    const { mutate: deleteContact, isPending: isDeleting } = useDeleteContact()

    const handleDeleteContact = () => {
        deleteContact(contactId, {
            onSuccess: () => {
                router.push('/dashboard/ledger')
            }
        })
    }


    const contact = contacts?.find(c => c.id === contactId)

    const filteredTransactions = useMemo(() => {
        return filterAndSortTransactions(transactions, timeFilter, sortBy)
    }, [transactions, timeFilter, sortBy])

    if (!contact) {
        return (
            <div className="flex h-[50dvh] flex-col items-center justify-center">
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <div className="p-3 bg-muted rounded-full">
                                <Icon icon={ArrowLeft05Icon} className="h-6 w-6 text-muted-foreground" />
                            </div>
                        </EmptyMedia>
                        <EmptyTitle>Contact Not Found</EmptyTitle>
                        <EmptyDescription>
                            The contact you are looking for does not exist or has been deleted.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button onClick={() => router.push('/dashboard')}>
                            Go Back to Dashboard
                        </Button>
                    </EmptyContent>
                </Empty>
            </div>
        )
    }

    return (
        <div className="space-y-4 @container">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-muted">
                        <AvatarImage src={contact.image_url || undefined} alt={contact.name} className="object-cover" />
                        <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h1 className="text-2xl font-bold tracking-tight">{contact.name}</h1>
                </div>
                <div className="ml-auto">
                    {/* Desktop dropdown */}
                    <div className="hidden @sm:flex">
                        <DropdownMenu>
                            <DropdownMenuTrigger render={
                                <Button variant="ghost" size="icon" aria-label={`More options for ${contact.name}`} />
                            }>
                                <Icon icon={MoreVerticalIcon} className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setContactEditOpen(true)}>
                                    <Icon icon={Edit04Icon} className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    <Icon icon={TrashIcon} className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Mobile ActionDrawer bottom sheet */}
                    <div className="flex @sm:hidden">
                        <ActionDrawer
                            title={contact.name}
                            description="Contact Options"
                            triggerOrientation="vertical"
                            triggerAriaLabel={`More options for ${contact.name}`}
                            actions={[
                                {
                                    label: 'Edit Contact',
                                    icon: Edit04Icon,
                                    onClick: () => setContactEditOpen(true),
                                },
                                {
                                    label: 'Delete Contact',
                                    icon: TrashIcon,
                                    variant: 'destructive',
                                    onClick: () => setDeleteDialogOpen(true),
                                },
                            ]}
                        />
                    </div>
                </div>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">
                            {contact.net_balance > 0 ? 'You will get' : contact.net_balance < 0 ? 'You will give' : 'Settled'}
                        </div>
                        <div className={cn(
                            "text-4xl font-bold",
                            contact.net_balance > 0 ? "text-green-600" : contact.net_balance < 0 ? "text-red-600" : "text-muted-foreground"
                        )}>
                            ₹{paiseToRupees(Math.abs(contact.net_balance)).toNumber().toLocaleString()}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Transactions</h2>
                    <div className="flex gap-2">
                        <Select items={[ {value: 'ALL', label: 'All Time'}, {value: 'TODAY', label: 'Today'}, {value: 'WEEK', label: 'This Week'}, {value: 'MONTH', label: 'This Month'}, {value: 'YEAR', label: 'This Year'} ]} value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                            <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue placeholder="Filter" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Time</SelectItem>
                                <SelectItem value="TODAY">Today</SelectItem>
                                <SelectItem value="WEEK">This Week</SelectItem>
                                <SelectItem value="MONTH">This Month</SelectItem>
                                <SelectItem value="YEAR">This Year</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select items={[ {value: 'LATEST', label: 'Latest'}, {value: 'OLDEST', label: 'Oldest'}, {value: 'HIGHEST', label: 'Highest Amount'}, {value: 'LOWEST', label: 'Lowest Amount'} ]} value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                            <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue placeholder="Sort" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LATEST">Latest</SelectItem>
                                <SelectItem value="OLDEST">Oldest</SelectItem>
                                <SelectItem value="HIGHEST">Highest Amount</SelectItem>
                                <SelectItem value="LOWEST">Lowest Amount</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Icon icon={LoaderIcon} className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredTransactions?.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Icon icon={ReceiptIcon} />
                            </EmptyMedia>
                            <EmptyTitle>No transactions found</EmptyTitle>
                            <EmptyDescription>
                                Try adjusting your filters or add a new transaction.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <div className="space-y-4">
                        {filteredTransactions?.map((t) => (
                            <Card
                                key={t.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                    setSelectedTransaction(t)
                                    setDetailsOpen(true)
                                }}
                            >
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="font-medium">{t.name || 'No description'}</div>
                                        {t.note && <div className="text-xs text-muted-foreground">{t.note}</div>}
                                        <div className="text-xs text-muted-foreground">
                                            {formatTransactionDate(new Date(t.date))}
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "font-bold",
                                        t.flow === 'IN' ? "text-green-600" : "text-red-600"
                                    )}>
                                        {t.flow === 'IN' ? '+' : '-'}₹{paiseToRupees(t.amount).toNumber().toLocaleString()}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            <BusinessTransactionDrawer
                open={editOpen}
                onOpenChange={setEditOpen}
                initialData={editingTransaction || { contact_id: contactId }}
                hideContactSelect={true}
                hideTrigger={true}
            />

            <TransactionDetailsDrawer
                transaction={selectedTransaction}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                onEdit={(tx) => {
                    setDetailsOpen(false)
                    setEditingTransaction(tx)
                    setEditOpen(true)
                }}
            />

            <AddBusinessContactDrawer
                open={contactEditOpen}
                onOpenChange={setContactEditOpen}
                initialData={contact}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the contact
                            and all associated transactions.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDeleteContact()
                            }}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Icon icon={LoaderIcon} className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}

'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBusinesses, useCreateBusiness } from '@/hooks/useBusinesses'
import { useAppStore } from '@/store/useAppStore'
import { useState, useEffect } from 'react'

export function BusinessSwitcher() {
    const [open, setOpen] = useState(false)
    const [showNewBusinessDialog, setShowNewBusinessDialog] = useState(false)
    const { data: businesses, isLoading } = useBusinesses()
    const { currentBusinessId, setCurrentBusinessId } = useAppStore()
    const { mutate: createBusiness, isPending } = useCreateBusiness()
    const [newBusinessName, setNewBusinessName] = useState('')

    const selectedBusiness = businesses?.find((b) => b.id === currentBusinessId)

    // Select first business if none selected
    useEffect(() => {
        if (!isLoading && businesses && businesses.length > 0 && !currentBusinessId) {
            setCurrentBusinessId(businesses[0].id)
        }
    }, [businesses, currentBusinessId, isLoading, setCurrentBusinessId])

    const handleCreateBusiness = () => {
        if (!newBusinessName.trim()) return
        createBusiness(newBusinessName, {
            onSuccess: (data) => {
                setShowNewBusinessDialog(false)
                setNewBusinessName('')
                setCurrentBusinessId(data.id)
            },
        })
    }

    if (isLoading) return <div className="w-[200px] h-10 animate-pulse bg-muted rounded-md" />

    return (
        <Dialog open={showNewBusinessDialog} onOpenChange={setShowNewBusinessDialog}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[200px] justify-between"
                    >
                        {selectedBusiness ? (
                            <div className="flex items-center gap-2 truncate">
                                <Building2 className="h-4 w-4 shrink-0 opacity-50" />
                                <span className="truncate">{selectedBusiness.name}</span>
                            </div>
                        ) : (
                            "Select Business"
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command>
                        <CommandInput placeholder="Search business..." />
                        <CommandList>
                            <CommandEmpty>No business found.</CommandEmpty>
                            <CommandGroup heading="Businesses">
                                {businesses?.map((business) => (
                                    <CommandItem
                                        key={business.id}
                                        onSelect={() => {
                                            setCurrentBusinessId(business.id)
                                            setOpen(false)
                                        }}
                                        className="text-sm"
                                    >
                                        <Building2 className="mr-2 h-4 w-4 opacity-50" />
                                        {business.name}
                                        <Check
                                            className={cn(
                                                "ml-auto h-4 w-4",
                                                currentBusinessId === business.id
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                        <CommandSeparator />
                        <CommandList>
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => {
                                        setOpen(false)
                                        setShowNewBusinessDialog(true)
                                    }}
                                >
                                    <Plus className="mr-2 h-5 w-5" />
                                    Create Business
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Business</DialogTitle>
                    <DialogDescription>
                        Add a new business ledger to track transactions separately.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 pb-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Business Name</Label>
                        <Input
                            id="name"
                            placeholder="Acme Corp."
                            value={newBusinessName}
                            onChange={(e) => setNewBusinessName(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowNewBusinessDialog(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreateBusiness} disabled={isPending}>
                        {isPending ? "Creating..." : "Create Business"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

'use client'

import { useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBudgets } from '@/hooks/useBudgets'
import { useUpdateCategory } from '@/hooks/useUpdateCategory'
import { useAddCategory } from '@/hooks/useAddCategory'
import { Loader2, Settings2, Plus, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const PRESET_ICONS = ['🍔', '🚗', '🎬', '🛍️', '💡', '🏥', '✈️', '🏠', '📚', '🏋️', '🍕', '🍺', '🎁', '🔧']

export function ManageCategoriesDrawer() {
    const [open, setOpen] = useState(false)
    const { data: budgets, isLoading } = useBudgets()
    const { mutate: updateCategory } = useUpdateCategory()
    const { mutate: addCategory, isPending: isAdding } = useAddCategory()

    const [newCategoryName, setNewCategoryName] = useState('')
    const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0])
    const [isAddingMode, setIsAddingMode] = useState(false)

    const handleAddCategory = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newCategoryName.trim()) return

        addCategory({
            name: newCategoryName,
            icon: selectedIcon,
            type: 'EXPENSE'
        }, {
            onSuccess: () => {
                setNewCategoryName('')
                setIsAddingMode(false)
            }
        })
    }

    if (isLoading) return null

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings2 className="h-4 w-4" />
                </Button>
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-md">
                    <DrawerHeader>
                        <DrawerTitle className="text-center">Manage Categories</DrawerTitle>
                    </DrawerHeader>

                    <div className="p-4 pb-8 overflow-y-auto max-h-[80vh] space-y-6">
                        {isAddingMode ? (
                            <div className="space-y-4 animate-in slide-in-from-right">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium">New Category</h3>
                                    <Button variant="ghost" size="sm" onClick={() => setIsAddingMode(false)}>
                                        Cancel
                                    </Button>
                                </div>
                                <form onSubmit={handleAddCategory} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input
                                            placeholder="e.g. Subscriptions"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Icon</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {PRESET_ICONS.map(icon => (
                                                <button
                                                    key={icon}
                                                    type="button"
                                                    onClick={() => setSelectedIcon(icon)}
                                                    className={`h-10 w-10 rounded-full text-xl flex items-center justify-center transition-colors ${selectedIcon === icon
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'bg-muted hover:bg-muted/80'
                                                        }`}
                                                >
                                                    {icon}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isAdding || !newCategoryName}>
                                        {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Category
                                    </Button>
                                </form>
                            </div>
                        ) : (
                            <>
                                <Button className="w-full" onClick={() => setIsAddingMode(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add New Category
                                </Button>

                                <div className="space-y-4">
                                    {budgets?.map((budget) => (
                                        <div key={budget.id} className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                                    <span className="text-lg">{budget.icon || '💰'}</span>
                                                </div>
                                                <div>
                                                    <p className="font-medium">{budget.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Spent: ₹{budget.spent.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-28">
                                                <Input
                                                    type="number"
                                                    placeholder="Limit"
                                                    className="h-8"
                                                    defaultValue={budget.budget_limit || ''}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value)
                                                        if (!isNaN(val) && val !== budget.budget_limit) {
                                                            updateCategory({ id: budget.id, budget_limit: val })
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCategories, updateCategory } from '@/lib/actions/categories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CategoryDrawer } from '@/components/finance/CategoryDrawer'
import { CategoryActionDialog } from '@/components/finance/CategoryActionDialog'
import { DynamicIcon } from '@/components/ui/DynamicIcon'
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon, MoreVerticalIcon, Edit02Icon, Delete02Icon, ViewOffIcon, TickDouble02Icon, Loading02Icon } from "@hugeicons/core-free-icons"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { ActionDrawer } from '@/components/ui/action-drawer'

export function CategoriesContent() {
    const queryClient = useQueryClient()
    const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; type: 'INCOME' | 'EXPENSE'; icon: string } | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [actionCategory, setActionCategory] = useState<{ id: string; name: string; type: 'INCOME' | 'EXPENSE'; icon: string } | null>(null)
    const [actionType, setActionType] = useState<'DELETE' | 'DISABLE' | null>(null)

    const { data: categories, isLoading } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            return await getCategories()
        }
    })

    const handleEnable = async (category: { id: string }) => {
        try {
            await updateCategory({ id: category.id, active: true })
            toast.success('Category enabled')
            queryClient.invalidateQueries({ queryKey: ['categories'] })
        } catch {
            toast.error('Failed to enable category')
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">Manage Categories</h1>
                </div>
                <CategoryDrawer>
                    <Button>
                        <HugeiconsIcon icon={PlusSignIcon} className="mr-2 h-4 w-4" />
                        Add Category
                    </Button>
                </CategoryDrawer>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Categories</CardTitle>
                </CardHeader>
                <CardContent className="@container">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <HugeiconsIcon icon={Loading02Icon} className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
                            {categories?.map((category) => (
                                <div
                                    key={category.id}
                                    data-testid="category-item"
                                    className={`flex items-center justify-between p-4 border rounded-lg group ${!category.active ? 'opacity-60 bg-muted/50' : 'bg-card hover:bg-accent/40'} transition-colors`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xl">
                                            <DynamicIcon name={category.icon || ''} size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{category.name}</p>
                                                {!category.active && (
                                                    <Badge variant="outline" className="text-[10px] h-5">Disabled</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground capitalize">
                                                {category.type.toLowerCase()}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Desktop actions: DropdownMenu with hover state */}
                                    <div className="hidden @sm:flex">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger render={
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                                                    aria-label={`More options for ${category.name}`}
                                                />
                                            }>
                                                <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                    setEditingCategory(category)
                                                    setEditOpen(true)
                                                }}>
                                                    <HugeiconsIcon icon={Edit02Icon} className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>

                                                {category.active ? (
                                                    <DropdownMenuItem onClick={() => {
                                                        setActionCategory(category)
                                                        setActionType('DISABLE')
                                                    }}>
                                                        <HugeiconsIcon icon={ViewOffIcon} className="mr-2 h-4 w-4" />
                                                        Disable
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => handleEnable(category)}>
                                                        <HugeiconsIcon icon={TickDouble02Icon} className="mr-2 h-4 w-4" />
                                                        Enable
                                                    </DropdownMenuItem>
                                                )}

                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => {
                                                        setActionCategory(category)
                                                        setActionType('DELETE')
                                                    }}
                                                >
                                                    <HugeiconsIcon icon={Delete02Icon} className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {/* Mobile actions: ActionDrawer Bottom Sheet */}
                                    <div className="flex @sm:hidden">
                                        <ActionDrawer
                                            title={category.name}
                                            description={`${category.type.toLowerCase()} category`}
                                            triggerOrientation="vertical"
                                            triggerAriaLabel={`More options for ${category.name}`}
                                            actions={[
                                                {
                                                    label: 'Edit',
                                                    icon: <HugeiconsIcon icon={Edit02Icon} className="h-5 w-5" />,
                                                    onClick: () => {
                                                        setEditingCategory(category)
                                                        setEditOpen(true)
                                                    },
                                                },
                                                category.active
                                                    ? {
                                                          label: 'Disable',
                                                          icon: <HugeiconsIcon icon={ViewOffIcon} className="h-5 w-5" />,
                                                          onClick: () => {
                                                              setActionCategory(category)
                                                              setActionType('DISABLE')
                                                          },
                                                      }
                                                    : {
                                                          label: 'Enable',
                                                          icon: <HugeiconsIcon icon={TickDouble02Icon} className="h-5 w-5" />,
                                                          onClick: () => handleEnable(category),
                                                      },
                                                {
                                                    label: 'Delete',
                                                    icon: <HugeiconsIcon icon={Delete02Icon} className="h-5 w-5" />,
                                                    variant: 'destructive',
                                                    onClick: () => {
                                                        setActionCategory(category)
                                                        setActionType('DELETE')
                                                    },
                                                },
                                            ]}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <CategoryDrawer
                open={editOpen}
                onOpenChange={setEditOpen}
                initialData={editingCategory || undefined}
            />

            <CategoryActionDialog
                category={actionCategory}
                action={actionType}
                onClose={() => {
                    setActionType(null)
                    setActionCategory(null)
                }}
            />
        </div>
    )
}

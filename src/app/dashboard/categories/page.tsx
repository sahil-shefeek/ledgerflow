'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, MoreVertical, Edit, Trash2, EyeOff, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'
import { CategoryDrawer } from '@/components/finance/CategoryDrawer'
import { CategoryActionDialog } from '@/components/finance/CategoryActionDialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function CategoriesPage() {
    const supabase = createClient()
    const router = useRouter()
    const queryClient = useQueryClient()
    const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; type: 'INCOME' | 'EXPENSE'; icon: string } | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [actionCategory, setActionCategory] = useState<{ id: string; name: string; type: 'INCOME' | 'EXPENSE'; icon: string } | null>(null)
    const [actionType, setActionType] = useState<'DELETE' | 'DISABLE' | null>(null)

    const { data: categories, isLoading } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('active', { ascending: false }) // Active first
                .order('name', { ascending: true })

            if (error) throw error
            return data
        }
    })

    const handleEnable = async (category: { id: string }) => {
        const { error } = await supabase
            .from('categories')
            .update({ active: true })
            .eq('id', category.id)

        if (error) {
            toast.error('Failed to enable category')
        } else {
            toast.success('Category enabled')
            queryClient.invalidateQueries({ queryKey: ['categories'] })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">Manage Categories</h1>
                </div>
                <CategoryDrawer>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Category
                    </Button>
                </CategoryDrawer>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Categories</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {categories?.map((category) => (
                                <div
                                    key={category.id}
                                    className={`flex items-center justify-between p-4 border rounded-lg ${!category.active ? 'opacity-60 bg-muted/50' : 'bg-card'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xl">
                                            {category.icon}
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

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => {
                                                setEditingCategory(category)
                                                setEditOpen(true)
                                            }}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>

                                            {category.active ? (
                                                <DropdownMenuItem onClick={() => {
                                                    setActionCategory(category)
                                                    setActionType('DISABLE')
                                                }}>
                                                    <EyeOff className="mr-2 h-4 w-4" />
                                                    Disable
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem onClick={() => handleEnable(category)}>
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
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
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
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

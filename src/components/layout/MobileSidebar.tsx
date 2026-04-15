'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Briefcase, LogOut, Menu, Wallet, Settings, Users, LayoutDashboard, PieChart, List } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { useProfile } from '@/hooks/use-profile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function MobileSidebar() {
    const { mode, toggleMode } = useAppStore()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const { profile } = useProfile()

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut()
            window.location.href = '/login'
        } catch {
            toast.error('Failed to sign out. Please try again.')
        }
    }

    const handleModeSwitch = () => {
        toggleMode()
        router.push('/dashboard')
        setOpen(false)
    }

    const navItems = [
        {
            label: 'Dashboard',
            href: '/dashboard',
            icon: LayoutDashboard,
        },
        {
            label: 'Friends',
            href: '/dashboard/friends',
            icon: Users,
            showIn: 'personal',
        },
        {
            label: 'Groups',
            href: '/dashboard/friends?tab=groups',
            icon: Users,
            showIn: 'personal',
        },
        {
            label: 'Analytics',
            href: '/dashboard/analytics',
            icon: PieChart,
            showIn: 'personal',
        },
        {
            label: 'Manage Categories',
            href: '/dashboard/categories',
            icon: List,
            showIn: 'personal',
        },
        {
            label: 'Settings',
            href: '/dashboard/settings',
            icon: Settings,
        },
    ]

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left">
                <SheetHeader className="text-left">
                    <SheetTitle>Menu</SheetTitle>
                    <div className="flex items-center gap-3 mt-4 mb-2">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'User'} />
                            <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="font-semibold">{profile?.full_name || 'LedgerFlow'}</span>
                            <span className="text-xs text-muted-foreground">{mode === 'business' ? profile?.business_name || 'Business' : 'Personal Finance'}</span>
                        </div>
                    </div>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-4">
                    {navItems.map((item) => {
                        if (item.showIn && item.showIn !== mode) return null
                        const Icon = item.icon

                        let isActive = pathname === item.href

                        // Special handling for Friends vs Groups
                        if (item.href === '/dashboard/friends') {
                            isActive = pathname === '/dashboard/friends' && !searchParams.has('tab')
                        } else if (item.href === '/dashboard/friends?tab=groups') {
                            isActive = pathname === '/dashboard/friends' && searchParams.get('tab') === 'groups'
                        } else {
                            isActive = pathname === item.href
                        }

                        return (
                            <Button
                                key={item.href}
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start gap-2",
                                    isActive && "bg-secondary text-secondary-foreground"
                                )}
                                onClick={() => {
                                    router.push(item.href)
                                    setOpen(false)
                                }}
                            >
                                <Icon className="h-4 w-4" />
                                <span>{item.label}</span>
                            </Button>
                        )
                    })}

                    <div className="my-2 border-t" />

                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-2"
                        onClick={handleModeSwitch}
                    >
                        {mode === 'business' ? (
                            <>
                                <Wallet className="h-4 w-4" />
                                <span>Switch to Personal</span>
                            </>
                        ) : (
                            <>
                                <Briefcase className="h-4 w-4" />
                                <span>Switch to Business</span>
                            </>
                        )}
                    </Button>

                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}

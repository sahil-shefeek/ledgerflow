'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Users,
    PieChart,
    Settings,
    LogOut,
    Moon,
    Sun,
    Briefcase,
    Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

import { useProfile } from '@/hooks/use-profile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function Sidebar() {
    const pathname = usePathname()
    const { mode, toggleMode } = useAppStore()
    const router = useRouter()
    const supabase = createClient()
    const { profile } = useProfile()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const navItems = [
        {
            label: 'Dashboard',
            href: '/dashboard',
            icon: LayoutDashboard,
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
            icon: Users,
            showIn: 'personal',
        },
        {
            label: 'Settings',
            href: '/dashboard/settings',
            icon: Settings,
        },
    ]

    return (
        <div className="hidden h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
            <div className="flex h-16 items-center border-b px-4 gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'User'} />
                    <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold truncate">{profile?.full_name || 'LedgerFlow'}</span>
                    <span className="text-xs text-muted-foreground truncate">{mode === 'business' ? profile?.business_name || 'Business' : 'Personal Finance'}</span>
                </div>
            </div>
            <div className="flex-1 overflow-auto py-4">
                <nav className="grid gap-1 px-2">
                    {navItems.map((item) => {
                        if (item.showIn && item.showIn !== mode) return null
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                    pathname === item.href
                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                        : 'text-muted-foreground'
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>
            </div>
            <div className="border-t p-4">
                <div className="flex flex-col gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                            toggleMode()
                            router.push('/dashboard')
                        }}
                        title={mode === 'business' ? 'Switch to Personal' : 'Switch to Business'}
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
                        size="sm"
                        className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleLogout}
                        title="Logout"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}

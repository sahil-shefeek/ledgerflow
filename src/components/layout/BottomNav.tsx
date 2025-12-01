'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Users,
    PieChart,
    Settings,
    Briefcase,
    Wallet,
} from 'lucide-react'

import { MobileSidebar } from './MobileSidebar'

export function BottomNav() {
    const pathname = usePathname()
    const { mode } = useAppStore()

    const navItems = [
        {
            label: 'Home',
            href: '/dashboard',
            icon: LayoutDashboard,
        },

        {
            label: 'Analytics',
            href: '/dashboard/analytics',
            icon: PieChart,
            showIn: 'personal',
        },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
            <nav className="flex h-16 items-center justify-around px-2">
                {navItems.map((item) => {
                    if (item.showIn && item.showIn !== mode) return null
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-muted/50',
                                pathname === item.href
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}

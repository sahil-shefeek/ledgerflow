'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Briefcase, LogOut, Menu, Wallet, Settings, Users, LayoutDashboard } from 'lucide-react'
import { useState } from 'react'

import { useProfile } from '@/hooks/use-profile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function MobileSidebar() {
    const { mode, toggleMode } = useAppStore()
    const router = useRouter()
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const { profile } = useProfile()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        setOpen(false)
    }

    const handleModeSwitch = () => {
        toggleMode()
        router.push('/dashboard')
        setOpen(false)
    }

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
                <div className="flex flex-col gap-4 mt-4">
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                            router.push('/dashboard')
                            setOpen(false)
                        }}
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Dashboard</span>
                    </Button>
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
                        className="w-full justify-start gap-2"
                        onClick={() => {
                            router.push('/dashboard/settings')
                            setOpen(false)
                        }}
                    >
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                    </Button>
                    {mode === 'personal' && (
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2"
                            onClick={() => {
                                router.push('/dashboard/categories')
                                setOpen(false)
                            }}
                        >
                            <Users className="h-4 w-4" />
                            <span>Manage Categories</span>
                        </Button>
                    )}
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

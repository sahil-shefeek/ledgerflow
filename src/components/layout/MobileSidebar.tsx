'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Briefcase, LogOut, Menu, Wallet } from 'lucide-react'
import { useState } from 'react'

export function MobileSidebar() {
    const { mode, toggleMode } = useAppStore()
    const router = useRouter()
    const supabase = createClient()
    const [open, setOpen] = useState(false)

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
                <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-8">
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

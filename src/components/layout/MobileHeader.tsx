'use client'

import { usePathname, useRouter } from 'next/navigation'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

const ROOT_ROUTES = [
    '/dashboard',
    '/dashboard/settings',
    '/dashboard/analytics',
    '/dashboard/people',
    '/dashboard/categories'
]

export function MobileHeader() {
    const pathname = usePathname()
    const router = useRouter()

    const isRootRoute = ROOT_ROUTES.includes(pathname)

    return (
        <div className="flex h-14 items-center border-b px-4 bg-background md:hidden sticky top-0 z-50">
            {isRootRoute ? (
                <MobileSidebar />
            ) : (
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            )}
        </div>
    )
}

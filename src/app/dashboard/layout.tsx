import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { MobileHeader } from '@/components/layout/MobileHeader'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen w-full flex-col bg-muted/40 md:flex-row overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col sm:gap-4 sm:py-4 sm:pl-14 md:pl-0 overflow-y-auto">
                <MobileHeader />
                <main className="flex-1 p-4 sm:px-6 sm:py-0 pb-20 md:pb-4">
                    {children}
                </main>
            </div>
            <BottomNav />
        </div>
    )
}

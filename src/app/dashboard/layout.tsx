import { Suspense } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { UnverifiedEmailBanner } from '@/components/auth/UnverifiedEmailBanner'
import { RealtimeProvider } from '@/components/providers/RealtimeProvider'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

import { JitOnboardingGuard } from '@/components/onboarding/JitOnboardingGuard'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });
    let profileData = null;
    
    if (session?.user) {
        const [profile] = await db.select().from(profiles).where(eq(profiles.id, session.user.id));
        if (profile) {
            profileData = profile;
            if (profile.globalOnboardingStatus === 'PENDING') {
                redirect('/onboarding');
            }
        }
    }

    return (
        <div className="flex min-h-dvh h-dvh w-full flex-col bg-muted/40 md:flex-row overflow-hidden">
            <Suspense fallback={<aside className="hidden md:flex w-64 border-r bg-card shrink-0" />}>
                <Sidebar />
            </Suspense>
            <div className="flex flex-1 flex-col sm:gap-4 sm:py-4 sm:pl-14 md:pl-0 overflow-y-auto @container/main @container">
                <Suspense fallback={<header className="h-14 border-b bg-card md:hidden" />}>
                    <MobileHeader />
                </Suspense>
                <main className="flex-1 p-4 sm:px-6 sm:py-0 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-4 pl-[calc(1rem+env(safe-area-inset-left,0px))] pr-[calc(1rem+env(safe-area-inset-right,0px))]">
                    <UnverifiedEmailBanner />
                    <RealtimeProvider>
                        {profileData && <JitOnboardingGuard profile={profileData} />}
                        {children}
                    </RealtimeProvider>
                </main>
            </div>
            <BottomNav />
        </div>
    )
}

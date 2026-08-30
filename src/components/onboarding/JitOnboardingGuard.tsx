'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'

type ProfileSetupState = {
  globalOnboardingStatus: string | null;
  personalSetupStatus: string | null;
  businessSetupStatus: string | null;
}

export function JitOnboardingGuard({ profile }: { profile: ProfileSetupState }) {
  const router = useRouter()
  const pathname = usePathname()
  const mode = useAppStore((state) => state.mode)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // Global check is already handled by server, but just in case:
    if (profile.globalOnboardingStatus === 'PENDING') {
      router.push('/onboarding')
      return
    }

    // Mode Switch Block
    // If they are on dashboard or any protected route, check their active mode
    if (mode === 'personal' && profile.personalSetupStatus === 'PENDING') {
      router.push(`/onboarding/personal?returnTo=${encodeURIComponent(pathname)}`)
    } else if (mode === 'business' && profile.businessSetupStatus === 'PENDING') {
      router.push(`/onboarding/business?returnTo=${encodeURIComponent(pathname)}`)
    }
  }, [mode, profile, mounted, pathname, router])

  return null
}

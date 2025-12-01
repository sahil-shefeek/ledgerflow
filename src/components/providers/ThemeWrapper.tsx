'use client';
import { useAppStore } from '@/store/useAppStore';
import { useEffect, useState } from 'react';

import { SplashScreen } from '@/components/ui/splash-screen';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
    const { mode, _hasHydrated } = useAppStore();
    const [showSplash, setShowSplash] = useState(true);
    const [splashType, setSplashType] = useState<'initial' | 'switch'>('initial');

    // Handle initial hydration splash
    useEffect(() => {
        if (_hasHydrated) {
            // Keep splash visible for animation duration
            // The SplashScreen component handles its own completion callback
        }
    }, [_hasHydrated]);

    // Handle mode switch splash
    useEffect(() => {
        if (_hasHydrated) {
            setSplashType('switch');
            setShowSplash(true);
        }
    }, [mode]);

    useEffect(() => {
        // Apply the data-attribute to the body
        const body = document.querySelector('body');
        if (body) {
            body.setAttribute('data-mode', mode);
        }
    }, [mode]);

    if (showSplash || !_hasHydrated) {
        return <SplashScreen variant={splashType} onComplete={() => setShowSplash(false)} />;
    }

    return <>{children}</>;
}

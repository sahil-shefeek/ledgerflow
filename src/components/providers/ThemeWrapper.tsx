'use client';
import { useAppStore } from '@/store/useAppStore';
import { useEffect, useState } from 'react';

import { SplashScreen } from '@/components/ui/splash-screen';
import { useRef } from 'react';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
    const { mode, _hasHydrated } = useAppStore();
    const [showSplash, setShowSplash] = useState(true);
    const [splashType, setSplashType] = useState<'initial' | 'switch'>('initial');
    const prevModeRef = useRef<string | null>(null);

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
            if (prevModeRef.current === null) {
                // First time we see hydrated state. Initialize ref.
                prevModeRef.current = mode;
            } else if (prevModeRef.current !== mode) {
                // Mode changed AFTER initialization. Trigger splash.
                setSplashType('switch');
                setShowSplash(true);
                prevModeRef.current = mode;
            }
        }
    }, [mode, _hasHydrated]);

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

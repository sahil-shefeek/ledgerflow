'use client';
import { useAppStore } from '@/store/useAppStore';
import { useEffect, useState } from 'react';

import { SplashScreen } from '@/components/ui/splash-screen';
import { useRef } from 'react';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
    const { mode, _hasHydrated, themeSettings } = useAppStore();
    const [showSplash, setShowSplash] = useState(true);
    const [splashType, setSplashType] = useState<'initial' | 'switch'>('initial');
    const prevModeRef = useRef<string | null>(null);

    // Get current settings or defaults
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const currentSettings = themeSettings?.[mode] || { theme: mode === 'business' ? 'light' : 'dark', accent: mode === 'business' ? 'blue' : 'green' };

    // Handle initial hydration splash
    useEffect(() => {
        if (_hasHydrated) {
            // Keep splash visible for animation duration
        }
    }, [_hasHydrated]);

    // Handle mode switch splash
    useEffect(() => {
        if (_hasHydrated) {
            if (prevModeRef.current === null) {
                prevModeRef.current = mode;
            } else if (prevModeRef.current !== mode) {
                // Schedule update to avoid synchronous state update warning
                setTimeout(() => {
                    setSplashType('switch');
                    setShowSplash(true);
                }, 0);
                prevModeRef.current = mode;
            }
        }
    }, [mode, _hasHydrated]);

    useEffect(() => {
        const body = document.querySelector('body');
        if (body) {
            // Apply Theme (Light/Dark)
            const theme = currentSettings.theme;

            if (theme === 'dark') {
                body.classList.add('dark');
            } else {
                body.classList.remove('dark');
            }

            // Also keep data-mode for legacy or specific mode styling
            body.setAttribute('data-mode', mode);

            // Apply Accent Color Variables
            // We need to map accent names to HSL values or similar.
            // For simplicity, let's assume we set a CSS variable --primary-color based on accent.
            // But Tailwind uses --primary.
            // We need to update --primary, --ring, etc.

            const accentMap: Record<string, string> = {
                blue: '221.2 83.2% 53.3%',
                green: '142.1 76.2% 36.3%',
                violet: '262.1 83.3% 57.8%',
                orange: '24.6 95% 53.1%',
                rose: '346.8 77.2% 49.8%',
                slate: '215.4 16.3% 46.9%',
            };

            const accentHSL = accentMap[currentSettings.accent] || accentMap['blue'];
            body.style.setProperty('--primary', `hsl(${accentHSL})`);
            body.style.setProperty('--ring', `hsl(${accentHSL})`);
            // We might need to adjust --primary-foreground if the accent is too light/dark, 
            // but for these presets, white foreground usually works.
        }
    }, [mode, currentSettings]);

    if (showSplash || !_hasHydrated) {
        return <SplashScreen variant={splashType} onComplete={() => setShowSplash(false)} />;
    }

    return <>{children}</>;
}

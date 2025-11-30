'use client';
import { useAppStore } from '@/store/useAppStore';
import { useEffect, useState } from 'react';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
    const { mode } = useAppStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        // Apply the data-attribute to the body
        const body = document.querySelector('body');
        if (body) {
            body.setAttribute('data-mode', mode);
        }
    }, [mode]);

    // Prevent hydration mismatch by not rendering theme-dependent UI until mounted
    // But for the wrapper itself, we just render children. The attribute is applied via effect.
    // However, to avoid flash of wrong theme, we might want to handle this better, 
    // but since it's client-side only state, initial render will be default (business).

    return <>{children}</>;
}

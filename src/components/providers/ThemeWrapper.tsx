'use client';
import { useAppStore } from '@/store/useAppStore';
import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
    const { mode, _hasHydrated } = useAppStore();
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

    // Show splash screen until store is hydrated and component is mounted
    if (!mounted || !_hasHydrated) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                    <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold text-xl">LF</span>
                    </div>
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

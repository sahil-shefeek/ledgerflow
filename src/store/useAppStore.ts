import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppMode = 'business' | 'personal';

interface AppState {
    mode: AppMode;
    toggleMode: () => void;
    setMode: (mode: AppMode) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            mode: 'business', // Default
            toggleMode: () => set((state) => ({
                mode: state.mode === 'business' ? 'personal' : 'business'
            })),
            setMode: (mode) => set({ mode }),
        }),
        { name: 'app-preference' } // Saves to localStorage
    )
);

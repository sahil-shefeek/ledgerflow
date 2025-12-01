import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppMode = 'business' | 'personal';

interface AppState {
    mode: AppMode;
    currentBusinessId: string | null;
    toggleMode: () => void;
    setMode: (mode: AppMode) => void;
    setCurrentBusinessId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            mode: 'business', // Default
            currentBusinessId: null,
            toggleMode: () => set((state) => ({
                mode: state.mode === 'business' ? 'personal' : 'business'
            })),
            setMode: (mode) => set({ mode }),
            setCurrentBusinessId: (id) => set({ currentBusinessId: id }),
        }),
        { name: 'app-preference' } // Saves to localStorage
    )
);

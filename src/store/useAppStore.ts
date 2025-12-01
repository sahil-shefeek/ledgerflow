import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppMode = 'business' | 'personal';

interface AppState {
    mode: AppMode;
    currentBusinessId: string | null;
    _hasHydrated: boolean;
    toggleMode: () => void;
    setMode: (mode: AppMode) => void;
    setCurrentBusinessId: (id: string | null) => void;
    setHasHydrated: (state: boolean) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            mode: 'business', // Default
            currentBusinessId: null,
            _hasHydrated: false,
            toggleMode: () => set((state) => ({
                mode: state.mode === 'business' ? 'personal' : 'business'
            })),
            setMode: (mode) => set({ mode }),
            setCurrentBusinessId: (id) => set({ currentBusinessId: id }),
            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'app-preference', // Saves to localStorage
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true)
            }
        }
    )
);

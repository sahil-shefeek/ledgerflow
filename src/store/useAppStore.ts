import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';

type AppMode = 'business' | 'personal';

interface ThemeSettings {
    theme: 'light' | 'dark';
    accent: string;
}

interface AppState {
    mode: AppMode;
    currentBusinessId: string | null;
    _hasHydrated: boolean;
    themeSettings: {
        business: ThemeSettings;
        personal: ThemeSettings;
    };
    syncThemes: boolean;
    toggleMode: () => void;
    setMode: (mode: AppMode) => void;
    setCurrentBusinessId: (id: string | null) => void;
    setHasHydrated: (state: boolean) => void;
    updateThemeSettings: (mode: AppMode, settings: ThemeSettings) => void;
    setSyncThemes: (enabled: boolean) => void;
    fetchThemeSettings: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            mode: 'business', // Default
            currentBusinessId: null,
            _hasHydrated: false,
            themeSettings: {
                business: { theme: 'light', accent: 'blue' },
                personal: { theme: 'dark', accent: 'green' },
            },
            syncThemes: false,
            toggleMode: () => set((state) => ({
                mode: state.mode === 'business' ? 'personal' : 'business'
            })),
            setMode: (mode) => set({ mode }),
            setCurrentBusinessId: (id) => set({ currentBusinessId: id }),
            setHasHydrated: (state) => set({ _hasHydrated: state }),
            updateThemeSettings: async (mode, settings) => {
                const state = get();
                const shouldSync = state.syncThemes;

                set((state) => {
                    const newSettings = { ...state.themeSettings };
                    newSettings[mode] = settings;

                    if (shouldSync) {
                        // Apply same theme (light/dark) to the other mode
                        // Keep the other mode's accent color
                        const otherMode = mode === 'business' ? 'personal' : 'business';
                        newSettings[otherMode] = {
                            ...newSettings[otherMode],
                            theme: settings.theme
                        };
                    }
                    return { themeSettings: newSettings };
                });

                // Sync to DB
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const updateData: Record<string, unknown> = mode === 'business'
                        ? { business_theme: settings.theme, business_accent: settings.accent }
                        : { personal_theme: settings.theme, personal_accent: settings.accent };

                    if (shouldSync) {
                        const otherMode = mode === 'business' ? 'personal' : 'business';
                        if (otherMode === 'business') updateData.business_theme = settings.theme;
                        else updateData.personal_theme = settings.theme;
                    }

                    await supabase
                        .from('user_settings')
                        .upsert({ user_id: user.id, ...updateData });
                }
            },
            setSyncThemes: async (enabled) => {
                const state = get();
                set({ syncThemes: enabled });

                if (enabled) {
                    // Sync current mode's theme to the other mode immediately
                    const currentMode = state.mode;
                    const currentTheme = state.themeSettings[currentMode].theme;
                    const otherMode = currentMode === 'business' ? 'personal' : 'business';

                    set((s) => ({
                        themeSettings: {
                            ...s.themeSettings,
                            [otherMode]: {
                                ...s.themeSettings[otherMode],
                                theme: currentTheme
                            }
                        }
                    }));
                }

                // Sync preference to DB
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const updateData: Record<string, unknown> = { sync_themes: enabled };
                    if (enabled) {
                        const currentMode = state.mode;
                        const currentTheme = state.themeSettings[currentMode].theme;
                        updateData.business_theme = currentTheme;
                        updateData.personal_theme = currentTheme;
                    }
                    await supabase
                        .from('user_settings')
                        .upsert({ user_id: user.id, ...updateData });
                }
            },
            fetchThemeSettings: async () => {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase
                        .from('user_settings')
                        .select('*')
                        .eq('user_id', user.id)
                        .single();

                    if (data) {
                        set({
                            syncThemes: data.sync_themes,
                            themeSettings: {
                                business: { theme: data.business_theme, accent: data.business_accent },
                                personal: { theme: data.personal_theme, accent: data.personal_accent },
                            }
                        });
                    }
                }
            }
        }),
        {
            name: 'app-preference', // Saves to localStorage
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true)
                state?.fetchThemeSettings() // Fetch fresh settings on hydration
            }
        }
    )
);

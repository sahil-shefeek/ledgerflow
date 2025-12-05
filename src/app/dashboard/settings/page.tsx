'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/store/useAppStore'
import { Moon, Sun, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const ACCENT_COLORS = [
    { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
    { name: 'Green', value: 'green', class: 'bg-green-500' },
    { name: 'Violet', value: 'violet', class: 'bg-violet-500' },
    { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
    { name: 'Rose', value: 'rose', class: 'bg-rose-500' },
    { name: 'Slate', value: 'slate', class: 'bg-slate-500' },
]

export default function SettingsPage() {
    const { mode, themeSettings, updateThemeSettings, syncThemes, setSyncThemes } = useAppStore()

    // Fallback if themeSettings is not yet loaded or structure is missing
    const currentSettings = themeSettings?.[mode] || { theme: mode === 'business' ? 'light' : 'dark', accent: mode === 'business' ? 'blue' : 'green' }

    const handleThemeChange = (isDark: boolean) => {
        updateThemeSettings(mode, { ...currentSettings, theme: isDark ? 'dark' : 'light' })
    }

    const handleAccentChange = (accent: string) => {
        updateThemeSettings(mode, { ...currentSettings, accent })
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your preferences for {mode === 'business' ? 'Business' : 'Personal'} mode.
                </p>
            </div>

            <Tabs defaultValue="appearance" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="appearance">Appearance</TabsTrigger>
                    <TabsTrigger value="account">Account</TabsTrigger>
                </TabsList>
                <TabsContent value="appearance" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
                            <CardDescription>
                                Customize the look and feel for {mode} mode.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label>Theme</Label>
                                    <div className="text-sm text-muted-foreground">
                                        Select your preferred theme.
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-muted p-1 rounded-full">
                                    <button
                                        onClick={() => handleThemeChange(false)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                            currentSettings.theme === 'light'
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Sun className="h-4 w-4" />
                                        Light
                                    </button>
                                    <button
                                        onClick={() => handleThemeChange(true)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                            currentSettings.theme === 'dark'
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Moon className="h-4 w-4" />
                                        Dark
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label>Sync Themes</Label>
                                    <div className="text-sm text-muted-foreground">
                                        Use the same light/dark theme for both Business and Personal modes.
                                    </div>
                                </div>
                                <Switch
                                    checked={syncThemes}
                                    onCheckedChange={setSyncThemes}
                                />
                            </div>

                            <div className="space-y-3">
                                <Label>Accent Color</Label>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                    {ACCENT_COLORS.map((color) => (
                                        <button
                                            key={color.value}
                                            onClick={() => handleAccentChange(color.value)}
                                            className={cn(
                                                "group relative flex h-12 w-full items-center justify-center rounded-md border border-muted hover:border-primary transition-all",
                                                currentSettings.accent === color.value && "ring-2 ring-primary ring-offset-2"
                                            )}
                                        >
                                            <div className={cn("h-6 w-6 rounded-full", color.class)} />
                                            {currentSettings.accent === color.value && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Check className="h-4 w-4 text-white drop-shadow-md" />
                                                </div>
                                            )}
                                            <span className="sr-only">{color.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="account">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account</CardTitle>
                            <CardDescription>
                                Manage your account settings.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Account settings coming soon.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

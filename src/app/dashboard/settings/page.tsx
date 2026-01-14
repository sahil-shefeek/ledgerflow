'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/store/useAppStore'
import { Moon, Sun, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useProfile, Profile } from '@/hooks/use-profile'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { useEffect } from 'react'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const ACCENT_COLORS = [
    { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
    { name: 'Green', value: 'green', class: 'bg-green-500' },
    { name: 'Violet', value: 'violet', class: 'bg-violet-500' },
    { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
    { name: 'Rose', value: 'rose', class: 'bg-rose-500' },
    { name: 'Slate', value: 'slate', class: 'bg-slate-500' },
]

const profileSchema = z.object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    business_name: z.string().optional(),
    phone: z.string().optional(),
    avatar_url: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export default function SettingsPage() {
    const { mode, themeSettings, updateThemeSettings, syncThemes, setSyncThemes } = useAppStore()
    const { profile, isLoading: isProfileLoading, updateProfile } = useProfile()

    // Fallback if themeSettings is not yet loaded or structure is missing
    const currentSettings = themeSettings?.[mode] || { theme: mode === 'business' ? 'light' : 'dark', accent: mode === 'business' ? 'blue' : 'green' }

    const handleThemeChange = (isDark: boolean) => {
        updateThemeSettings(mode, { ...currentSettings, theme: isDark ? 'dark' : 'light' })
    }

    const handleAccentChange = (accent: string) => {
        updateThemeSettings(mode, { ...currentSettings, accent })
    }

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            full_name: '',
            business_name: '',
            phone: '',
            avatar_url: '',
        }
    })

    useEffect(() => {
        if (profile) {
            form.reset({
                full_name: profile.full_name || '',
                business_name: profile.business_name || '',
                phone: profile.phone || '',
                avatar_url: profile.avatar_url || '',
            })
        }
    }, [profile, form])

    const onSubmit = (data: ProfileFormValues) => {
        updateProfile.mutate(data)
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
                            <CardTitle>Profile</CardTitle>
                            <CardDescription>
                                Manage your public profile details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isProfileLoading ? (
                                <div className="flex justify-center p-6">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : (
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                        <FormField
                                            control={form.control}
                                            name="avatar_url"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Profile Picture</FormLabel>
                                                    <FormControl>
                                                        <AvatarUpload
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            name={form.watch('full_name')}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="grid gap-4 md:grid-cols-2">
                                            <FormField
                                                control={form.control}
                                                name="full_name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Full Name</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="John Doe" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="phone"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Phone Number</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="+1234567890" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="business_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Business Name</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Acme Inc." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="flex justify-end">
                                            <Button type="submit" disabled={updateProfile.isPending}>
                                                {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Save Changes
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

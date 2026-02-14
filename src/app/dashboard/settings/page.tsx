'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/store/useAppStore'
import { Moon, Sun, Check, Loader2, User, Building2, Phone, Mail, Pencil, X, AlertTriangle, Shield, AtSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useProfile, Profile } from '@/hooks/use-profile'
import { AvatarUpload } from '@/components/ui/avatar-upload'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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
    username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric & underscores only').optional().or(z.literal('')),
    business_name: z.string().optional().or(z.literal('')),
    phone: z.string().optional().or(z.literal('')),
    avatar_url: z.string().optional().or(z.literal('')),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export default function SettingsPage() {
    const { mode, themeSettings, updateThemeSettings, syncThemes, setSyncThemes } = useAppStore()
    const { profile, isLoading: isProfileLoading, updateProfile } = useProfile()
    const [isEditing, setIsEditing] = useState(false)
    const [isLinkingGoogle, setIsLinkingGoogle] = useState(false)
    const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [updatingPrivacy, setUpdatingPrivacy] = useState<string | null>(null)
    const [claimingUsername, setClaimingUsername] = useState(false)
    const [newUsername, setNewUsername] = useState('')
    const supabase = createClient()

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
            username: '',
            business_name: '',
            phone: '',
            avatar_url: '',
        },
        mode: 'onChange' // Enable dirty checking on change
    })

    // Reset form when profile loads or when entering edit mode
    useEffect(() => {
        if (profile) {
            form.reset({
                full_name: profile.full_name || '',
                username: profile.username || '',
                business_name: profile.business_name || '',
                phone: profile.phone || '',
                avatar_url: profile.avatar_url || '',
            })
        }
    }, [profile, form, isEditing])

    const onSubmit = (data: ProfileFormValues) => {
        updateProfile.mutate(data, {
            onSuccess: () => {
                setIsEditing(false)
            },
            onError: (error: any) => {
                if (error.code === '23505') { // Unique violation
                    form.setError('username', {
                        type: 'manual',
                        message: 'This username is taking. Please choose another.'
                    })
                }
            }
        })
    }

    const handleLinkGoogle = async () => {
        setIsLinkingGoogle(true)
        try {
            const { error } = await supabase.auth.linkIdentity({ provider: 'google' })
            if (error) throw error
        } catch (error) {
            console.error('Error linking Google:', error)
            toast.error('Failed to link Google account')
            setIsLinkingGoogle(false)
        }
    }

    const handleUpdateEmail = async () => {
        if (!newEmail) return
        setIsUpdatingEmail(true)
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail })
            if (error) throw error
            toast.success('Confirmation email sent! Please check your inbox.')
            setNewEmail('')
        } catch (error: any) {
            console.error('Error updating email:', error)
            toast.error(error.message || 'Failed to update email')
        } finally {
            setIsUpdatingEmail(false)
        }
    }

    const handlePrivacyUpdate = (key: 'discoverable_by_phone' | 'discoverable_by_username', value: boolean) => {
        setUpdatingPrivacy(key)
        updateProfile.mutate({ [key]: value }, {
            onSuccess: () => {
                toast.success('Privacy settings updated')
                setUpdatingPrivacy(null)
            },
            onError: () => {
                toast.error('Failed to update privacy settings')
                setUpdatingPrivacy(null)
            }
        })
    }

    const handleClaimUsername = () => {
        if (!newUsername || newUsername.length < 3) return
        setClaimingUsername(true)
        updateProfile.mutate({ username: newUsername }, {
            onSuccess: () => {
                toast.success('Username claimed successfully!')
                setClaimingUsername(false)
                setNewUsername('')
            },
            onError: (error: any) => {
                if (error.code === '23505') {
                    toast.error('This username is already taken.')
                } else {
                    toast.error('Failed to claim username.')
                }
                setClaimingUsername(false)
            }
        })
    }

    const handleCancel = () => {
        setIsEditing(false)
        if (profile) {
            form.reset({
                full_name: profile.full_name || '',
                username: profile.username || '',
                business_name: profile.business_name || '',
                phone: profile.phone || '',
                avatar_url: profile.avatar_url || '',
            })
        }
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
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex flex-col space-y-1.5">
                                <CardTitle>Profile</CardTitle>
                                <CardDescription>
                                    Manage your public profile details.
                                </CardDescription>
                            </div>
                            {!isEditing && !isProfileLoading && (
                                <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit Profile
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="pt-6">
                            {isProfileLoading ? (
                                <div className="flex justify-center p-6">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : isEditing ? (
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
                                                            folder="profiles"
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
                                                name="username"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Username</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                                <Input
                                                                    placeholder="username"
                                                                    className="pl-9"
                                                                    {...field}
                                                                    value={field.value || ''}
                                                                    disabled={!!profile?.username && profile.username !== ''}
                                                                />
                                                            </div>
                                                        </FormControl>
                                                        <p className="text-[0.8rem] text-muted-foreground">
                                                            {profile?.username ? "Username cannot be changed once set." : "Choose a unique username."}
                                                        </p>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2">
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
                                        </div>

                                        <div className="flex items-center justify-end gap-2">
                                            <Button type="button" variant="ghost" onClick={handleCancel} disabled={updateProfile.isPending}>
                                                Cancel
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={updateProfile.isPending || !form.formState.isDirty}
                                            >
                                                {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Save Changes
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            ) : (
                                <div className="space-y-8">
                                    <div className="flex items-center gap-6">
                                        <Avatar className="h-24 w-24 border-2 border-muted">
                                            <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'User'} className="object-cover" />
                                            <AvatarFallback className="text-lg bg-primary/10 text-primary">
                                                {profile?.full_name?.charAt(0) || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-semibold leading-none tracking-tight">{profile?.full_name || 'No Name Set'}</h3>
                                            <p className="text-sm text-muted-foreground">{profile?.email || 'No email linked'}</p>

                                            {/* Inline Username Claiming / Display */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                                                {profile?.username ? (
                                                    <span className="text-sm font-medium text-foreground">{profile.username}</span>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            className="h-7 w-40 text-xs"
                                                            placeholder="Claim username"
                                                            value={newUsername}
                                                            onChange={(e) => setNewUsername(e.target.value)}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            disabled={claimingUsername || !newUsername || newUsername.length < 3}
                                                            onClick={handleClaimUsername}
                                                        >
                                                            {claimingUsername ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Claim'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div className="space-y-3">
                                            <Label className="text-xs font-medium uppercase text-muted-foreground">Contact Information</Label>
                                            <div className="flex items-center gap-3 text-sm">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>{profile?.full_name || 'Not set'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span>{profile?.phone || 'Not set'}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-xs font-medium uppercase text-muted-foreground">Business Details</Label>
                                            <div className="flex items-center gap-3 text-sm">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                <span>{profile?.business_name || 'Not set'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Legacy Account Security Section */}
                                    {profile && !profile.email && !isEditing && (
                                        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10">
                                            <CardContent className="p-4 sm:p-6">
                                                <div className="flex flex-col sm:flex-row gap-4 items-start">
                                                    <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30 shrink-0">
                                                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                                                    </div>
                                                    <div className="flex-1 space-y-4 w-full">
                                                        <div className="space-y-1">
                                                            <h4 className="font-medium text-amber-900 dark:text-amber-500">Account Security Warning</h4>
                                                            <p className="text-sm text-amber-800/90 dark:text-amber-500/90 leading-relaxed">
                                                                Your account is currently only linked to this device/phone number. To ensure you don't lose access, please link an email address.
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-col sm:flex-row gap-3 pt-1 items-center w-full">
                                                            <div className="flex w-full sm:max-w-xs items-center space-x-2">
                                                                <Input
                                                                    placeholder="name@example.com"
                                                                    value={newEmail}
                                                                    onChange={(e) => setNewEmail(e.target.value)}
                                                                    className="bg-white/50 dark:bg-black/20 border-amber-200 dark:border-amber-800"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={handleUpdateEmail}
                                                                    disabled={isUpdatingEmail || !newEmail}
                                                                    className="border-amber-200 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-800 dark:hover:bg-amber-900/30 whitespace-nowrap"
                                                                >
                                                                    {isUpdatingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link Email'}
                                                                </Button>
                                                            </div>

                                                            <div className="relative flex items-center justify-center sm:justify-start py-2 sm:py-0 sm:px-2">
                                                                <span className="text-xs text-amber-800/60 font-medium px-2 bg-amber-50 dark:bg-transparent z-10">OR</span>
                                                                <div className="absolute inset-0 flex items-center sm:hidden">
                                                                    <div className="w-full border-t border-amber-200 dark:border-amber-800"></div>
                                                                </div>
                                                            </div>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={handleLinkGoogle}
                                                                disabled={isLinkingGoogle}
                                                                className="w-full sm:w-auto border-amber-200 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-800 dark:hover:bg-amber-900/30"
                                                            >
                                                                {isLinkingGoogle ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                                Link Google Account
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Privacy Settings (Decoupled) */}
                                    <div className="rounded-lg border p-4 space-y-4">
                                        <h3 className="font-medium flex items-center gap-2">
                                            <Shield className="h-4 w-4" />
                                            Privacy Settings
                                        </h3>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="flex items-center justify-between space-x-2 rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-1">
                                                    <Label htmlFor="view-phone" className="text-base">Phone Discoverability</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        Allow searching by number
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {updatingPrivacy === 'discoverable_by_phone' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                    <Switch
                                                        id="view-phone"
                                                        checked={profile?.discoverable_by_phone || false}
                                                        onCheckedChange={(checked) => handlePrivacyUpdate('discoverable_by_phone', checked)}
                                                        disabled={!!updatingPrivacy}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between space-x-2 rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-1">
                                                    <Label htmlFor="view-username" className="text-base">Username Discoverability</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        Allow searching by username
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {updatingPrivacy === 'discoverable_by_username' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                                    <Switch
                                                        id="view-username"
                                                        checked={profile?.discoverable_by_username || false}
                                                        onCheckedChange={(checked) => handlePrivacyUpdate('discoverable_by_username', checked)}
                                                        disabled={!!updatingPrivacy}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div >
    )
}

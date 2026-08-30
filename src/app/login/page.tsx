'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/components/ui/toast'
import { Icon } from "@/components/ui/icon";
import { LoaderIcon, UserIcon, EyeIcon, AlertCircleIcon, ArrowLeft05Icon, Mail02Icon, EyeOffIcon, LockIcon } from "@hugeicons/core-free-icons";
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'

const signInSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signUpSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

type AuthMode = 'SIGN_IN' | 'SIGN_UP'

function LoginContent() {
    const [mode, setMode] = useState<AuthMode>('SIGN_IN')
    const [isGoogleLoading, setIsGoogleLoading] = useState(false)
    const [isFormLoading, setIsFormLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const urlError = searchParams.get('error')
        if (urlError) {
            setError(urlError)
        }
    }, [searchParams])

    const signInForm = useForm<z.infer<typeof signInSchema>>({
        resolver: zodResolver(signInSchema),
        defaultValues: { email: '', password: '' },
    })

    const signUpForm = useForm<z.infer<typeof signUpSchema>>({
        resolver: zodResolver(signUpSchema),
        defaultValues: { email: '', password: '', confirmPassword: '' },
    })

    const hasLoadedFromStorage = useRef(false)

    // Load initial state from local storage
    useEffect(() => {
        const savedState = localStorage.getItem('auth_form_state')
        if (savedState) {
            try {
                const { email, mode: savedMode } = JSON.parse(savedState)
                if (savedMode === 'SIGN_IN' || savedMode === 'SIGN_UP') {
                    setMode(savedMode)
                }
                if (email) {
                    signInForm.setValue('email', email)
                    signUpForm.setValue('email', email)
                }
            } catch (e) {
                // Ignore invalid state
            }
        }
        hasLoadedFromStorage.current = true
    }, [signInForm, signUpForm])

    // Subscribe to form and mode changes to save to localStorage
    const signInValues = signInForm.watch()
    const signUpValues = signUpForm.watch()
    
    useEffect(() => {
        if (!hasLoadedFromStorage.current) return
        
        // Save the email of whichever form has it, prioritizing the active mode
        const activeEmail = mode === 'SIGN_IN' ? signInValues.email : signUpValues.email
        
        localStorage.setItem(
            'auth_form_state',
            JSON.stringify({
                mode,
                email: activeEmail || '',
            })
        )
    }, [signInValues.email, signUpValues.email, mode])

    const handleGoogleLogin = async () => {
        setIsGoogleLoading(true)
        setError(null)
        try {
            const next = searchParams.get('next') || '/dashboard'
            await authClient.signIn.social({
                provider: 'google',
                callbackURL: next,
            })
        } catch (err: any) {
            console.error('Google login error:', err)
            toast.error('Google login failed. Please try again.')
            setIsGoogleLoading(false)
        }
    }

    async function onSignInSubmit(values: z.infer<typeof signInSchema>) {
        setIsFormLoading(true)
        setError(null)
        const next = searchParams.get('next') || '/dashboard'
        await authClient.signIn.email(
            {
                email: values.email,
                password: values.password,
                callbackURL: next,
            },
            {
                onSuccess: () => {
                    localStorage.removeItem('auth_form_state')
                    toast.success('Signed in successfully!')
                    router.push(next)
                },
                onError: (ctx) => {
                    setIsFormLoading(false)
                    setError('Failed to sign in. Please check your credentials.')
                    toast.error('Sign in failed')
                },
            }
        )
    }

    async function onSignUpSubmit(values: z.infer<typeof signUpSchema>) {
        setIsFormLoading(true)
        setError(null)
        const next = searchParams.get('next') || '/dashboard'
        await authClient.signUp.email(
            {
                name: "",
                email: values.email,
                password: values.password,
                callbackURL: next,
            },
            {
                onSuccess: () => {
                    localStorage.removeItem('auth_form_state')
                    toast.success('Account created successfully!')
                    router.push(next)
                },
                onError: (ctx) => {
                    setIsFormLoading(false)
                    setError('Failed to create account. Please try again.')
                    toast.error('Sign up failed')
                },
            }
        )
    }

    const isLoading = isGoogleLoading || isFormLoading

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center text-2xl font-bold">
                        {error ? 'Authentication Error' : mode === 'SIGN_IN' ? 'Welcome to LedgerFlow' : 'Create an Account'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {error
                            ? 'There was a problem signing you in'
                            : mode === 'SIGN_IN'
                                ? 'Sign in to access your dashboard'
                                : 'Enter your details below to create your account'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                                <Icon icon={AlertCircleIcon} className="h-10 w-10 text-destructive" />
                            </div>
                            <p className="text-center text-sm text-foreground font-medium">
                                {error}
                            </p>
                            <Button
                                className="w-full"
                                onClick={() => setError(null)}
                            >
                                <Icon icon={ArrowLeft05Icon} className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Button
                                variant="outline"
                                className="w-full py-5"
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                            >
                                {isGoogleLoading ? (
                                    <Icon icon={LoaderIcon} className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                        <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                    </svg>
                                )}
                                Continue with Google
                            </Button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">
                                        Or continue with Email
                                    </span>
                                </div>
                            </div>

                            {mode === 'SIGN_IN' ? (
                                <Form key="sign-in" {...signInForm}>
                                    <form onSubmit={signInForm.handleSubmit(onSignInSubmit)} className="space-y-4">
                                        <FormField
                                            control={signInForm.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    <div className="relative">
                                                        <Icon icon={Mail02Icon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                        <FormControl>
                                                            <Input className="pl-10" placeholder="m@example.com" type="email" autoComplete="email" {...field} />
                                                        </FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={signInForm.control}
                                            name="password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Password</FormLabel>
                                                    <div className="relative">
                                                        <Icon icon={LockIcon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                        <FormControl>
                                                            <Input className="pl-10 pr-10" placeholder="••••••••" type={showPassword ? "text" : "password"} autoComplete="current-password" {...field} />
                                                        </FormControl>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                                        >
                                                            {showPassword ? (
                                                                <Icon icon={EyeOffIcon} className="h-5 w-5" />
                                                            ) : (
                                                                <Icon icon={EyeIcon} className="h-5 w-5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="submit" className="w-full" disabled={isLoading}>
                                            {isFormLoading && <Icon icon={LoaderIcon} className="mr-2 h-4 w-4 animate-spin" />}
                                            Sign In
                                        </Button>
                                    </form>
                                </Form>
                            ) : (
                                <Form key="sign-up" {...signUpForm}>
                                    <form onSubmit={signUpForm.handleSubmit(onSignUpSubmit)} className="space-y-4">

                                        <FormField
                                            control={signUpForm.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    <div className="relative">
                                                        <Icon icon={Mail02Icon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                        <FormControl>
                                                            <Input className="pl-10" placeholder="m@example.com" type="email" autoComplete="email" {...field} />
                                                        </FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={signUpForm.control}
                                            name="password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Password</FormLabel>
                                                    <div className="relative">
                                                        <Icon icon={LockIcon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                        <FormControl>
                                                            <Input className="pl-10 pr-10" placeholder="••••••••" type={showPassword ? "text" : "password"} autoComplete="new-password" {...field} />
                                                        </FormControl>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                                        >
                                                            {showPassword ? (
                                                                <Icon icon={EyeOffIcon} className="h-5 w-5" />
                                                            ) : (
                                                                <Icon icon={EyeIcon} className="h-5 w-5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={signUpForm.control}
                                            name="confirmPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Confirm Password</FormLabel>
                                                    <div className="relative">
                                                        <Icon icon={LockIcon} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                        <FormControl>
                                                            <Input className="pl-10 pr-10" placeholder="••••••••" type={showPassword ? "text" : "password"} autoComplete="new-password" {...field} />
                                                        </FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="submit" className="w-full" disabled={isLoading}>
                                            {isFormLoading && <Icon icon={LoaderIcon} className="mr-2 h-4 w-4 animate-spin" />}
                                            Create Account
                                        </Button>
                                    </form>
                                </Form>
                            )}

                            <div className="mt-4 text-center text-sm">
                                {mode === 'SIGN_IN' ? (
                                    <p className="text-muted-foreground">
                                        Don&apos;t have an account?{' '}
                                        <button
                                            type="button"
                                            className="font-medium text-primary hover:underline"
                                            onClick={() => {
                                                setError(null)
                                                setMode('SIGN_UP')
                                            }}
                                        >
                                            Sign Up
                                        </button>
                                    </p>
                                ) : (
                                    <p className="text-muted-foreground">
                                        Already have an account?{' '}
                                        <button
                                            type="button"
                                            className="font-medium text-primary hover:underline"
                                            onClick={() => {
                                                setError(null)
                                                setMode('SIGN_IN')
                                            }}
                                        >
                                            Sign In
                                        </button>
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Icon icon={LoaderIcon} className="h-8 w-8 animate-spin" /></div>}>
            <LoginContent />
        </Suspense>
    )
}

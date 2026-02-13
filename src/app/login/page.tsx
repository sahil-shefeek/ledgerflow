'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Phone, Mail, ArrowLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
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
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

const phoneSchema = z.object({
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
})

const emailSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
})

const otpSchema = z.object({
    otp: z.string().length(6, 'OTP must be 6 digits'),
})

type AuthMethod = 'EMAIL' | 'PHONE' | 'GOOGLE'

export default function LoginPage() {
    const [authMethod, setAuthMethod] = useState<AuthMethod>('EMAIL')
    const [step, setStep] = useState<'INPUT' | 'OTP'>('INPUT')
    const [loading, setLoading] = useState(false)
    const [identifier, setIdentifier] = useState('') // Email or Phone
    const [countryCode, setCountryCode] = useState('+91')

    const supabase = createClient()
    const router = useRouter()

    const phoneForm = useForm<z.infer<typeof phoneSchema>>({
        resolver: zodResolver(phoneSchema),
        defaultValues: { phone: '' },
    })

    const emailForm = useForm<z.infer<typeof emailSchema>>({
        resolver: zodResolver(emailSchema),
        defaultValues: { email: '' },
    })

    const otpForm = useForm<z.infer<typeof otpSchema>>({
        resolver: zodResolver(otpSchema),
    })

    // eslint-disable-next-line react-hooks/incompatible-library
    const otpValue = otpForm.watch('otp')

    const handleGoogleLogin = async () => {
        setLoading(true)
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            })
            if (error) throw error
        } catch (error: any) {
            console.error('Google login error:', error)
            toast.error(error.message || 'Failed to initiate Google login')
            setLoading(false)
        }
    }

    async function onEmailSubmit(values: z.infer<typeof emailSchema>) {
        setLoading(true)
        setIdentifier(values.email)
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: values.email,
            })
            if (error) throw error
            toast.success('OTP sent to your email!')
            setStep('OTP')
        } catch (error: any) {
            console.error('Email login error:', error)
            toast.error(error.message || 'Failed to send OTP')
        } finally {
            setLoading(false)
        }
    }

    async function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
        setLoading(true)
        const formattedPhone = values.phone.startsWith('+')
            ? values.phone
            : `${countryCode}${values.phone}`

        setIdentifier(formattedPhone)

        try {
            const { error } = await supabase.auth.signInWithOtp({
                phone: formattedPhone,
            })
            if (error) throw error
            toast.success('OTP sent to your phone!')
            setStep('OTP')
        } catch (error: any) {
            console.error('Phone login error:', error)
            toast.error(error.message || 'Failed to send OTP')
        } finally {
            setLoading(false)
        }
    }

    async function onOtpSubmit(values: z.infer<typeof otpSchema>) {
        setLoading(true)
        try {
            const { error } = await (authMethod === 'EMAIL'
                ? supabase.auth.verifyOtp({
                    email: identifier,
                    token: values.otp,
                    type: 'email',
                })
                : supabase.auth.verifyOtp({
                    phone: identifier,
                    token: values.otp,
                    type: 'sms',
                }))

            if (error) throw error

            toast.success('Logged in successfully!')
            router.push('/dashboard')
        } catch (error: any) {
            console.error('OTP verification error:', error)
            toast.error(error.message || 'Invalid OTP')
            setLoading(false)
        }
    }

    const resetFlow = () => {
        setStep('INPUT')
        setAuthMethod('EMAIL')
        emailForm.reset()
        phoneForm.reset()
        otpForm.reset()
        setIdentifier('')
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center text-2xl font-bold">
                        Welcome to LedgerFlow
                    </CardTitle>
                    <CardDescription className="text-center">
                        {step === 'INPUT'
                            ? 'Sign in to access your dashboard'
                            : `Enter the OTP sent to ${identifier}`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {step === 'OTP' ? (
                        <Form {...otpForm}>
                            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                                <Controller
                                    control={otpForm.control}
                                    name="otp"
                                    render={({ field }) => (
                                        <FormItem className="flex justify-center">
                                            <FormControl>
                                                <InputOTP
                                                    maxLength={6}
                                                    value={field.value ?? ""}
                                                    onChange={(payload: unknown) => {
                                                        const raw = payload == null ? "" : String(payload)
                                                        const digits = raw.replace(/\D/g, "").slice(0, 6)
                                                        field.onChange(digits)
                                                    }}
                                                    onBlur={field.onBlur}
                                                    ref={field.ref}
                                                >
                                                    <InputOTPGroup>
                                                        <InputOTPSlot index={0} />
                                                        <InputOTPSlot index={1} />
                                                        <InputOTPSlot index={2} />
                                                        <InputOTPSlot index={3} />
                                                        <InputOTPSlot index={4} />
                                                        <InputOTPSlot index={5} />
                                                    </InputOTPGroup>
                                                </InputOTP>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={loading || otpValue?.length !== 6}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Verify OTP
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="w-full"
                                    type="button"
                                    onClick={() => setStep('INPUT')}
                                    disabled={loading}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Login
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        authMethod === 'PHONE' ? (
                            <Form {...phoneForm}>
                                <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
                                    <FormField
                                        control={phoneForm.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Phone Number</FormLabel>
                                                <FormControl>
                                                    <div className="flex gap-2">
                                                        <div className="w-[100px]">
                                                            <Select defaultValue="+91" onValueChange={(value) => setCountryCode(value)}>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="+91" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="+91">🇮🇳 +91</SelectItem>
                                                                    <SelectItem value="+1">🇺🇸 +1</SelectItem>
                                                                    <SelectItem value="+44">🇬🇧 +44</SelectItem>
                                                                    <SelectItem value="+81">🇯🇵 +81</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <Input
                                                            placeholder="9999999999"
                                                            type="tel"
                                                            {...field}
                                                            value={field.value || ''}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Send OTP
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="w-full"
                                        type="button"
                                        onClick={() => setAuthMethod('EMAIL')}
                                        disabled={loading}
                                    >
                                        Use Email instead
                                    </Button>
                                </form>
                            </Form>
                        ) : (
                            <div className="space-y-4">
                                <Button
                                    variant="outline"
                                    className="w-full py-5"
                                    onClick={handleGoogleLogin}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

                                <Form {...emailForm}>
                                    <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                                        <FormField
                                            control={emailForm.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="m@example.com" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="submit" className="w-full" disabled={loading}>
                                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            <Mail className="mr-2 h-4 w-4" />
                                            Continue with Email
                                        </Button>
                                    </form>
                                </Form>

                                <div className="mt-4 text-center">
                                    <Button
                                        variant="link"
                                        className="text-xs text-muted-foreground"
                                        onClick={() => setAuthMethod('PHONE')}
                                        disabled={loading}
                                    >
                                        Sign in with Phone (Legacy)
                                    </Button>
                                </div>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    )
}


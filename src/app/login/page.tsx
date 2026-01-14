'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Phone } from 'lucide-react'
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

const otpSchema = z.object({
    otp: z.string().length(6, 'OTP must be 6 digits'),
})

export default function LoginPage() {
    const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE')
    const [loading, setLoading] = useState(false)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [countryCode, setCountryCode] = useState('+91')
    const supabase = createClient()
    const router = useRouter()

    const phoneForm = useForm<z.infer<typeof phoneSchema>>({
        resolver: zodResolver(phoneSchema),
        defaultValues: {
            phone: '',
        },
    })

    const otpForm = useForm<z.infer<typeof otpSchema>>({
        resolver: zodResolver(otpSchema),
    })

    // eslint-disable-next-line react-hooks/incompatible-library
    const otpValue = otpForm.watch('otp')

    async function onPhoneSubmit(values: z.infer<typeof phoneSchema>) {
        setLoading(true)
        const formattedPhone = values.phone.startsWith('+')
            ? values.phone
            : `${countryCode}${values.phone}`

        setPhoneNumber(formattedPhone)

        const { error } = await supabase.auth.signInWithOtp({
            phone: formattedPhone,
        })

        setLoading(false)

        if (error) {
            toast.error(error.message)
            return
        }

        toast.success('OTP sent successfully!')
        setStep('OTP')
    }

    async function onOtpSubmit(values: z.infer<typeof otpSchema>) {
        setLoading(true)

        const { error } = await supabase.auth.verifyOtp({
            phone: phoneNumber,
            token: values.otp,
            type: 'sms',
        })

        setLoading(false)

        if (error) {
            toast.error(error.message)
            return
        }

        toast.success('Logged in successfully!')
        router.push('/dashboard')
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Welcome to LedgerFlow</CardTitle>
                    <CardDescription>
                        {step === 'PHONE'
                            ? 'Enter your phone number to continue'
                            : `Enter the OTP sent to ${phoneNumber}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 'PHONE' ? (
                        <Form {...phoneForm}>
                            <form
                                onSubmit={phoneForm.handleSubmit(onPhoneSubmit)}
                                className="space-y-4"
                            >
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
                            </form>
                        </Form>
                    ) : (
                        <Form {...otpForm}>
                            <form
                                onSubmit={otpForm.handleSubmit(onOtpSubmit)}
                                className="space-y-4"
                            >
                                <Controller
                                    control={otpForm.control}
                                    name="otp"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>One-Time Password</FormLabel>
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
                                    onClick={() => {
                                        setStep('PHONE')
                                        otpForm.reset({ otp: '' })
                                    }}
                                    disabled={loading}
                                >
                                    Change Phone Number
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    Questionnaire,
    QuestionnaireProgress,
    QuestionnaireItem,
    QuestionnaireTitle,
    QuestionnaireDescription,
    QuestionnaireChoices,
    QuestionnaireChoice,
    QuestionnaireInput,
    QuestionnaireActions,
    QuestionnairePrevious,
    QuestionnaireNext,
    QuestionnaireSubmit,
} from "@/components/ui/questionnaire"
import { useAppStore } from "@/store/useAppStore"
import { toast } from "@/components/ui/toast"
import { completeGlobalOnboarding, checkUsernameAvailability } from "@/lib/actions/onboarding"

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export interface OnboardingWizardProps {
        defaultUsername?: string
    defaultFullName?: string
    defaultStep?: number
    defaultAccent?: string
    defaultCurrency?: string
    className?: string
    onComplete?: () => void
}

export function OnboardingWizard({
        defaultUsername = "",
    defaultFullName = "",
    defaultStep = 1,
    defaultAccent = "green",
    defaultCurrency = "₹",
    className,
    onComplete,
}: OnboardingWizardProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnTo = searchParams.get('returnTo') || '/dashboard'

    const [step, setStep] = React.useState(defaultStep)
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    // Form state
    const [fullName, setFullName] = React.useState(defaultFullName)
        const [username, setUsername] = React.useState(defaultUsername)
    const [mode, setMode] = React.useState<"personal" | "business">("personal")
    const [accent, setAccent] = React.useState(defaultAccent)
    const [currency, setCurrency] = React.useState(defaultCurrency)

    // Username Validation
    const debouncedUsername = useDebounce(username, 500)
    const [isUsernameValid, setIsUsernameValid] = React.useState(false)
    const [isCheckingUsername, setIsCheckingUsername] = React.useState(false)
    const [suggestions, setSuggestions] = React.useState<string[]>([])

    React.useEffect(() => {
        async function validate() {
            if (!debouncedUsername || debouncedUsername.length < 3) {
                setIsUsernameValid(false)
                setSuggestions([])
                return
            }
            setIsCheckingUsername(true)
            try {
                const isAvailable = await checkUsernameAvailability(debouncedUsername)
                setIsUsernameValid(isAvailable)
                
                if (!isAvailable) {
                    const cleanName = fullName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
                    const validSuggestions: string[] = []
                    let attempts = 0
                    
                    while (validSuggestions.length < 3 && attempts < 20) {
                        const randomHex = Math.floor(Math.random() * 65535).toString(16)
                        const suffixes = [
                            `${attempts > 0 ? attempts : ''}123`,
                            `_${randomHex}`,
                            `_app${attempts > 0 ? attempts : ''}`,
                            `${Math.floor(Math.random() * 999)}`
                        ]
                        
                        const candidate = attempts < 3 
                            ? (attempts === 0 ? `${debouncedUsername}${suffixes[0]}` : (attempts === 1 ? `${cleanName}${suffixes[1]}` : `${debouncedUsername}${suffixes[2]}`))
                            : `${cleanName}${suffixes[3]}`
                            
                        if (!validSuggestions.includes(candidate)) {
                            const isAvailable = await checkUsernameAvailability(candidate)
                            if (isAvailable) {
                                validSuggestions.push(candidate)
                            }
                        }
                        attempts++
                    }
                    
                    setSuggestions(validSuggestions)
                } else {
                    setSuggestions([])
                }
            } catch {
                setIsUsernameValid(false)
            } finally {
                setIsCheckingUsername(false)
            }
        }
        validate()
    }, [debouncedUsername, fullName])

    const setAppMode = useAppStore((state) => state.setMode)
    const updateThemeSettings = useAppStore((state) => state.updateThemeSettings)

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        
        setIsSubmitting(true)
        try {
            await completeGlobalOnboarding({ username, fullName, mode, currency, accent })
            setAppMode(mode)
            
            toast.success("Profile created!")
            
            if (onComplete) {
                onComplete()
            } else {
                // Redirect to the mode-specific setup phase (JIT)
                router.push(`/onboarding/${mode}?returnTo=${encodeURIComponent(returnTo)}`)
            }
            
        } catch (error: any) {
            toast.error("Failed to save profile. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Questionnaire
            step={step}
            onStepChange={setStep}
            totalSteps={4}
            className={className}
        >
            <div className="flex items-center justify-between mb-2">
                <QuestionnaireProgress className="tabular-nums font-medium text-xs text-muted-foreground">
                    Step {step} of 4
                </QuestionnaireProgress>
            </div>

            {/* Step 1: Profile */}
            <QuestionnaireItem step={1}>
                <QuestionnaireTitle>Complete Your Profile</QuestionnaireTitle>
                <QuestionnaireDescription>
                    Let's set up your identity.
                </QuestionnaireDescription>
                
                <div className="space-y-4 mt-4">
                    <div>
                        <label className="text-sm font-medium">Full Name</label>
                        <QuestionnaireInput 
                            placeholder="John Doe" 
                            value={fullName}
                            onChange={(e) => {
                                setFullName(e.target.value)
                                if (!username && e.target.value) {
                                    // Auto-suggest username from name
                                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))
                                }
                            }}
                            autoComplete="name"
                        />
                    </div>
                    
                    <div>
                        <label className="text-sm font-medium">Username</label>
                        <QuestionnaireInput 
                            placeholder="johndoe" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="off"
                        />
                        <div className="mt-1 min-h-[20px] text-xs">
                            {isCheckingUsername ? (
                                <span className="text-muted-foreground">Checking availability...</span>
                            ) : username.length > 0 && username.length < 3 ? (
                                <span className="text-destructive">Username must be at least 3 characters.</span>
                            ) : !isUsernameValid && username.length >= 3 ? (
                                <div className="text-destructive">
                                    Username taken. Try: 
                                    {suggestions.map(s => (
                                        <button 
                                            key={s} 
                                            onClick={() => setUsername(s)}
                                            className="ml-2 underline hover:text-foreground"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            ) : isUsernameValid ? (
                                <span className="text-green-600 dark:text-green-400">Username is available!</span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </QuestionnaireItem>

            {/* Step 2: Workspace Mode */}
            <QuestionnaireItem step={2}>
                <QuestionnaireTitle>Select Workspace Mode</QuestionnaireTitle>
                <QuestionnaireDescription>
                    Choose your primary workflow. You can toggle between Personal and Business modes at any time.
                </QuestionnaireDescription>
                <QuestionnaireChoices
                    value={mode}
                    onValueChange={(val) => setMode(val as "personal" | "business")}
                >
                    <QuestionnaireChoice value="personal">
                        <span className="font-medium">Personal Mode</span>
                        <span className="text-xs text-muted-foreground">
                            Track individual expenses, budget categories, and shared group balances
                        </span>
                    </QuestionnaireChoice>
                    <QuestionnaireChoice value="business">
                        <span className="font-medium">Business Mode</span>
                        <span className="text-xs text-muted-foreground">
                            Manage customer & supplier ledgers, invoices, and business cash flow
                        </span>
                    </QuestionnaireChoice>
                </QuestionnaireChoices>
            </QuestionnaireItem>

            {/* Step 3: Accent Theme */}
            <QuestionnaireItem step={3}>
                <QuestionnaireTitle>Workspace Accent Theme</QuestionnaireTitle>
                <QuestionnaireDescription>
                    Select default accent palette boundaries for your active workspace interface.
                </QuestionnaireDescription>
                <QuestionnaireChoices
                    value={accent}
                    onValueChange={(val) => {
                        setAccent(val);
                        // Instant preview
                        updateThemeSettings(mode, {
                            theme: mode === "business" ? "light" : "dark",
                            accent: val,
                        });
                    }}
                >
                    <QuestionnaireChoice value="blue">
                        <span className="font-medium">Blue</span>
                        <span className="text-xs text-muted-foreground">
                            Professional corporate blue accents
                        </span>
                    </QuestionnaireChoice>
                    <QuestionnaireChoice value="green">
                        <span className="font-medium">Green</span>
                        <span className="text-xs text-muted-foreground">
                            Clean green primary accents
                        </span>
                    </QuestionnaireChoice>
                    <QuestionnaireChoice value="violet">
                        <span className="font-medium">Violet</span>
                        <span className="text-xs text-muted-foreground">
                            Modern vibrant violet accents
                        </span>
                    </QuestionnaireChoice>
                    <QuestionnaireChoice value="orange">
                        <span className="font-medium">Orange</span>
                        <span className="text-xs text-muted-foreground">
                            Warm high-contrast orange accents
                        </span>
                    </QuestionnaireChoice>
                    <QuestionnaireChoice value="rose">
                        <span className="font-medium">Rose</span>
                        <span className="text-xs text-muted-foreground">
                            Bold and expressive rose accents
                        </span>
                    </QuestionnaireChoice>
                    <QuestionnaireChoice value="slate">
                        <span className="font-medium">Slate</span>
                        <span className="text-xs text-muted-foreground">
                            Neutral and minimalist slate accents
                        </span>
                    </QuestionnaireChoice>
                </QuestionnaireChoices>
            </QuestionnaireItem>

            {/* Step 4: Primary Currency */}
            <QuestionnaireItem step={4}>
                <QuestionnaireTitle>Default Currency</QuestionnaireTitle>
                <QuestionnaireDescription>
                    Select the primary currency symbol for your financial amounts and transaction reports.
                </QuestionnaireDescription>
                <QuestionnaireChoices
                    value={currency}
                    onValueChange={(val) => setCurrency(val)}
                >
                    <QuestionnaireChoice value="₹">
                        <span className="font-medium">INR (₹) — Indian Rupee</span>
                    </QuestionnaireChoice>
                    <QuestionnaireChoice value="$">
                        <span className="font-medium">USD ($) — US Dollar</span>
                    </QuestionnaireChoice>
                    <QuestionnaireChoice value="€">
                        <span className="font-medium">EUR (€) — Euro</span>
                    </QuestionnaireChoice>
                    <QuestionnaireChoice value="£">
                        <span className="font-medium">GBP (£) — British Pound</span>
                    </QuestionnaireChoice>
                </QuestionnaireChoices>
            </QuestionnaireItem>

            {/* Questionnaire Actions */}
            <QuestionnaireActions>
                {step > 1 && <QuestionnairePrevious disabled={isSubmitting}>Previous</QuestionnairePrevious>}
                {step < 4 ? (
                    <QuestionnaireNext disabled={step === 1 && (!fullName || !isUsernameValid)}>Next</QuestionnaireNext>
                ) : (
                    <QuestionnaireSubmit onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : "Continue"}
                    </QuestionnaireSubmit>
                )}
            </QuestionnaireActions>
        </Questionnaire>
    )
}

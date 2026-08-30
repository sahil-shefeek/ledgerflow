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
    className?: string
    onComplete?: () => void
}

export function OnboardingWizard({
    defaultUsername = "",
    defaultFullName = "",
    defaultStep = 1,
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
                    const randomHex = Math.floor(Math.random() * 65535).toString(16)
                    const generatedSuggestions = [
                        `${debouncedUsername}123`,
                        `${cleanName}_${randomHex}`,
                        `${debouncedUsername}_app`
                    ]
                    const results = await Promise.all(generatedSuggestions.map(s => checkUsernameAvailability(s)))
                    setSuggestions(generatedSuggestions.filter((_, i) => results[i]))
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

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        
        setIsSubmitting(true)
        try {
            await completeGlobalOnboarding({ username, fullName, mode })
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
            totalSteps={2}
            className={className}
        >
            <div className="flex items-center justify-between mb-2">
                <QuestionnaireProgress className="tabular-nums font-medium text-xs text-muted-foreground">
                    Step {step} of 2
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

            {/* Questionnaire Actions */}
            <QuestionnaireActions>
                {step > 1 && <QuestionnairePrevious disabled={isSubmitting}>Previous</QuestionnairePrevious>}
                {step < 2 ? (
                    <QuestionnaireNext disabled={!fullName || !isUsernameValid}>Next</QuestionnaireNext>
                ) : (
                    <QuestionnaireSubmit onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : "Continue"}
                    </QuestionnaireSubmit>
                )}
            </QuestionnaireActions>
        </Questionnaire>
    )
}

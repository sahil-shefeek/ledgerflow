"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createAccount } from "@/lib/actions/accounts"
import { completeModeSetup } from "@/lib/actions/onboarding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModeOnboardingLayout } from "@/components/onboarding/ModeOnboardingLayout"
import { toast } from "@/components/ui/toast"

export default function PersonalOnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || "/dashboard"
  
  const [bankName, setBankName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleComplete = async (skipped: boolean) => {
    setIsSubmitting(true)
    try {
      if (!skipped && bankName) {
        await createAccount({ name: bankName, type: "BANK", balance: 0 })
      }
      await completeModeSetup("personal", "completed", true)
      toast.success(skipped ? "Personal setup skipped for now." : "Bank account added!")
      router.push(returnTo)
    } catch (e) {
      toast.error("Failed to complete setup")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModeOnboardingLayout 
      title="Personal Setup" 
      description="Add an initial bank account to start tracking your balance."
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Bank Name</label>
        <Input 
          placeholder="e.g. Chase Bank" 
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button 
          onClick={() => handleComplete(false)} 
          disabled={isSubmitting || !bankName}
          className="w-full"
        >
          Add Account & Continue
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => handleComplete(true)} 
          disabled={isSubmitting}
          className="w-full"
        >
          Skip for now (you can set this up later)
        </Button>
      </div>
    </ModeOnboardingLayout>
  )
}

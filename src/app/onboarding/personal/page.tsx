"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { completeModeSetup } from "@/lib/actions/onboarding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
      // In a real app, if !skipped, we would save the bank account to the DB here.
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
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md bg-card p-6 rounded-xl border shadow-sm space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Personal Setup</h1>
          <p className="text-sm text-muted-foreground">
            Add an initial bank account to start tracking your balance.
          </p>
        </div>

        <div className="space-y-4 pt-4">
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
        </div>
      </div>
    </div>
  )
}

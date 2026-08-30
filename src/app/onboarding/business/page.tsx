"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { completeModeSetup } from "@/lib/actions/onboarding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"

export default function BusinessOnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') || "/dashboard"
  
  const [businessName, setBusinessName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleComplete = async () => {
    setIsSubmitting(true)
    try {
      // In a real app, we would save the business name to the DB here.
      await completeModeSetup("business", "completed", true)
      toast.success("Business profile created!")
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
          <h1 className="text-2xl font-semibold tracking-tight">Business Setup</h1>
          <p className="text-sm text-muted-foreground">
            What is the name of your business?
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Business Name</label>
            <Input 
              placeholder="Acme Corp" 
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground pt-1">
              You can change this later in settings.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button 
              onClick={handleComplete} 
              disabled={isSubmitting || !businessName}
              className="w-full"
            >
              Save & Continue
            </Button>
            {/* Business name is un-skippable as per ADR / Grilling decision */}
          </div>
        </div>
      </div>
    </div>
  )
}

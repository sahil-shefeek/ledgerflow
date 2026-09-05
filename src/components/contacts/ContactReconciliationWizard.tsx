"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
  QuestionnaireError,
} from "@/components/ui/questionnaire"
import { toast } from "@/components/ui/toast"
import { requestGroupGhostMerge } from "@/lib/actions/groups"

export function getGhostKey(g: CandidateGhostMember): string {
  return `${g.groupId}:${g.ghostMemberId}`
}

export interface UnregisteredContact {
  id: string
  name: string
  phone?: string | null
  email?: string | null
}

export interface CandidateGhostMember {
  ghostMemberId: string
  groupId: string
  groupName: string
  ghostName: string
  adminId?: string
}

export interface ContactReconciliationWizardProps {
  unregisteredContacts?: UnregisteredContact[]
  candidateGhostMembers?: CandidateGhostMember[]
  targetUserId?: string
  defaultStep?: number
  onComplete?: (data: {
    contactId?: string
    contactName?: string
    groupId: string
    ghostMemberId: string
    targetUserId: string
  }) => void
  onRequestMerge?: (data: {
    groupId: string
    ghostMemberId: string
    targetUserId: string
  }) => Promise<{ success: boolean; requestId?: string }>
  className?: string
}

export function ContactReconciliationWizard({
  unregisteredContacts = [],
  candidateGhostMembers = [],
  targetUserId = "",
  defaultStep = 1,
  onComplete,
  onRequestMerge,
  className,
}: ContactReconciliationWizardProps) {
  const [step, setStep] = React.useState(defaultStep)

  // Step 1 State: Contact selection
  const [selectedContactId, setSelectedContactId] = React.useState<string>(
    unregisteredContacts[0]?.id || ""
  )
  const [customName, setCustomName] = React.useState("")

  // Step 2 State: Verified phone / email (user overrides or contact fallback)
  const activeContactId = selectedContactId || unregisteredContacts[0]?.id || ""
  const selectedContact = unregisteredContacts.find((c) => c.id === activeContactId)
  const [phoneOverride, setPhoneOverride] = React.useState<string | null>(null)
  const [emailOverride, setEmailOverride] = React.useState<string | null>(null)

  const phone = phoneOverride ?? selectedContact?.phone ?? ""
  const email = emailOverride ?? selectedContact?.email ?? ""

  // Step 3 State: Candidate ghost member selection & override
  const defaultGhostKey = candidateGhostMembers[0]
    ? getGhostKey(candidateGhostMembers[0])
    : ""
  const [ghostKeyOverride, setGhostKeyOverride] = React.useState<string>("")
  const activeGhostKey = ghostKeyOverride || defaultGhostKey

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const handleContactSelect = (val: string) => {
    setSelectedContactId(val)
    setPhoneOverride(null)
    setEmailOverride(null)
    setGhostKeyOverride("")
  }

  const handleGhostKeyOverrideSelect = (val: string) => {
    setGhostKeyOverride(val)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMsg(null)

    const ghostTarget = candidateGhostMembers.find(
      (g) => getGhostKey(g) === activeGhostKey || g.ghostMemberId === activeGhostKey
    )

    if (!ghostTarget) {
      const err = "Please select a ghost member record to claim."
      setErrorMsg(err)
      toast.error(err)
      return
    }

    setIsSubmitting(true)
    try {
      if (onRequestMerge) {
        await onRequestMerge({
          groupId: ghostTarget.groupId,
          ghostMemberId: ghostTarget.ghostMemberId,
          targetUserId,
        })
      } else {
        const res = await requestGroupGhostMerge({
          groupId: ghostTarget.groupId,
          ghostMemberId: ghostTarget.ghostMemberId,
          targetUserId,
        })
        if (res.error) throw new Error(res.error)
      }

      toast.success("Ghost member claim submitted! Admin approval requested.")
      
      const effectiveContactName = selectedContact?.name || customName || "Unregistered Contact"
      onComplete?.({
        contactId: selectedContactId || undefined,
        contactName: effectiveContactName,
        groupId: ghostTarget.groupId,
        ghostMemberId: ghostTarget.ghostMemberId,
        targetUserId,
      })
    } catch (err: any) {
      const message = err?.message || "Failed to submit ghost member claim"
      setErrorMsg(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Questionnaire
      step={step}
      onStepChange={setStep}
      totalSteps={3}
      className={className}
    >
      <div className="flex items-center justify-between">
        <QuestionnaireProgress className="tabular-nums font-medium text-xs text-muted-foreground">
          Step {step} of 3
        </QuestionnaireProgress>
      </div>

      {/* Step 1: Select Unregistered Contact */}
      <QuestionnaireItem step={1}>
        <QuestionnaireTitle>Select Unregistered Contact</QuestionnaireTitle>
        <QuestionnaireDescription>
          Choose an unregistered contact from your local workspace or enter contact details to reconcile identity.
        </QuestionnaireDescription>

        {unregisteredContacts.length > 0 && (
          <QuestionnaireChoices
            value={selectedContactId}
            onValueChange={handleContactSelect}
          >
            {unregisteredContacts.map((c) => (
              <QuestionnaireChoice key={c.id} value={c.id}>
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[c.phone, c.email].filter(Boolean).join(" • ") || "No phone/email"}
                </span>
              </QuestionnaireChoice>
            ))}
          </QuestionnaireChoices>
        )}

        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-medium text-muted-foreground">
            {unregisteredContacts.length > 0 ? "Or Enter Custom Contact Name" : "Contact Name"}
          </label>
          <QuestionnaireInput
            placeholder="e.g. Alice Smith"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        </div>
      </QuestionnaireItem>

      {/* Step 2: Identity Matching by Phone/Email */}
      <QuestionnaireItem step={2}>
        <QuestionnaireTitle>Verified Identity Matching</QuestionnaireTitle>
        <QuestionnaireDescription>
          Confirm or enter the verified phone number or email address used to match against group ghost member records.
        </QuestionnaireDescription>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Verified Phone Number
            </label>
            <QuestionnaireInput
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhoneOverride(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Verified Email Address
            </label>
            <QuestionnaireInput
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmailOverride(e.target.value)}
            />
          </div>
        </div>
      </QuestionnaireItem>

      {/* Step 3: Candidate Ghost Member Selection & Submission */}
      <QuestionnaireItem step={3}>
        <QuestionnaireTitle>Claim Group Ghost Member</QuestionnaireTitle>
        <QuestionnaireDescription>
          Select a candidate ghost member record in your shared group ledgers to submit a merge claim request to the group admin.
        </QuestionnaireDescription>

        {candidateGhostMembers.length > 0 ? (
          <QuestionnaireChoices
            value={activeGhostKey}
            onValueChange={handleGhostKeyOverrideSelect}
          >
            {candidateGhostMembers.map((g) => {
              const key = getGhostKey(g)
              return (
                <QuestionnaireChoice key={key} value={key}>
                  <span className="font-medium">{g.ghostName}</span>
                  <span className="text-xs text-muted-foreground">
                    Group: {g.groupName}
                  </span>
                </QuestionnaireChoice>
              )
            })}
          </QuestionnaireChoices>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            No unclaimed ghost member records found for this contact. You can still submit a direct claim request.
          </div>
        )}

        {errorMsg && <QuestionnaireError>{errorMsg}</QuestionnaireError>}
      </QuestionnaireItem>

      {/* Questionnaire Actions */}
      <QuestionnaireActions>
        {step > 1 && <QuestionnairePrevious>Previous</QuestionnairePrevious>}
        {step < 3 ? (
          <QuestionnaireNext>Next</QuestionnaireNext>
        ) : (
          <QuestionnaireSubmit onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting Claim..." : "Submit Claim Request"}
          </QuestionnaireSubmit>
        )}
      </QuestionnaireActions>
    </Questionnaire>
  )
}

export interface ReconcileContactsDialogProps extends ContactReconciliationWizardProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ReconcileContactsDialog({
  open,
  onOpenChange,
  ...wizardProps
}: ReconcileContactsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Contact Reconciliation</DialogTitle>
          <DialogDescription>
            Reconcile unregistered contacts and claim ghost member slots in shared group ledgers.
          </DialogDescription>
        </DialogHeader>
        <ContactReconciliationWizard
          {...wizardProps}
          onComplete={(data) => {
            wizardProps.onComplete?.(data)
            onOpenChange?.(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}


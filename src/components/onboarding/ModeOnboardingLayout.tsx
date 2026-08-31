import * as React from "react"

interface ModeOnboardingLayoutProps {
  title: string
  description: string
  children: React.ReactNode
}

export function ModeOnboardingLayout({ title, description, children }: ModeOnboardingLayoutProps) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md bg-card p-6 rounded-xl border shadow-sm space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="space-y-4 pt-4">
          {children}
        </div>
      </div>
    </div>
  )
}

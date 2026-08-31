import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToString } from "react-dom/server"
import React, { act } from "react"
import { createRoot, Root } from "react-dom/client"
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard"
import { useAppStore } from "@/store/useAppStore"
import { toast } from "@/components/ui/toast"

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/components/ui/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/lib/actions/onboarding", () => ({
  completeGlobalOnboarding: vi.fn().mockResolvedValue({ success: true }),
  checkUsernameAvailability: vi.fn().mockResolvedValue(true),
}))

describe("OnboardingWizard Rendering", () => {
  it("renders step 1 with username input and progress indicator", () => {
    const html = renderToString(<OnboardingWizard />)

    expect(html).toContain("Complete Your Profile")
    expect(html).toContain("Step <!-- -->1<!-- --> of 4")
    expect(html).toContain("tabular-nums")
  })
})

describe("OnboardingWizard Step Navigation & Preference Saving", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      mode: "personal",
      themeSettings: {
        personal: { theme: "dark", accent: "emerald" },
        business: { theme: "light", accent: "blue" },
      },
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it("navigates through steps and allows selecting choices", async () => {
    await act(async () => {
      root.render(<OnboardingWizard defaultStep={2} />)
    })

    expect(container.textContent).toContain("Select Workspace Mode")
    expect(container.textContent).toContain("Step 2 of 4")

    // Click Business Mode choice
    const choices = container.querySelectorAll('[data-slot="questionnaire-choice"]')
    expect(choices.length).toBeGreaterThan(0)
    
    // Find Business choice
    const businessChoice = Array.from(choices).find((c) => c.textContent?.includes("Business Mode")) as HTMLElement
    expect(businessChoice).not.toBeNull()

    await act(async () => {
      businessChoice.click()
    })

    expect(businessChoice.getAttribute("data-checked")).toBe("")

    // Click Next
    const nextBtn = container.querySelector('[data-slot="questionnaire-next"]') as HTMLButtonElement
    expect(nextBtn).not.toBeNull()

    await act(async () => {
      nextBtn.click()
    })

    // Assert Step 3
    expect(container.textContent).toContain("Workspace Accent Theme")
    expect(container.textContent).toContain("Step 3 of 4")

    // Click Previous
    const prevBtn = container.querySelector('[data-slot="questionnaire-previous"]') as HTMLButtonElement
    expect(prevBtn).not.toBeNull()

    await act(async () => {
      prevBtn.click()
    })

    // Assert back to Step 2
    expect(container.textContent).toContain("Select Workspace Mode")
    expect(container.textContent).toContain("Step 2 of 4")
  })

  it("saves preferences to useAppStore and triggers toast.success on completing wizard", async () => {
    const onCompleteMock = vi.fn()

    await act(async () => {
      root.render(
        <OnboardingWizard 
          defaultUsername="testuser"
          defaultStep={2}
          onComplete={onCompleteMock} 
        />
      )
    })

    // Step 2: Select Business Mode
    const choices1 = container.querySelectorAll('[data-slot="questionnaire-choice"]')
    const businessChoice = Array.from(choices1).find((c) => c.textContent?.includes("Business Mode")) as HTMLElement
    await act(async () => {
      businessChoice.click()
    })

    // Move to Step 3
    const nextBtn1 = container.querySelector('[data-slot="questionnaire-next"]') as HTMLButtonElement
    await act(async () => {
      nextBtn1.click()
    })

    // Step 3: Select Blue accent
    const choices2 = container.querySelectorAll('[data-slot="questionnaire-choice"]')
    const blueChoice = Array.from(choices2).find((c) => c.textContent?.includes("Blue")) as HTMLElement
    await act(async () => {
      blueChoice.click()
    })

    // Move to Step 4
    const nextBtn2 = container.querySelector('[data-slot="questionnaire-next"]') as HTMLButtonElement
    await act(async () => {
      nextBtn2.click()
    })

    // Step 4: Select USD ($)
    const choices3 = container.querySelectorAll('[data-slot="questionnaire-choice"]')
    const usdChoice = Array.from(choices3).find((c) => c.textContent?.includes("USD ($)")) as HTMLElement
    await act(async () => {
      usdChoice.click()
    })

    // Submit / Complete Setup
    const submitBtn = container.querySelector('[data-slot="questionnaire-submit"]') as HTMLButtonElement
    expect(submitBtn).not.toBeNull()

    await act(async () => {
      submitBtn.click()
    })

    // Assert preferences were saved
    expect(useAppStore.getState().mode).toBe("business")
    expect(useAppStore.getState().themeSettings.business.accent).toBe("blue")
    expect(toast.success).toHaveBeenCalledWith("Profile created!")
    expect(onCompleteMock).toHaveBeenCalled()
  })
})

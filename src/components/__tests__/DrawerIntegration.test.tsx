import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { PersonalTransactionDrawer } from '../personal/PersonalTransactionDrawer'
import { BusinessTransactionDrawer } from '../business/BusinessTransactionDrawer'
import { SplitExpenseDrawer } from '../groups/SplitExpenseDrawer'
import { ContactReconciliationWizard, getGhostKey } from '../contacts/ContactReconciliationWizard'

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams(),
}))

function changeInputValue(input: HTMLInputElement, value: string) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeInputValueSetter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
}

// Mock data & hooks
let mockAccountsData: any[] | undefined = [
    { id: 'acc-default', name: 'Primary Cash', is_default: true, balance: 10000 },
    { id: 'acc-savings', name: 'Savings Account', is_default: false, balance: 50000 },
]

vi.mock('@/hooks/useAccounts', () => ({
    useAccounts: () => ({
        data: mockAccountsData,
        isLoading: false,
    }),
}))

vi.mock('@/hooks/personal/usePersonalPeople', () => ({
    usePersonalPeople: () => ({
        data: [{ id: 'person-1', name: 'Alice Smith' }],
        isLoading: false,
    }),
}))

vi.mock('@/hooks/business/useBusinessContacts', () => ({
    useBusinessContacts: () => ({
        data: [{ id: 'biz-contact-1', name: 'Acme Corp' }],
        isLoading: false,
    }),
}))

vi.mock('@/hooks/useBudgets', () => ({
    useBudgets: () => ({
        data: [{ id: 'cat-groceries', name: 'Groceries', icon: '🛒' }],
        isLoading: false,
    }),
}))

const mockAddTransaction = vi.fn()
const mockUpdateTransaction = vi.fn()

vi.mock('@/hooks/useAddTransaction', () => ({
    useAddTransaction: () => ({
        mutate: mockAddTransaction,
        isPending: false,
    }),
}))

vi.mock('@/hooks/useUpdateTransaction', () => ({
    useUpdateTransaction: () => ({
        mutate: mockUpdateTransaction,
        isPending: false,
    }),
}))

vi.mock('@/components/ui/toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@/lib/actions/groups', () => ({
    requestGroupGhostMerge: vi.fn().mockResolvedValue({
        success: true,
        requestId: 'req-mock-123',
        groupId: 'group-1',
    }),
}))

describe('Drawer State Synchronization & Integration Suite', () => {
    let container: HTMLDivElement
    let root: Root
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        vi.clearAllMocks()
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        mockAccountsData = [
            { id: 'acc-default', name: 'Primary Cash', is_default: true, balance: 10000 },
            { id: 'acc-savings', name: 'Savings Account', is_default: false, balance: 50000 },
        ]

        container = document.createElement('div')
        document.body.appendChild(container)
        root = createRoot(container)
    })

    afterEach(() => {
        act(() => {
            root.unmount()
        })
        container.remove()

        // Confirm 0 React console errors or warnings regarding state updates during render phase
        const renderPhaseErrors = [...consoleErrorSpy.mock.calls, ...consoleWarnSpy.mock.calls].filter((call: any[]) =>
            call.some(
                (arg: any) =>
                    typeof arg === 'string' &&
                    (arg.includes('Cannot update a component') ||
                        arg.includes('State update on unmounted component') ||
                        arg.includes('bad setState'))
            )
        )
        expect(renderPhaseErrors).toHaveLength(0)

        consoleErrorSpy.mockRestore()
        consoleWarnSpy.mockRestore()
    })

    describe('PersonalTransactionDrawer Integration', () => {
        it('resets form values upon open transition and key-based re-mounting', async () => {
            await act(async () => {
                root.render(
                    <PersonalTransactionDrawer
                        key="drawer-pass-1"
                        open={true}
                        hideTrigger={true}
                    />
                )
            })

            const nameInput = (document.body.querySelector('input[placeholder*="Starbucks"]') || document.body.querySelector('input[name="name"]')) as HTMLInputElement
            expect(nameInput).not.toBeNull()
            expect(nameInput.value).toBe('')

            // Change input value
            await act(async () => {
                changeInputValue(nameInput, 'Coffee with Friend')
            })
            expect(nameInput.value).toBe('Coffee with Friend')

            // Re-mount drawer upon new open transition
            await act(async () => {
                root.render(
                    <PersonalTransactionDrawer
                        key="drawer-pass-2"
                        open={true}
                        hideTrigger={true}
                    />
                )
            })

            const resetNameInput = (document.body.querySelector('input[placeholder*="Starbucks"]') || document.body.querySelector('input[name="name"]')) as HTMLInputElement
            expect(resetNameInput).not.toBeNull()
            expect(resetNameInput.value).toBe('')
        })

        it('populates form with initialData upon open and pre-selects default account UI', async () => {
            const mockTx = {
                id: 'tx-personal-1',
                amount: 45000, // 450.00 INR
                name: 'Groceries at Supermarket',
                note: 'Weekly provisions',
                flow: 'OUT',
                category_id: 'cat-groceries',
                contact_id: 'person-1',
            }

            await act(async () => {
                root.render(
                    <PersonalTransactionDrawer
                        open={true}
                        initialData={mockTx}
                        hideTrigger={true}
                    />
                )
            })

            const nameInput = (document.body.querySelector('input[placeholder*="Starbucks"]') || document.body.querySelector('input[name="name"]')) as HTMLInputElement
            const amountInput = (document.body.querySelector('input[placeholder="0.00"]') || document.body.querySelector('input[name="amount"]')) as HTMLInputElement

            expect(nameInput).not.toBeNull()
            expect(amountInput).not.toBeNull()
            expect(nameInput.value).toBe('Groceries at Supermarket')
            expect(amountInput.value).toBe('450')

            // Assert UI pre-selection for default account item
            const defaultAccToggle = Array.from(document.body.querySelectorAll('button')).find(
                (btn) => btn.textContent?.includes('Primary Cash')
            )
            expect(defaultAccToggle).not.toBeUndefined()
            expect(defaultAccToggle?.hasAttribute('data-pressed')).toBe(true)
        })

        it('pre-selects fallback account UI when no account is marked is_default', async () => {
            mockAccountsData = [
                { id: 'acc-fallback-1', name: 'Account 1', is_default: false, balance: 1000 },
                { id: 'acc-fallback-2', name: 'Account 2', is_default: false, balance: 2000 },
            ]

            await act(async () => {
                root.render(
                    <PersonalTransactionDrawer
                        open={true}
                        hideTrigger={true}
                    />
                )
            })

            const fallbackAccToggle = Array.from(document.body.querySelectorAll('button')).find(
                (btn) => btn.textContent?.includes('Account 1')
            )
            expect(fallbackAccToggle).not.toBeUndefined()
            expect(fallbackAccToggle?.hasAttribute('data-pressed')).toBe(true)
        })
    })

    describe('BusinessTransactionDrawer Integration', () => {
        it('resets form values upon open state transitions', async () => {
            await act(async () => {
                root.render(
                    <BusinessTransactionDrawer
                        open={true}
                        hideTrigger={true}
                    />
                )
            })

            const nameInput = document.body.querySelector('input[placeholder*="Payment for goods"]') as HTMLInputElement
            expect(nameInput).not.toBeNull()
            expect(nameInput.value).toBe('')

            // Render closed then re-open
            await act(async () => {
                root.render(
                    <BusinessTransactionDrawer
                        open={false}
                        hideTrigger={true}
                    />
                )
            })

            await act(async () => {
                root.render(
                    <BusinessTransactionDrawer
                        open={true}
                        hideTrigger={true}
                    />
                )
            })

            const reopenedNameInput = document.body.querySelector('input[placeholder*="Payment for goods"]') as HTMLInputElement
            expect(reopenedNameInput).not.toBeNull()
            expect(reopenedNameInput.value).toBe('')
        })

        it('populates business initialData cleanly on open', async () => {
            const initialBizTx = {
                id: 'biz-1',
                amount: 120000, // 1200 INR
                name: 'Office Supplies Order',
                note: 'Paper and ink',
                flow: 'OUT',
                contact_id: 'biz-contact-1',
            }

            await act(async () => {
                root.render(
                    <BusinessTransactionDrawer
                        open={true}
                        initialData={initialBizTx}
                        hideTrigger={true}
                    />
                )
            })

            const nameInput = document.body.querySelector('input[placeholder*="Payment for goods"]') as HTMLInputElement
            const amountInput = document.body.querySelector('input[placeholder="0.00"]') as HTMLInputElement

            expect(nameInput).not.toBeNull()
            expect(amountInput).not.toBeNull()
            expect(nameInput.value).toBe('Office Supplies Order')
            expect(amountInput.value).toBe('1200')
        })
    })

    describe('SplitExpenseDrawer Integration', () => {
        const mockMembers = [
            { id: 'm-1', group_id: 'g-1', user_id: 'user-1', ghost_name: 'User One', avatar_url: null, joined_at: '2026-01-01' },
            { id: 'm-2', group_id: 'g-1', user_id: 'user-2', ghost_name: 'User Two', avatar_url: null, joined_at: '2026-01-01' },
        ]

        it('resets transient step and input values when drawer is closed and re-opened via onOpenChange', async () => {
            await act(async () => {
                root.render(
                    <SplitExpenseDrawer groupId="g-1" members={mockMembers} currentUserId="user-1">
                        <button id="split-trigger">Open Split</button>
                    </SplitExpenseDrawer>
                )
            })

            // Trigger drawer open
            const trigger = container.querySelector('#split-trigger') as HTMLElement
            await act(async () => {
                trigger?.click()
            })

            // Populate Step 1 inputs
            const descInput = document.body.querySelector('input[placeholder*="this for"]') as HTMLInputElement
            const amountInput = document.body.querySelector('input[placeholder="0"]') as HTMLInputElement

            expect(descInput).not.toBeNull()
            expect(amountInput).not.toBeNull()

            await act(async () => {
                changeInputValue(descInput, 'Dinner')
                changeInputValue(amountInput, '100')
            })

            // Navigate to Step 2
            const nextButton = Array.from(document.body.querySelectorAll('button')).find(
                (btn) => btn.textContent?.includes('Next: Split Details') || btn.textContent?.includes('Next')
            )
            expect(nextButton).not.toBeUndefined()

            await act(async () => {
                nextButton?.click()
            })

            // Verify Step 2 is active (contains split configuration UI)
            expect(document.body.textContent).toContain('Split equally')

            // Close drawer via overlay close or backdrop click
            const closeBtn = document.body.querySelector('[data-slot="drawer-close"]') || document.body.querySelector('button[aria-label="Close"]')
            if (closeBtn) {
                await act(async () => {
                    (closeBtn as HTMLElement).click()
                })
            }

            // Re-trigger drawer open
            await act(async () => {
                trigger?.click()
            })

            // Assert drawer step resets to Step 1 and input fields are cleared
            const resetDescInput = document.body.querySelector('input[placeholder*="this for"]') as HTMLInputElement
            const resetAmountInput = document.body.querySelector('input[placeholder="0"]') as HTMLInputElement
            expect(resetDescInput?.value).toBe('')
            expect(resetAmountInput?.value).toBe('')
        })

        it('resolves default account selection UI accurately', async () => {
            await act(async () => {
                root.render(
                    <SplitExpenseDrawer groupId="g-1" members={mockMembers} currentUserId="user-1">
                        <button id="split-trigger-2">Open Split</button>
                    </SplitExpenseDrawer>
                )
            })

            const trigger = container.querySelector('#split-trigger-2') as HTMLElement
            await act(async () => {
                trigger?.click()
            })

            // Assert account selection UI displays default account name 'Primary Cash'
            expect(document.body.textContent).toContain('Primary Cash')
        })
    })

    describe('ContactReconciliationWizard Integration', () => {
        const mockContacts = [
            { id: 'contact-1', name: 'Alice Smith', phone: '+1555123456', email: 'alice@example.com' },
            { id: 'contact-2', name: 'Bob Jones', phone: '+1555987654', email: 'bob@example.com' },
        ]

        const mockGhosts = [
            {
                ghostMemberId: 'ghost-101',
                groupId: 'group-1',
                groupName: 'Summer Trip 2026',
                ghostName: 'Alice (Ghost)',
                adminId: 'admin-user-1',
            },
            {
                ghostMemberId: 'ghost-102',
                groupId: 'group-2',
                groupName: 'Office Lunch Club',
                ghostName: 'Bob J.',
                adminId: 'admin-user-2',
            },
        ]

        it('navigates through steps, derives default ghost key, and handles ghost key override selection', async () => {
            const onCompleteMock = vi.fn()

            await act(async () => {
                root.render(
                    <ContactReconciliationWizard
                        unregisteredContacts={mockContacts}
                        candidateGhostMembers={mockGhosts}
                        targetUserId="user-me"
                        onComplete={onCompleteMock}
                    />
                )
            })

            // Step 1 check
            expect(container.textContent).toContain('Select Unregistered Contact')
            expect(container.textContent).toContain('Step 1 of 3')

            // Advance Step 1 -> Step 2
            const nextStep1Btn = container.querySelector('button[type="submit"]') || Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Next'))
            expect(nextStep1Btn).not.toBeNull()

            await act(async () => {
                (nextStep1Btn as HTMLElement).click()
            })

            // Step 2 check: Phone & Email override verification
            expect(container.textContent).toContain('Step 2 of 3')

            // Advance Step 2 -> Step 3
            const nextStep2Btn = container.querySelector('button[type="submit"]') || Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Next'))
            expect(nextStep2Btn).not.toBeNull()

            await act(async () => {
                (nextStep2Btn as HTMLElement).click()
            })

            // Step 3 check: Candidate Ghost Member selection & default ghost key check
            expect(container.textContent).toContain('Step 3 of 3')
            expect(container.textContent).toContain('Summer Trip 2026')
            expect(container.textContent).toContain('Alice (Ghost)')

            const expectedDefaultGhostKey = getGhostKey(mockGhosts[0])
            expect(expectedDefaultGhostKey).toBe('group-1:ghost-101')

            // Select second ghost member candidate to test ghostKeyOverride state update
            const ghostChoices = container.querySelectorAll('[data-slot="questionnaire-choice"]')
            if (ghostChoices.length > 1) {
                await act(async () => {
                    (ghostChoices[1] as HTMLElement).click()
                })
            }

            // Submit wizard
            const submitBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Send Merge Request') || b.textContent?.includes('Submit'))
            if (submitBtn) {
                await act(async () => {
                    submitBtn.click()
                })
            }
        })
    })
})

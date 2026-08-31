import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { getPersonalTransactionFormDefaults, PersonalTransactionDrawer } from '../personal/PersonalTransactionDrawer'
import { PersonalTransactionList } from '../finance/PersonalTransactionList'

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/hooks/personal/usePersonalPeople', () => ({
    usePersonalPeople: () => ({
        data: [{ id: 'person-1', name: 'Alice' }],
    }),
}))

vi.mock('@/hooks/useBudgets', () => ({
    useBudgets: () => ({
        data: [{ id: 'cat-food', name: 'Food & Dining', icon: '🍔' }],
    }),
}))

vi.mock('@/hooks/useAccounts', () => ({
    useAccounts: () => ({
        data: [
            { id: 'acc-cash', name: 'Cash', balance: 5000, is_default: true },
            { id: 'acc-bank', name: 'Bank Account', balance: 10000, is_default: false },
        ],
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

const mockTransactions = [
    {
        id: 'tx-123',
        amount: 25000, // 250.00 INR in paise
        flow: 'OUT' as const,
        name: 'Dinner at Bistro',
        note: 'Team dinner',
        date: '2026-08-01T12:00:00.000Z',
        category_id: 'cat-food',
        account_id: 'acc-cash',
        contact_id: 'person-1',
        category: { id: 'cat-food', name: 'Food & Dining', icon: '🍔' },
        account: { id: 'acc-cash', name: 'Cash', type: 'CASH' },
        contact: { id: 'person-1', name: 'Alice' },
        mode: 'PERSONAL' as const,
    },
]

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(({ queryKey }) => {
        if (queryKey[0] === 'personal-transactions') {
            return { data: mockTransactions, isLoading: false }
        }
        return { data: [], isLoading: false }
    }),
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/use-profile', () => ({
    useProfile: () => ({
        profile: { id: 'user-1' },
    }),
}))

describe('getPersonalTransactionFormDefaults', () => {
    it('returns empty/default values when initialData is undefined', () => {
        const defaults = getPersonalTransactionFormDefaults(undefined)
        expect(defaults.amount).toBeUndefined()
        expect(defaults.name).toBe('')
        expect(defaults.note).toBe('')
        expect(defaults.flow).toBe('OUT')
        expect(defaults.contact_id).toBeNull()
        expect(defaults.category_id).toBeNull()
        expect(defaults.account_id).toBeUndefined()
    })

    it('correctly converts amount from paise to rupees and populates initial values', () => {
        const mockTx = mockTransactions[0]
        const defaults = getPersonalTransactionFormDefaults(mockTx)

        expect(defaults.amount).toBe(250) // 25000 paise = 250 rupees
        expect(defaults.name).toBe('Dinner at Bistro')
        expect(defaults.note).toBe('Team dinner')
        expect(defaults.flow).toBe('OUT')
        expect(defaults.category_id).toBe('cat-food')
        expect(defaults.account_id).toBe('acc-cash')
        expect(defaults.contact_id).toBe('person-1')
    })
})

describe('PersonalTransactionDrawer Edit Mode Wiring', () => {
    let container: HTMLDivElement
    let root: Root

    beforeEach(() => {
        vi.clearAllMocks()
        container = document.createElement('div')
        document.body.appendChild(container)
        root = createRoot(container)
    })

    afterEach(() => {
        act(() => {
            root.unmount()
        })
        container.remove()
    })

    it('submits updateTransactionAction with modified fields when editing an existing transaction', async () => {
        const mockTx = mockTransactions[0]

        await act(async () => {
            root.render(
                <PersonalTransactionDrawer
                    open={true}
                    initialData={mockTx}
                    hideTrigger={true}
                />
            )
        })

        const form = container.querySelector('form') || document.querySelector('form')
        expect(form).not.toBeNull()

        await act(async () => {
            form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
        })

        expect(mockUpdateTransaction).toHaveBeenCalledTimes(1)
        const callArg = mockUpdateTransaction.mock.calls[0][0]
        expect(callArg.id).toBe('tx-123')
        expect(callArg.amount).toBe(250) // form value in rupees
        expect(callArg.name).toBe('Dinner at Bistro')
        expect(callArg.mode).toBe('PERSONAL')
        expect(callArg.account_id).toBe('acc-cash')
        expect(callArg.category_id).toBe('cat-food')
        expect(callArg.contact_id).toBe('person-1')
    })

    it('invokes onEdit callback when TransactionDetailsDrawer edit action is triggered from PersonalTransactionList', async () => {
        const onEditMock = vi.fn()

        await act(async () => {
            root.render(<PersonalTransactionList onEdit={onEditMock} />)
        })

        const transactionRow = container.querySelector('.cursor-pointer') as HTMLDivElement
        expect(transactionRow).not.toBeNull()

        await act(async () => {
            transactionRow.click()
        })

        // Details drawer should be open with transaction details
        const editBtn = document.body.querySelector('button:has(.lucide-edit)') || Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Edit'))
        expect(editBtn).not.toBeUndefined()

        await act(async () => {
            (editBtn as HTMLButtonElement).click()
        })

        expect(onEditMock).toHaveBeenCalledTimes(1)
        expect(onEditMock.mock.calls[0][0].id).toBe('tx-123')
    })
})

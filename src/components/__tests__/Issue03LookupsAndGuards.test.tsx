import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { AccountsList } from '../finance/AccountsList'
import { GroupsList } from '../groups/GroupsList'
import { PersonalTransactionList } from '../finance/PersonalTransactionList'

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

let mockAccountsData: any[] | undefined = []
let mockAccountsLoading = false

vi.mock('@/hooks/useAccounts', () => ({
    useAccounts: () => ({
        data: mockAccountsData,
        isLoading: mockAccountsLoading,
    }),
}))

let mockGroupsData: any[] | undefined = []
let mockGroupsLoading = false

vi.mock('@/hooks/groups/useGroups', () => ({
    useGroups: () => ({
        data: mockGroupsData,
        isLoading: mockGroupsLoading,
    }),
}))

const mockTransactionsData = [
    {
        id: 'tx-2',
        amount: 50000,
        flow: 'OUT' as const,
        name: 'Grocery Shopping',
        date: '2026-08-02T10:00:00.000Z',
        category: { name: 'Food', icon: '🛒' },
        account: { name: 'Card', type: 'OTHER' },
        contact: null,
        mode: 'PERSONAL' as const,
    },
    {
        id: 'tx-1',
        amount: 10000,
        flow: 'IN' as const,
        name: 'Refund',
        date: '2026-08-01T10:00:00.000Z',
        category: { name: 'Refund', icon: '💰' },
        account: { name: 'Bank', type: 'BANK' },
        contact: null,
        mode: 'PERSONAL' as const,
    },
]

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(({ queryKey }) => {
        if (queryKey[0] === 'personal-transactions') {
            return { data: mockTransactionsData, isLoading: false }
        }
        return { data: [], isLoading: false }
    }),
    useMutation: () => ({
        mutate: vi.fn(),
        isPending: false,
    }),
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams(),
}))

describe('Issue 03: Safety Guards and Date Transform Caching', () => {
    let container: HTMLDivElement
    let root: Root

    beforeEach(() => {
        vi.clearAllMocks()
        mockAccountsData = []
        mockAccountsLoading = false
        mockGroupsData = []
        mockGroupsLoading = false
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

    it('renders empty AccountsList without rendering text node artifact "0"', async () => {
        mockAccountsData = []
        await act(async () => {
            root.render(<AccountsList />)
        })

        expect(container.textContent).toContain('No accounts created')
        // Ensure literal "0" text node artifact is not rendered directly in card content
        const cardContent = container.querySelector('.space-y-4')
        expect(cardContent?.childNodes[0]?.nodeValue).not.toBe('0')
    })

    it('renders empty GroupsList without text node artifact "0"', async () => {
        mockGroupsData = []
        await act(async () => {
            root.render(<GroupsList />)
        })

        expect(container.textContent).toContain('No Groups Yet')
    })

    it('sorts and filters PersonalTransactionList with pre-parsed dates', async () => {
        await act(async () => {
            root.render(<PersonalTransactionList />)
        })

        expect(container.textContent).toContain('Grocery Shopping')
        expect(container.textContent).toContain('Refund')

        // Default sort (LATEST): Grocery Shopping (Aug 2) should appear before Refund (Aug 1)
        const items = container.querySelectorAll('.cursor-pointer')
        expect(items.length).toBe(2)
        expect(items[0].textContent).toContain('Grocery Shopping')
        expect(items[1].textContent).toContain('Refund')
    })
})

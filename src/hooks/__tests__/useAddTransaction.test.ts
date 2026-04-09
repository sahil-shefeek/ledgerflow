import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Paise, Contact } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

const mockRpc = vi.fn()
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })
const mockSupabase = {
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
}

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => mockSupabase,
}))

vi.mock('@/store/useAppStore', () => ({
    useAppStore: () => ({ currentBusinessId: 'biz-1' }),
}))

// Capture setQueryData / getQueryData / cancelQueries / invalidateQueries calls
const queryDataStore = new Map<string, unknown>()

const mockCancelQueries = vi.fn().mockResolvedValue(undefined)
const mockInvalidateQueries = vi.fn()
const mockSetQueryData = vi.fn((key: unknown[], updater: unknown) => {
    const serializedKey = JSON.stringify(key)
    if (typeof updater === 'function') {
        const prev = queryDataStore.get(serializedKey)
        const next = (updater as (old: unknown) => unknown)(prev)
        queryDataStore.set(serializedKey, next)
    } else {
        queryDataStore.set(serializedKey, updater)
    }
})
const mockGetQueryData = vi.fn((key: unknown[]) => {
    return queryDataStore.get(JSON.stringify(key))
})

const mockQueryClient = {
    cancelQueries: mockCancelQueries,
    invalidateQueries: mockInvalidateQueries,
    setQueryData: mockSetQueryData,
    getQueryData: mockGetQueryData,
}

vi.mock('@tanstack/react-query', () => ({
    useMutation: (config: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            mutationFn: config.mutationFn,
            onMutate: config.onMutate,
            onError: config.onError,
            onSettled: config.onSettled,
            onSuccess: config.onSuccess,
            _config: config,
        }
    },
    useQueryClient: () => mockQueryClient,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHook = Record<string, any>

import { useAddTransaction } from '../useAddTransaction'
import { toast } from 'sonner'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const baseTransaction = {
    amount: 500,
    flow: 'OUT' as const,
    mode: 'BUSINESS' as const,
    contact_id: 'contact-1',
    date: new Date('2026-04-09T12:00:00Z'),
    name: 'Test Transaction',
}

function makeContactsData(): Contact[] {
    return [
        {
            id: 'contact-1',
            name: 'Alice',
            phone: null,
            type: 'CUSTOMER',
            net_balance: 10000 as Paise,
            last_transaction_at: '2026-04-08T12:00:00Z',
            business_id: 'biz-1',
            image_url: null,
            transaction_count: 5,
        },
    ]
}

describe('useAddTransaction — onMutate optimistic update', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        queryDataStore.clear()
    })

    it('sets cache under key [\"transactions\", { contactId, mode }] — NOT [\"transactions\", contactId]', async () => {
        const hook = useAddTransaction() as unknown as AnyHook
        await hook.onMutate(baseTransaction)

        // The correct key shape
        const correctKey = JSON.stringify(['transactions', { contactId: 'contact-1', mode: 'BUSINESS' }])
        // The old broken key shape
        const brokenKey = JSON.stringify(['transactions', 'contact-1'])

        expect(queryDataStore.has(correctKey)).toBe(true)
        expect(queryDataStore.has(brokenKey)).toBe(false)
    })

    it('prepends a temp transaction with id starting with \"temp-\" to page 0', async () => {
        // Seed existing cache with correct key shape
        const existingKey = ['transactions', { contactId: 'contact-1', mode: 'BUSINESS' }]
        queryDataStore.set(JSON.stringify(existingKey), {
            pages: [[{ id: 'existing-1', name: 'Old' }]],
            pageParams: [0],
        })

        const hook = useAddTransaction() as unknown as AnyHook
        await hook.onMutate(baseTransaction)

        const cached = queryDataStore.get(JSON.stringify(existingKey)) as any // eslint-disable-line @typescript-eslint/no-explicit-any
        expect(cached.pages[0]).toHaveLength(2)
        expect(cached.pages[0][0].id).toMatch(/^temp-/)
        expect(cached.pages[0][1].id).toBe('existing-1')
    })

    it('updates contacts cache net_balance by +amount (Paise) when flow is OUT', async () => {
        queryDataStore.set(JSON.stringify(['contacts']), makeContactsData())

        const hook = useAddTransaction() as unknown as AnyHook
        await hook.onMutate({ ...baseTransaction, flow: 'OUT', amount: 2000 })

        const contacts = queryDataStore.get(JSON.stringify(['contacts'])) as Contact[]
        const alice = contacts.find(c => c.id === 'contact-1')!
        // OUT = you gave = balance increases by amount
        expect(alice.net_balance).toBe(12000) // 10000 + 2000
    })

    it('updates contacts cache net_balance by -amount (Paise) when flow is IN', async () => {
        queryDataStore.set(JSON.stringify(['contacts']), makeContactsData())

        const hook = useAddTransaction() as unknown as AnyHook
        await hook.onMutate({ ...baseTransaction, flow: 'IN', amount: 3000 })

        const contacts = queryDataStore.get(JSON.stringify(['contacts'])) as Contact[]
        const alice = contacts.find(c => c.id === 'contact-1')!
        // IN = you got = balance decreases by amount
        expect(alice.net_balance).toBe(7000) // 10000 - 3000
    })

    it('returns a context object containing { previousTransactions, previousContacts, optimisticQueryKey }', async () => {
        queryDataStore.set(JSON.stringify(['contacts']), makeContactsData())

        const hook = useAddTransaction() as unknown as AnyHook
        const context = await hook.onMutate(baseTransaction)

        expect(context).toHaveProperty('previousTransactions')
        expect(context).toHaveProperty('previousContacts')
        expect(context).toHaveProperty('optimisticQueryKey')
        expect(context.optimisticQueryKey).toEqual(['transactions', { contactId: 'contact-1', mode: 'BUSINESS' }])
    })
})

describe('useAddTransaction — onError rollback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        queryDataStore.clear()
    })

    it('restores previousTransactions to the optimisticQueryKey on error', async () => {
        const existingKey = ['transactions', { contactId: 'contact-1', mode: 'BUSINESS' }]
        const originalData = { pages: [[{ id: 'orig-1' }]], pageParams: [0] }
        queryDataStore.set(JSON.stringify(existingKey), originalData)

        const hook = useAddTransaction() as unknown as AnyHook
        const context = await hook.onMutate(baseTransaction)

        // Simulate error rollback
        hook.onError(new Error('Network error'), baseTransaction, context)

        // Check setQueryData was called to restore the optimistic key
        expect(mockSetQueryData).toHaveBeenCalledWith(
            existingKey,
            originalData,
        )
    })

    it('restores previousContacts on error', async () => {
        const contactsData = makeContactsData()
        queryDataStore.set(JSON.stringify(['contacts']), contactsData)

        const hook = useAddTransaction() as unknown as AnyHook
        const context = await hook.onMutate(baseTransaction)

        hook.onError(new Error('Failed'), baseTransaction, context)

        expect(mockSetQueryData).toHaveBeenCalledWith(
            ['contacts'],
            contactsData,
        )
    })

    it('shows toast.error (NOT toast.success) on error', () => {
        const hook = useAddTransaction() as unknown as AnyHook
        const context = {
            previousTransactions: undefined,
            previousContacts: undefined,
            optimisticQueryKey: ['transactions', { mode: 'BUSINESS' }],
        }

        hook.onError(new Error('fail'), baseTransaction, context)

        expect(toast.error).toHaveBeenCalled()
        expect(toast.success).not.toHaveBeenCalled()
    })
})

describe('useAddTransaction — onSettled', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does NOT call toast.success (toast is the caller\'s responsibility)', () => {
        const hook = useAddTransaction() as unknown as AnyHook
        hook.onSettled()

        expect(toast.success).not.toHaveBeenCalled()
    })

    it('invalidates [\"transactions\"], [\"contacts\"], [\"analytics\"], [\"group-balances\"], [\"budgets\"]', () => {
        const hook = useAddTransaction() as unknown as AnyHook
        hook.onSettled()

        const invalidatedKeys = mockInvalidateQueries.mock.calls.map(
            (call: unknown[][]) => call[0]
        )

        expect(invalidatedKeys).toContainEqual({ queryKey: ['transactions'] })
        expect(invalidatedKeys).toContainEqual({ queryKey: ['contacts'] })
        expect(invalidatedKeys).toContainEqual({ queryKey: ['analytics'] })
        expect(invalidatedKeys).toContainEqual({ queryKey: ['group-balances'] })
        expect(invalidatedKeys).toContainEqual({ queryKey: ['budgets'] })
    })
})

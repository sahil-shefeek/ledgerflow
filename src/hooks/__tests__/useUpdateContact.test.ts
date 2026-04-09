import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Paise } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

// Track the payload sent to Supabase .update()
let capturedUpdatePayload: Record<string, unknown> | null = null

const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null })
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn(() => ({ select: mockSelect }))
const mockUpdate = vi.fn((payload: Record<string, unknown>) => {
    capturedUpdatePayload = payload
    return { eq: mockEq }
})
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

const mockSupabase = {
    from: mockFrom,
}

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => mockSupabase,
}))

const mockInvalidateQueries = vi.fn()
const mockQueryClient = {
    invalidateQueries: mockInvalidateQueries,
}

vi.mock('@tanstack/react-query', () => ({
    useMutation: (config: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            mutationFn: config.mutationFn,
            onSuccess: config.onSuccess,
            onError: config.onError,
            _config: config,
        }
    },
    useQueryClient: () => mockQueryClient,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHook = Record<string, any>

import { useUpdateContact } from '../useUpdateContact'

describe('useUpdateContact — computed field stripping', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedUpdatePayload = null
        mockSingle.mockResolvedValue({ data: { id: 'contact-1' }, error: null })
    })

    it('does NOT include net_balance in the Supabase .update() payload', async () => {
        const hook = useUpdateContact() as unknown as AnyHook
        await hook.mutationFn({
            id: 'contact-1',
            name: 'Updated Name',
            net_balance: 50000 as Paise,
        })

        expect(capturedUpdatePayload).not.toHaveProperty('net_balance')
        expect(capturedUpdatePayload).toHaveProperty('name', 'Updated Name')
    })

    it('does NOT include last_transaction_at in the Supabase .update() payload', async () => {
        const hook = useUpdateContact() as unknown as AnyHook
        await hook.mutationFn({
            id: 'contact-1',
            name: 'Updated',
            last_transaction_at: '2026-04-09T12:00:00Z',
        })

        expect(capturedUpdatePayload).not.toHaveProperty('last_transaction_at')
    })

    it('does NOT include transaction_count in the Supabase .update() payload', async () => {
        const hook = useUpdateContact() as unknown as AnyHook
        await hook.mutationFn({
            id: 'contact-1',
            phone: '1234567890',
            transaction_count: 42,
        })

        expect(capturedUpdatePayload).not.toHaveProperty('transaction_count')
        expect(capturedUpdatePayload).toHaveProperty('phone', '1234567890')
    })

    it('DOES include name, phone, type and other safe fields', async () => {
        const hook = useUpdateContact() as unknown as AnyHook
        await hook.mutationFn({
            id: 'contact-1',
            name: 'Alice',
            phone: '9876543210',
            type: 'SUPPLIER',
        })

        expect(capturedUpdatePayload).toEqual({
            name: 'Alice',
            phone: '9876543210',
            type: 'SUPPLIER',
        })
    })

    it('throws an error if the stripped payload is empty (nothing to update)', async () => {
        const hook = useUpdateContact() as unknown as AnyHook

        await expect(
            hook.mutationFn({
                id: 'contact-1',
                net_balance: 100 as Paise,
                last_transaction_at: '2026-01-01',
                transaction_count: 10,
            })
        ).rejects.toThrow('No updatable fields provided.')
    })

    it('invalidates [\"contacts\"] and [\"personal-people\"] on success', () => {
        const hook = useUpdateContact() as unknown as AnyHook
        hook.onSuccess({ id: 'contact-1' })

        const invalidatedKeys = mockInvalidateQueries.mock.calls.map(
            (call: unknown[][]) => call[0]
        )

        expect(invalidatedKeys).toContainEqual({ queryKey: ['contacts'] })
        expect(invalidatedKeys).toContainEqual({ queryKey: ['personal-people'] })
    })
})

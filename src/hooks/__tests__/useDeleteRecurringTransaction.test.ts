import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — vi.hoisted() ensures these exist before vi.mock factories run
// ─────────────────────────────────────────────────────────────────────────────

const {
    mockEq, mockDelete, mockFrom, mockGetUser, mockInvalidateQueries,
} = vi.hoisted(() => {
    const mockEq = vi.fn()
    const mockDelete = vi.fn(() => ({ eq: mockEq }))
    const mockFrom = vi.fn(() => ({ delete: mockDelete }))
    const mockGetUser = vi.fn()
    const mockInvalidateQueries = vi.fn()
    return { mockEq, mockDelete, mockFrom, mockGetUser, mockInvalidateQueries }
})

let mockUser: { id: string } | null = { id: 'user-789' }

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: mockFrom,
        auth: { getUser: mockGetUser },
    }),
}))

let capturedMutationConfig: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

vi.mock('@tanstack/react-query', () => ({
    useMutation: (config: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        capturedMutationConfig = config
        return { mutate: vi.fn(), mutateAsync: vi.fn() }
    },
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}))

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}))

import { useDeleteRecurringTransaction } from '../useDeleteRecurringTransaction'

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('useDeleteRecurringTransaction — auth gate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser = { id: 'user-789' }
        mockEq.mockResolvedValue({ error: null })
        mockGetUser.mockImplementation(() =>
            Promise.resolve({ data: { user: mockUser }, error: null })
        )
        useDeleteRecurringTransaction() // capture config
    })

    it('throws if user is not authenticated', async () => {
        mockUser = null

        await expect(
            capturedMutationConfig.mutationFn('recurring-123')
        ).rejects.toThrow('User not authenticated')

        // Delete should never be called when unauthenticated
        expect(mockDelete).not.toHaveBeenCalled()
    })

    it('proceeds with delete when user is authenticated', async () => {
        await capturedMutationConfig.mutationFn('recurring-456')

        expect(mockGetUser).toHaveBeenCalled()
        expect(mockFrom).toHaveBeenCalledWith('recurring_transactions')
        expect(mockDelete).toHaveBeenCalled()
        expect(mockEq).toHaveBeenCalledWith('id', 'recurring-456')
    })

    it('invalidates ["recurring-transactions"] on success', () => {
        // Simulate the onSuccess callback
        capturedMutationConfig.onSuccess()

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ['recurring-transactions'],
        })
    })
})

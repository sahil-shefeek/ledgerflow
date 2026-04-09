import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — vi.hoisted() ensures these exist before vi.mock factories run
// ─────────────────────────────────────────────────────────────────────────────

const {
    mockInsert, mockFrom, mockGetUser, mockToast, rupeesToPaiseSpy,
} = vi.hoisted(() => {
    const mockInsert = vi.fn()
    const mockFrom = vi.fn((): Record<string, any> => ({ insert: mockInsert })) // eslint-disable-line @typescript-eslint/no-explicit-any
    const mockGetUser = vi.fn()
    const mockToast = { success: vi.fn(), error: vi.fn() }
    const rupeesToPaiseSpy = vi.fn((r: number) => r * 100)
    return { mockInsert, mockFrom, mockGetUser, mockToast, rupeesToPaiseSpy }
})

let mockUser: { id: string } | null = { id: 'user-123' }

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: mockFrom,
        auth: { getUser: mockGetUser },
    }),
}))

// Track the actual mutation config so we can call mutationFn directly
let capturedMutationConfig: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

vi.mock('@tanstack/react-query', () => ({
    useMutation: (config: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        capturedMutationConfig = config
        return { mutate: vi.fn(), mutateAsync: vi.fn() }
    },
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
}))

vi.mock('sonner', () => ({ toast: mockToast }))

vi.mock('@/lib/currency', () => ({
    rupeesToPaise: (r: number) => rupeesToPaiseSpy(r),
}))

import { useAddRecurringTransaction } from '../useAddRecurringTransaction'

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('useAddRecurringTransaction — type safety', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser = { id: 'user-123' }
        mockInsert.mockResolvedValue({ error: null })
        mockGetUser.mockImplementation(() =>
            Promise.resolve({ data: { user: mockUser }, error: null })
        )
        useAddRecurringTransaction() // capture config
    })

    it('converts amount from rupees to paise before insert', async () => {
        await capturedMutationConfig.mutationFn({
            name: 'Netflix',
            amount: 199,
            flow: 'OUT',
            frequency: 'MONTHLY',
            start_date: '2026-04-01',
            next_run_date: '2026-05-01',
        })

        expect(rupeesToPaiseSpy).toHaveBeenCalledWith(199)

        // Verify the insert was called with the paise value (199 * 100 = 19900)
        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 19900 })
        )
    })

    it('sets user_id from auth.getUser(), not from caller params', async () => {
        await capturedMutationConfig.mutationFn({
            name: 'Spotify',
            amount: 119,
            flow: 'OUT',
            frequency: 'MONTHLY',
            start_date: '2026-04-01',
            next_run_date: '2026-05-01',
        })

        expect(mockGetUser).toHaveBeenCalled()
        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: 'user-123' })
        )
    })

    it('calls toast.error on DB failure', async () => {
        mockInsert.mockResolvedValue({ error: { message: 'DB error' } })

        await expect(
            capturedMutationConfig.mutationFn({
                name: 'Broken',
                amount: 50,
                flow: 'OUT',
                frequency: 'DAILY',
                start_date: '2026-04-01',
                next_run_date: '2026-04-02',
            })
        ).rejects.toThrow()

        // The onError callback would be called by React Query; verify it exists
        expect(capturedMutationConfig.onError).toBeDefined()

        // Simulate the onError callback
        capturedMutationConfig.onError(new Error('DB error'))
        expect(mockToast.error).toHaveBeenCalledWith('Failed to create: DB error')
    })

    it('throws if user is not authenticated', async () => {
        mockUser = null

        await expect(
            capturedMutationConfig.mutationFn({
                name: 'Unauthorized',
                amount: 100,
                flow: 'OUT',
                frequency: 'MONTHLY',
                start_date: '2026-04-01',
                next_run_date: '2026-05-01',
            })
        ).rejects.toThrow('User not authenticated')

        // Insert should never be called
        expect(mockInsert).not.toHaveBeenCalled()
    })
})

describe('useDeleteContact — auth gate', () => {
    // These tests need a separate mock setup for delete operations
    const mockDelete = vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
    }))

    beforeEach(() => {
        vi.clearAllMocks()
        mockUser = { id: 'user-123' }
        mockGetUser.mockImplementation(() =>
            Promise.resolve({ data: { user: mockUser }, error: null })
        )
        mockFrom.mockReturnValue({ delete: mockDelete })
    })

    it('throws "User not authenticated" if getUser() returns null', async () => {
        mockUser = null

        // Re-import to pick up the delete-oriented mock
        const { useDeleteContact } = await import('../useDeleteContact')

        // Need to re-mock useMutation for this describe block
        useDeleteContact()

        await expect(
            capturedMutationConfig.mutationFn('contact-456')
        ).rejects.toThrow('User not authenticated')

        expect(mockDelete).not.toHaveBeenCalled()
    })

    it('calls supabase.from("contacts").delete() only when user is present', async () => {
        const { useDeleteContact } = await import('../useDeleteContact')
        useDeleteContact()

        await capturedMutationConfig.mutationFn('contact-456')

        expect(mockGetUser).toHaveBeenCalled()
        expect(mockFrom).toHaveBeenCalledWith('contacts')
        expect(mockDelete).toHaveBeenCalled()
    })
})

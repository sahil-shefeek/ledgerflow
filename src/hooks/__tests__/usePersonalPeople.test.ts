import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// Track all chained query builder calls
let capturedGteArgs: [string, string][] = []
let capturedOrderArgs: [string, { ascending: boolean }][] = []

const mockQuery = vi.fn()

// Build a chainable mock that records .gte() and .order() calls
function createChainableMock(resolvedData: unknown[] = []) {
    capturedGteArgs = []
    capturedOrderArgs = []

    const chain: Record<string, any> = {} // eslint-disable-line @typescript-eslint/no-explicit-any

    chain.select = vi.fn(() => chain)
    chain.is = vi.fn(() => chain)
    chain.gte = vi.fn((col: string, val: string) => {
        capturedGteArgs.push([col, val])
        return chain
    })
    chain.order = vi.fn((col: string, opts: { ascending: boolean }) => {
        capturedOrderArgs.push([col, opts])
        return chain
    })

    // Intercept the final await by making the chain thenable
    chain.then = (resolve: (v: unknown) => void) => {
        resolve({ data: resolvedData, error: null })
    }

    return chain
}

let chainableMock: ReturnType<typeof createChainableMock>

const mockFrom = vi.fn(() => chainableMock)

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        from: mockFrom,
    }),
}))

vi.mock('@tanstack/react-query', () => ({
    useQuery: (config: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
            queryKey: config.queryKey,
            queryFn: config.queryFn,
            _config: config,
        }
    },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHook = Record<string, any>

import { usePersonalPeople } from '../personal/usePersonalPeople'

describe('usePersonalPeople — server-side filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        chainableMock = createChainableMock([])
    })

    it('when timeFilter is ALL, does NOT add a .gte() call to the query', async () => {
        const hook = usePersonalPeople({ timeFilter: 'ALL' }) as unknown as AnyHook
        await hook.queryFn()

        expect(chainableMock.gte).not.toHaveBeenCalled()
    })

    it('when timeFilter is TODAY, adds .gte(\"last_transaction_at\", <start of today ISO>)', async () => {
        const hook = usePersonalPeople({ timeFilter: 'TODAY' }) as unknown as AnyHook
        await hook.queryFn()

        expect(chainableMock.gte).toHaveBeenCalledTimes(1)
        const [col, val] = capturedGteArgs[0]
        expect(col).toBe('last_transaction_at')

        // Verify the ISO string is a start-of-day (hours, minutes, seconds should be 0 in local TZ)
        const dateArg = new Date(val)
        expect(dateArg.getHours()).toBe(0)
        expect(dateArg.getMinutes()).toBe(0)
        expect(dateArg.getSeconds()).toBe(0)
    })

    it('when timeFilter is MONTH, adds .gte(\"last_transaction_at\", <start of month ISO>)', async () => {
        const hook = usePersonalPeople({ timeFilter: 'MONTH' }) as unknown as AnyHook
        await hook.queryFn()

        expect(chainableMock.gte).toHaveBeenCalledTimes(1)
        const [col, val] = capturedGteArgs[0]
        expect(col).toBe('last_transaction_at')

        // Verify the date is the 1st of the current month
        const dateArg = new Date(val)
        expect(dateArg.getDate()).toBe(1)
    })

    it('does NOT call Array.prototype.filter on the returned data', async () => {
        // Seed the mock with data that WOULD be filtered by the old code
        chainableMock = createChainableMock([
            { id: 'c1', last_transaction_at: '2020-01-01T00:00:00Z' },
            { id: 'c2', last_transaction_at: '2026-04-09T00:00:00Z' },
        ])

        const hook = usePersonalPeople({ timeFilter: 'MONTH' }) as unknown as AnyHook
        const result = await hook.queryFn()

        // If client-side filtering existed, old data would be filtered out.
        // With DB-level filtering, the mock returns whatever the DB gives us directly.
        // The mock returns both items unfiltered because the DB mock doesn't actually filter.
        // The important assertion: no JS .filter() is applied post-fetch.
        expect(result).toHaveLength(2)
    })

    it('applies sort via .order() on the query builder, not post-fetch', async () => {
        const hookLatest = usePersonalPeople({ sortBy: 'LATEST' }) as unknown as AnyHook
        await hookLatest.queryFn()

        expect(chainableMock.order).toHaveBeenCalledWith(
            'last_transaction_at',
            { ascending: false }
        )

        // Reset and test MOST_ACTIVE
        chainableMock = createChainableMock([])
        const hookActive = usePersonalPeople({ sortBy: 'MOST_ACTIVE' }) as unknown as AnyHook
        await hookActive.queryFn()

        expect(chainableMock.order).toHaveBeenCalledWith(
            'transaction_count',
            { ascending: false }
        )
    })
})

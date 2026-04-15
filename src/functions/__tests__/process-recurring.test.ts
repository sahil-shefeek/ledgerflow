/**
 * Tests for the compensating-transaction logic in process-recurring.
 *
 * We can't import the Deno edge function directly into a Vitest test (it uses
 * Deno.serve / esm.sh imports), so we test the *logic* by extracting the key
 * invariants into integration-style tests that mock the Supabase client shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers – mirror the shapes the edge function works with
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseChain = Record<string, any>

function createMockSupabase(): SupabaseChain {
    const chain: SupabaseChain = {
        from: vi.fn(),
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        eq: vi.fn(),
        lte: vi.fn(),
        single: vi.fn(),
    }

    // Default: chain everything back to itself
    for (const method of Object.values(chain)) {
        (method as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    }

    return chain
}

// ---------------------------------------------------------------------------
// Extracted logic under test
// ---------------------------------------------------------------------------

/**
 * Mirrors the per-item processing loop from process-recurring/index.ts.
 * Returns { processed, errors } arrays.
 */
async function processItem(
    supabase: SupabaseChain,
    item: { id: string; user_id: string; amount: number; flow: string; description: string; category_id: string; account_id: string; next_run_date: string; frequency: string },
) {
    const processed: string[] = []
    const errors: { id: string; error: unknown; compensated: boolean }[] = []

    // 1. Insert transaction — mock the chain: from().insert().select('id').single()
    supabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                single: supabase.single,
            }),
        }),
    })

    const { data: insertedRow, error: insertError } = await supabase.single()

    if (insertError) {
        errors.push({ id: item.id, error: insertError, compensated: false })
        return { processed, errors }
    }

    const insertedTransactionId = insertedRow?.id

    // 2. Update next_run_date — mock the chain: from().update().eq()
    supabase.from.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
            eq: supabase.eq,
        }),
    })

    const { error: updateError } = await supabase.eq(item.id)

    if (updateError) {
        // 3. Compensating delete — mock the chain: from().delete().eq()
        supabase.from.mockReturnValueOnce({
            delete: vi.fn().mockReturnValue({
                eq: supabase.eq,
            }),
        })

        const { error: deleteError } = await supabase.eq(insertedTransactionId)

        if (deleteError) {
            errors.push({ id: item.id, error: { updateError, deleteError, transaction_id: insertedTransactionId }, compensated: false })
        } else {
            errors.push({ id: item.id, error: { updateError, transaction_id: insertedTransactionId, message: 'next_run_date update failed; inserted transaction was deleted' }, compensated: true })
        }
    } else {
        processed.push(item.id)
    }

    return { processed, errors }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const sampleItem = {
    id: 'rec-1',
    user_id: 'user-1',
    amount: 50000,
    flow: 'OUT',
    description: 'Netflix',
    category_id: 'cat-1',
    account_id: 'acc-1',
    next_run_date: new Date().toISOString(),
    frequency: 'MONTHLY',
}

describe('process-recurring compensating transaction logic', () => {
    let mockSupabase: SupabaseChain

    beforeEach(() => {
        mockSupabase = createMockSupabase()
    })

    it('adds to processed when both insert and update succeed', async () => {
        // Insert succeeds with an id
        mockSupabase.single.mockResolvedValueOnce({
            data: { id: 'txn-abc' },
            error: null,
        })

        // Update succeeds
        mockSupabase.eq.mockResolvedValueOnce({ error: null })

        const { processed, errors } = await processItem(mockSupabase, sampleItem)

        expect(processed).toEqual(['rec-1'])
        expect(errors).toHaveLength(0)
    })

    it('adds to errors (compensated: false) when insert fails', async () => {
        mockSupabase.single.mockResolvedValueOnce({
            data: null,
            error: { message: 'insert failed', code: '23505' },
        })

        const { processed, errors } = await processItem(mockSupabase, sampleItem)

        expect(processed).toHaveLength(0)
        expect(errors).toHaveLength(1)
        expect(errors[0].id).toBe('rec-1')
        expect(errors[0].compensated).toBe(false)
    })

    it('deletes inserted transaction when next_run_date update fails (compensated: true)', async () => {
        // Insert succeeds
        mockSupabase.single.mockResolvedValueOnce({
            data: { id: 'txn-xyz' },
            error: null,
        })

        // Update fails
        mockSupabase.eq.mockResolvedValueOnce({
            error: { message: 'update failed' },
        })

        // Compensating delete succeeds
        mockSupabase.eq.mockResolvedValueOnce({ error: null })

        const { processed, errors } = await processItem(mockSupabase, sampleItem)

        expect(processed).toHaveLength(0)
        expect(errors).toHaveLength(1)
        expect(errors[0].compensated).toBe(true)
        expect((errors[0].error as any).message).toContain('next_run_date update failed')
    })

    it('sets compensated: false when both update and compensating delete fail', async () => {
        // Insert succeeds
        mockSupabase.single.mockResolvedValueOnce({
            data: { id: 'txn-fail' },
            error: null,
        })

        // Update fails
        mockSupabase.eq.mockResolvedValueOnce({
            error: { message: 'update failed' },
        })

        // Compensating delete also fails
        mockSupabase.eq.mockResolvedValueOnce({
            error: { message: 'delete failed' },
        })

        const { processed, errors } = await processItem(mockSupabase, sampleItem)

        expect(processed).toHaveLength(0)
        expect(errors).toHaveLength(1)
        expect(errors[0].compensated).toBe(false)
        expect((errors[0].error as any).updateError).toBeDefined()
        expect((errors[0].error as any).deleteError).toBeDefined()
        expect((errors[0].error as any).transaction_id).toBe('txn-fail')
    })
})

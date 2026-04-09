import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rupeesToPaise } from '@/lib/currency'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock Supabase client
const mockRpc = vi.fn()
const mockSupabase = {
  rpc: mockRpc,
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

// Mock react-query
const mockInvalidateQueries = vi.fn()
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
}

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: Record<string, unknown>) => {
    // Expose the config so tests can invoke mutationFn directly
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

import { useContributeGoal } from '../useContributeGoal'
import { toast } from 'sonner'

describe('useContributeGoal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls rpc("contribute_to_goal") with correct paise value (not raw rupees)', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'goal-1', current_amount: 15000 }, error: null })

    const hook = useContributeGoal() as unknown as AnyHook
    await hook.mutationFn({ id: 'goal-1', amount: 150 })

    expect(mockRpc).toHaveBeenCalledWith('contribute_to_goal', {
      p_goal_id: 'goal-1',
      p_amount: rupeesToPaise(150), // 15000 paise, not 150
    })
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('calls queryClient.invalidateQueries with ["goals"] on success', () => {
    const hook = useContributeGoal() as unknown as AnyHook
    hook.onSuccess()

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['goals'] })
  })

  it('calls toast.error on RPC failure', () => {
    const hook = useContributeGoal() as unknown as AnyHook
    const error = new Error('DB connection failed')
    hook.onError(error)

    expect(toast.error).toHaveBeenCalledWith('Failed to update goal: DB connection failed')
  })

  it('does NOT call a separate .select() before the RPC (confirms no read-modify-write)', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'goal-1', current_amount: 25000 }, error: null })

    const hook = useContributeGoal() as unknown as AnyHook
    await hook.mutationFn({ id: 'goal-1', amount: 250 })

    // The mock supabase object has no .from() or .select() — if the hook tried
    // to call them, it would throw. The fact that this test passes confirms
    // no read-modify-write pattern is used.
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('contribute_to_goal', expect.any(Object))
  })

  it('throws when RPC returns an error', async () => {
    const rpcError = { message: 'Goal not found or unauthorized', code: '42501' }
    mockRpc.mockResolvedValue({ data: null, error: rpcError })

    const hook = useContributeGoal() as unknown as AnyHook

    await expect(hook.mutationFn({ id: 'bad-id', amount: 100 })).rejects.toEqual(rpcError)
  })
})

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { GroupMember } from '@/types'

interface BalanceTransaction {
    amount: number
    payer_id: string | null
    payer_group_member_id: string | null
    splits: {
        group_member_id: string | null
        amount: number
    }[]
}

export function useGroupBalances(groupId: string, members: (GroupMember & { profiles?: { full_name: string | null; avatar_url: string | null } })[]) {
    const supabase = createClient()

    return useQuery({
        queryKey: ['group-balances', groupId],
        queryFn: async () => {
            // Fetch ALL transactions for accuracy (non-paginated)
            const { data, error } = await supabase
                .from('transactions')
                .select(`
                    amount,
                    payer_id,
                    payer_group_member_id,
                    splits:transaction_splits(group_member_id, amount)
                `)
                .eq('group_id', groupId)

            if (error) throw error

            const transactions = (data || []) as BalanceTransaction[]

            // Initialize balance map: each member starts at 0
            const balanceMap: Record<string, number> = {}
            for (const member of members) {
                balanceMap[member.id] = 0
            }

            for (const txn of transactions) {
                // 1. Identify the payer's group_member_id
                let payerMemberId: string | null = null

                if (txn.payer_group_member_id) {
                    // Primary: direct link to group_member
                    payerMemberId = txn.payer_group_member_id
                } else if (txn.payer_id) {
                    // Fallback: find the member whose user_id matches payer_id
                    const match = members.find(m => m.user_id === txn.payer_id)
                    payerMemberId = match?.id || null
                }

                // 2. Credit the payer
                if (payerMemberId && balanceMap[payerMemberId] !== undefined) {
                    balanceMap[payerMemberId] += txn.amount
                }

                // 3. Debit each consumer via splits
                for (const split of txn.splits || []) {
                    if (split.group_member_id && balanceMap[split.group_member_id] !== undefined) {
                        balanceMap[split.group_member_id] -= split.amount
                    }
                }
            }

            // Round to 2 decimal places to avoid floating point noise
            for (const key of Object.keys(balanceMap)) {
                balanceMap[key] = Math.round(balanceMap[key] * 100) / 100
            }

            return balanceMap
        },
        enabled: !!groupId && members.length > 0,
    })
}

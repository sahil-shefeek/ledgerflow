import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Contact } from '@/types'

type UpdateContactParams = Partial<Contact> & { id: string }

export function useUpdateContact() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (params: UpdateContactParams) => {
            const {
                id,
                // Strip ALL trigger-managed and system fields — these must never be
                // written from the client. They are owned by Postgres triggers.
                net_balance: _net_balance,
                last_transaction_at: _last_transaction_at,
                transaction_count: _transaction_count,
                // Also strip relational/computed fields that don't exist as DB columns
                ...safeUpdates
            } = params

            if (Object.keys(safeUpdates).length === 0) {
                throw new Error('No updatable fields provided.')
            }

            const { data, error } = await supabase
                .from('contacts')
                .update(safeUpdates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: (data) => {
            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })

            // Invalidate specific contact detail
            queryClient.invalidateQueries({ queryKey: ['contact', data.id] })

            toast.success('Contact updated successfully')
        },
        onError: (error) => {
            toast.error(`Failed to update contact: ${error.message}`)
        },
    })
}

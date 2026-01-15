import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/useAppStore'
import { toast } from 'sonner'
import { startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns'

export interface Contact {
    id: string
    name: string
    phone: string | null
    type: 'CUSTOMER' | 'SUPPLIER' | 'OTHER'
    net_balance: number
    last_transaction_at: string
    business_id: string | null
    image_url: string | null
    transaction_count: number
}

export function useContacts() {
    const supabase = createClient()
    const { currentBusinessId } = useAppStore()

    return useQuery({
        queryKey: ['contacts', currentBusinessId],
        queryFn: async () => {
            if (!currentBusinessId) return []

            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('business_id', currentBusinessId)
                .order('last_transaction_at', { ascending: false })

            if (error) throw error
            return data as Contact[]
        },
        enabled: !!currentBusinessId,
    })
}

interface PersonalPeopleFilters {
    sortBy?: 'LATEST' | 'MOST_ACTIVE'
    timeFilter?: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'
}

export function usePersonalPeople(filters: PersonalPeopleFilters = {}) {
    const supabase = createClient()

    return useQuery({
        queryKey: ['personal-people', filters],
        queryFn: async () => {
            let query = supabase
                .from('contacts')
                .select('*')
                .is('business_id', null)

            // Apply Sort
            if (filters.sortBy === 'MOST_ACTIVE') {
                query = query.order('transaction_count', { ascending: false })
            } else {
                query = query.order('last_transaction_at', { ascending: false })
            }

            const { data, error } = await query

            if (error) throw error

            // Apply Time Filter strictly in JS if needed, or we can rely on last_transaction_at if that's what "Active" means.
            // The user requirement says: "The 'Today', 'This Week', etc., filters ... should filter the list based on last_transaction_at"
            // Since we are fetching all personal contacts (likely small list), we can filter in memory or add where clause.
            // Adding where clause is better if list grows, but `last_transaction_at` might be null.

            let result = data as Contact[]

            if (filters.timeFilter && filters.timeFilter !== 'ALL') {
                const now = new Date()
                let startDate: Date

                switch (filters.timeFilter) {
                    case 'TODAY': startDate = startOfDay(now); break;
                    case 'WEEK': startDate = startOfWeek(now); break;
                    case 'MONTH': startDate = startOfMonth(now); break;
                    case 'YEAR': startDate = startOfYear(now); break;
                }

                result = result.filter(c => c.last_transaction_at && new Date(c.last_transaction_at) >= startDate)
            }

            return result
        }
    })
}

export function useAddContact() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { currentBusinessId, mode } = useAppStore()

    return useMutation({
        mutationFn: async (newContact: { name: string; phone?: string; type: Contact['type']; image_url?: string; business_id?: string | null }) => {
            // Determine business_id based on mode if not explicitly provided
            let businessIdToUse = newContact.business_id

            if (businessIdToUse === undefined) {
                if (mode === 'business') {
                    if (!currentBusinessId) throw new Error('No business selected')
                    businessIdToUse = currentBusinessId
                } else {
                    businessIdToUse = null
                }
            }

            const { data, error } = await supabase
                .from('contacts')
                .insert({
                    name: newContact.name,
                    phone: newContact.phone,
                    type: newContact.type,
                    image_url: newContact.image_url,
                    user_id: (await supabase.auth.getUser()).data.user?.id,
                    business_id: businessIdToUse,
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] })
            queryClient.invalidateQueries({ queryKey: ['personal-people'] })
            toast.success('Contact added')
        },
        onError: (error) => {
            toast.error(`Failed to add contact: ${error.message}`)
        },
    })
}

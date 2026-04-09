import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Contact } from '@/types'
import { startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns'

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

            // Apply time filter at the DB level — do NOT fetch all rows then discard
            if (filters.timeFilter && filters.timeFilter !== 'ALL') {
                const now = new Date()
                let startDate: Date

                switch (filters.timeFilter) {
                    case 'TODAY':   startDate = startOfDay(now);   break
                    case 'WEEK':    startDate = startOfWeek(now);  break
                    case 'MONTH':   startDate = startOfMonth(now); break
                    case 'YEAR':    startDate = startOfYear(now);  break
                    default:        startDate = startOfDay(now)
                }

                query = query.gte('last_transaction_at', startDate.toISOString())
            }

            // Apply sort at the DB level
            if (filters.sortBy === 'MOST_ACTIVE') {
                query = query.order('transaction_count', { ascending: false })
            } else {
                query = query.order('last_transaction_at', { ascending: false })
            }

            const { data, error } = await query
            if (error) throw error

            return data as Contact[]
        }
    })
}

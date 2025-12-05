import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get due recurring transactions
        const { data: recurring, error: fetchError } = await supabaseClient
            .from('recurring_transactions')
            .select('*')
            .lte('next_run_date', new Date().toISOString())
            .eq('active', true)

        if (fetchError) throw fetchError

        if (!recurring || recurring.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No recurring transactions due' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                }
            )
        }

        const processed = []
        const errors = []

        // 2. Process each transaction
        for (const item of recurring) {
            // Insert into transactions
            const { error: insertError } = await supabaseClient
                .from('transactions')
                .insert({
                    user_id: item.user_id,
                    amount: item.amount,
                    flow: item.flow || 'OUT',
                    mode: 'PERSONAL',
                    description: item.description,
                    category_id: item.category_id,
                    account_id: item.account_id,
                    date: new Date().toISOString(),
                })

            if (insertError) {
                errors.push({ id: item.id, error: insertError })
                continue
            }

            // Calculate next run date
            let nextDate = new Date(item.next_run_date)
            switch (item.frequency) {
                case 'DAILY':
                    nextDate.setDate(nextDate.getDate() + 1)
                    break
                case 'WEEKLY':
                    nextDate.setDate(nextDate.getDate() + 7)
                    break
                case 'MONTHLY':
                    nextDate.setMonth(nextDate.getMonth() + 1)
                    break
                case 'YEARLY':
                    nextDate.setFullYear(nextDate.getFullYear() + 1)
                    break
            }

            // Update recurring transaction
            const { error: updateError } = await supabaseClient
                .from('recurring_transactions')
                .update({
                    last_run_date: new Date().toISOString(),
                    next_run_date: nextDate.toISOString(),
                })
                .eq('id', item.id)

            if (updateError) {
                errors.push({ id: item.id, error: updateError })
            } else {
                processed.push(item.id)
            }
        }

        return new Response(
            JSON.stringify({ processed, errors }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})

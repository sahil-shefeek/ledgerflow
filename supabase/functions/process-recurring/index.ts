import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('SUPABASE_URL') ?? '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST' && req.method !== 'OPTIONS') {
        return new Response('Method Not Allowed', { status: 405 })
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

        const processed: string[] = []
        const errors: { id: string; error: unknown; compensated: boolean }[] = []

        // 2. Process each transaction
        for (const item of recurring) {
            // Insert into transactions — capture the ID for potential rollback
            const { data: insertedRow, error: insertError } = await supabaseClient
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
                .select('id')
                .single()

            if (insertError) {
                errors.push({ id: item.id, error: insertError, compensated: false })
                continue
            }

            const insertedTransactionId = insertedRow.id

            // Calculate next run date
            const nextDate = new Date(item.next_run_date)
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

            // Update recurring transaction with new next_run_date
            const { error: updateError } = await supabaseClient
                .from('recurring_transactions')
                .update({
                    last_run_date: new Date().toISOString(),
                    next_run_date: nextDate.toISOString(),
                })
                .eq('id', item.id)

            if (updateError) {
                // Compensating transaction: delete the inserted transaction to prevent double-fire
                const { error: deleteError } = await supabaseClient
                    .from('transactions')
                    .delete()
                    .eq('id', insertedTransactionId)

                if (deleteError) {
                    // Both update and compensating delete failed — log full detail for manual remediation
                    console.error(
                        `CRITICAL: Double-fire not prevented for recurring_id=${item.id}, ` +
                        `transaction_id=${insertedTransactionId}. ` +
                        `Update error: ${JSON.stringify(updateError)}, ` +
                        `Delete error: ${JSON.stringify(deleteError)}`
                    )
                    errors.push({
                        id: item.id,
                        error: {
                            updateError,
                            deleteError,
                            transaction_id: insertedTransactionId,
                        },
                        compensated: false,
                    })
                } else {
                    // Compensating delete succeeded — transaction was rolled back
                    errors.push({
                        id: item.id,
                        error: {
                            updateError,
                            transaction_id: insertedTransactionId,
                            message: 'next_run_date update failed; inserted transaction was deleted',
                        },
                        compensated: true,
                    })
                }
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
            JSON.stringify({ error: (error as Error).message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})

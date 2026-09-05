import { z } from 'zod'

export const splitExpenseStep1Schema = z.object({
    amount: z.number().positive('Please enter a valid amount'),
    name: z.string().trim().min(1, 'Please enter a description'),
    accountId: z.string().min(1, 'Please select an account'),
})

export type SplitExpenseStep1Input = z.infer<typeof splitExpenseStep1Schema>

export const splitExpenseSchema = z.object({
    splitType: z.enum(['EQUALLY', 'BY_AMOUNT', 'BY_PERCENTAGE', 'FRACTIONAL']),
    shares: z.record(z.string(), z.number()),
    selectedMembers: z.array(z.string()),
    totalAmount: z.number().positive('Please enter a valid amount'),
}).superRefine((data, ctx) => {
    const hasNegative = Object.values(data.shares).some(val => (val || 0) < 0)
    if (hasNegative) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Split amounts cannot be negative' })
        return
    }

    const total = Object.values(data.shares).reduce((sum, val) => sum + (val || 0), 0)

    if (data.splitType === 'EQUALLY') {
        if (data.selectedMembers.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'You must select at least one member to split equally' })
        }
        // If frontend provides computed shares for EQUALLY, ensure they sum exactly to totalAmount in cents
        if (Object.keys(data.shares).length > 0 && Math.round(total * 100) !== Math.round(data.totalAmount * 100)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Equal amounts must sum exactly to the total expense amount' })
        }
    } else if (data.splitType === 'BY_AMOUNT') {
        if (Math.round(total * 100) !== Math.round(data.totalAmount * 100)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Custom amounts must sum exactly to the total expense amount' })
        }
    } else if (data.splitType === 'BY_PERCENTAGE') {
        if (Math.round(total * 100) !== 10000) { // 100.00%
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Percentages must add up to exactly 100%' })
        }
    } else if (data.splitType === 'FRACTIONAL') {
        if (total === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Total fractions must be greater than 0' })
        }
    }
})

export type SplitExpenseInput = z.infer<typeof splitExpenseSchema>

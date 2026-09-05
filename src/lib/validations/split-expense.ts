import { z } from 'zod'

export const splitExpenseStep1Schema = z.object({
    amount: z.number().positive('Please enter a valid amount'),
    name: z.string().trim().min(1, 'Please enter a description'),
    accountId: z.string().min(1, 'Please select an account'),
})

export type SplitExpenseStep1Input = z.infer<typeof splitExpenseStep1Schema>

export const splitExpenseSchema = z.object({
    splitType: z.enum(['EQUALLY', 'BY_AMOUNT', 'BY_PERCENTAGE']),
    shares: z.record(z.string(), z.number()),
    selectedMembers: z.array(z.string()),
    totalAmount: z.number().positive('Please enter a valid amount'),
}).superRefine((data, ctx) => {
    const hasNegative = Object.values(data.shares).some(val => (val || 0) < 0)
    if (hasNegative) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Split amounts cannot be negative' })
        return
    }

    if (data.splitType === 'EQUALLY' && data.selectedMembers.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'You must select at least one member to split equally' })
    } else if (data.splitType === 'BY_AMOUNT') {
        const total = Object.values(data.shares).reduce((sum, val) => sum + (val || 0), 0)
        if (Math.abs(data.totalAmount - total) > 0.01) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Custom amounts must sum to the total expense amount' })
        }
    } else if (data.splitType === 'BY_PERCENTAGE') {
        const total = Object.values(data.shares).reduce((sum, val) => sum + (val || 0), 0)
        if (Math.abs(100 - total) > 0.01) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Percentages must add up to exactly 100%' })
        }
    }
})

export type SplitExpenseInput = z.infer<typeof splitExpenseSchema>

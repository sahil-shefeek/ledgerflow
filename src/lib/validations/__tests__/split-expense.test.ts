import { describe, it, expect } from 'vitest'
import { splitExpenseSchema, splitExpenseStep1Schema } from '../split-expense'

describe('splitExpenseStep1Schema', () => {
    it('accepts valid step 1 data', () => {
        const result = splitExpenseStep1Schema.safeParse({
            amount: 100,
            name: 'Dinner',
            accountId: 'acc_123',
        })
        expect(result.success).toBe(true)
    })

    it('rejects zero amount', () => {
        const result = splitExpenseStep1Schema.safeParse({
            amount: 0,
            name: 'Dinner',
            accountId: 'acc_123',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Please enter a valid amount')
        }
    })

    it('rejects negative amount', () => {
        const result = splitExpenseStep1Schema.safeParse({
            amount: -50,
            name: 'Dinner',
            accountId: 'acc_123',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Please enter a valid amount')
        }
    })

    it('rejects empty or whitespace-only name', () => {
        const result = splitExpenseStep1Schema.safeParse({
            amount: 100,
            name: '   ',
            accountId: 'acc_123',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Please enter a description')
        }
    })

    it('rejects missing account id', () => {
        const result = splitExpenseStep1Schema.safeParse({
            amount: 100,
            name: 'Dinner',
            accountId: '',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Please select an account')
        }
    })
})

describe('splitExpenseSchema', () => {
    const parseSplit = (
        splitType: 'EQUALLY' | 'BY_AMOUNT' | 'BY_PERCENTAGE' | 'FRACTIONAL',
        shares: Record<string, number>,
        selectedMembers: string[] = ['user_1', 'user_2'],
        totalAmount: number = 100
    ) => splitExpenseSchema.safeParse({ splitType, shares, selectedMembers, totalAmount })

    describe('EQUALLY split', () => {
        it('accepts equal split with selected members', () => {
            const result = parseSplit('EQUALLY', {})
            expect(result.success).toBe(true)
        })

        it('rejects equal split when no members are selected', () => {
            const result = parseSplit('EQUALLY', {}, [])
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('You must select at least one member to split equally')
            }
        })
        
        it('rejects equal split when provided shares do not sum to total', () => {
            const result = parseSplit('EQUALLY', { user_1: 40, user_2: 40 })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Equal amounts must sum exactly to the total expense amount')
            }
        })
    })

    describe('BY_AMOUNT split', () => {
        it('accepts exact amounts that sum to total', () => {
            const result = parseSplit('BY_AMOUNT', { user_1: 60, user_2: 40 })
            expect(result.success).toBe(true)
        })

        it('rejects custom amounts that sum to less than total', () => {
            const result = parseSplit('BY_AMOUNT', { user_1: 60, user_2: 30 })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Custom amounts must sum exactly to the total expense amount')
            }
        })

        it('rejects custom amounts that sum to more than total', () => {
            const result = parseSplit('BY_AMOUNT', { user_1: 60, user_2: 50 })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Custom amounts must sum exactly to the total expense amount')
            }
        })

        it('rejects negative custom amounts', () => {
            const result = parseSplit('BY_AMOUNT', { user_1: 110, user_2: -10 })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Split amounts cannot be negative')
            }
        })

        it('accepts 0-value split edge case (one member owes 0, other owes full amount)', () => {
            const result = parseSplit('BY_AMOUNT', { user_1: 100, user_2: 0 })
            expect(result.success).toBe(true)
        })
    })

    describe('BY_PERCENTAGE split', () => {
        it('accepts percentages that sum to 100%', () => {
            const result = parseSplit('BY_PERCENTAGE', { user_1: 60, user_2: 40 })
            expect(result.success).toBe(true)
        })

        it('rejects percentages that sum to less than 100%', () => {
            const result = parseSplit('BY_PERCENTAGE', { user_1: 40, user_2: 50 })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Percentages must add up to exactly 100%')
            }
        })

        it('rejects percentages that sum to more than 100%', () => {
            const result = parseSplit('BY_PERCENTAGE', { user_1: 60, user_2: 50 })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Percentages must add up to exactly 100%')
            }
        })

        it('rejects negative percentages', () => {
            const result = parseSplit('BY_PERCENTAGE', { user_1: 110, user_2: -10 })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Split amounts cannot be negative')
            }
        })

        it('accepts 0-value percentage split edge case (100% and 0%)', () => {
            const result = parseSplit('BY_PERCENTAGE', { user_1: 100, user_2: 0 })
            expect(result.success).toBe(true)
        })
    })
    
    describe('FRACTIONAL split', () => {
        it('accepts valid fractional shares', () => {
            const result = parseSplit('FRACTIONAL', { user_1: 1, user_2: 2 })
            expect(result.success).toBe(true)
        })
        
        it('rejects 0 total fractions', () => {
            const result = parseSplit('FRACTIONAL', { user_1: 0, user_2: 0 })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Total fractions must be greater than 0')
            }
        })
    })
})

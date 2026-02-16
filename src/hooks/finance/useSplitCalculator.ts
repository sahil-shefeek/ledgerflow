import { useState, useMemo, useEffect } from 'react'
import { GroupMember } from '@/types'

export type SplitType = 'EQUALLY' | 'BY_AMOUNT' | 'BY_PERCENTAGE'

interface UseSplitCalculatorProps {
    totalAmount: number
    members: GroupMember[]
    currentUserId: string // To default the payer
}

interface Allocation {
    memberId: string
    amountOwed: number
    percent: number
}

interface SplitState {
    splitType: SplitType
    payerId: string
    shares: Record<string, number> // memberId -> value (amount or percentage)
    selectedMembers: string[] // IDs of members involved in EQUALLY split
}

export function useSplitCalculator({ totalAmount, members, currentUserId }: UseSplitCalculatorProps) {
    // Initial state
    const [state, setState] = useState<SplitState>({
        splitType: 'EQUALLY',
        payerId: currentUserId,
        shares: {},
        selectedMembers: members.map(m => m.id), // Default to all selected
    })

    // Reset shares when split type changes (optional, but good for UX to avoid stale data confusion)
    const setSplitType = (type: SplitType) => {
        setState(prev => ({ ...prev, splitType: type, shares: {} }))
    }

    const setPayerId = (id: string) => {
        setState(prev => ({ ...prev, payerId: id }))
    }

    const toggleMemberSelection = (memberId: string) => {
        setState(prev => {
            const isSelected = prev.selectedMembers.includes(memberId)
            const newSelected = isSelected
                ? prev.selectedMembers.filter(id => id !== memberId)
                : [...prev.selectedMembers, memberId]
            return { ...prev, selectedMembers: newSelected }
        })
    }

    const updateShare = (memberId: string, value: number) => {
        setState(prev => ({
            ...prev,
            shares: { ...prev.shares, [memberId]: value }
        }))
    }

    const calculation = useMemo(() => {
        const { splitType, shares, selectedMembers } = state
        let allocations: Allocation[] = []
        let isValid = false
        let remainder = 0
        let totalAllocated = 0

        if (totalAmount <= 0) {
            return { allocations: [], isValid: false, remainder: 0 }
        }

        if (splitType === 'EQUALLY') {
            if (selectedMembers.length === 0) {
                return { allocations: [], isValid: false, remainder: totalAmount }
            }

            const count = selectedMembers.length
            const rawShare = totalAmount / count
            // Round down to 2 decimals
            const share = Math.floor(rawShare * 100) / 100

            // Calculate remainder
            const allocatedSoFar = share * count
            const rawRemainder = totalAmount - allocatedSoFar
            // Fix floating point precision for remainder
            const pennyRemainder = Math.round(rawRemainder * 100) / 100

            allocations = members.map(member => {
                if (selectedMembers.includes(member.id)) {
                    return {
                        memberId: member.id,
                        amountOwed: share,
                        percent: (100 / count)
                    }
                }
                return { memberId: member.id, amountOwed: 0, percent: 0 }
            })

            // Distribute remainder to the first selected member (or random)
            // Ideally we distribute it to the payer if they are in the split, or just the first one.
            if (pennyRemainder > 0 && allocations.length > 0) {
                const luckyReceiverIndex = allocations.findIndex(a => selectedMembers.includes(a.memberId))
                if (luckyReceiverIndex !== -1) {
                    allocations[luckyReceiverIndex].amountOwed += pennyRemainder
                    // Re-fix precision just in case
                    allocations[luckyReceiverIndex].amountOwed = Math.round(allocations[luckyReceiverIndex].amountOwed * 100) / 100
                }
            }

            isValid = true
            remainder = 0

        } else if (splitType === 'BY_AMOUNT') {
            totalAllocated = Object.values(shares).reduce((sum, val) => sum + (val || 0), 0)
            remainder = totalAmount - totalAllocated

            // Allow small floating point margin of error? No, currency should be exact usually.
            // But let's handle JS math quirks.
            remainder = Math.round(remainder * 100) / 100

            isValid = Math.abs(remainder) < 0.01

            allocations = members.map(member => {
                const amount = shares[member.id] || 0
                return {
                    memberId: member.id,
                    amountOwed: amount,
                    percent: (amount / totalAmount) * 100
                }
            })

        } else if (splitType === 'BY_PERCENTAGE') {
            const totalPercent = Object.values(shares).reduce((sum, val) => sum + (val || 0), 0)

            // Valid if total percent is 100
            isValid = Math.abs(totalPercent - 100) < 0.01
            remainder = 100 - totalPercent // Remainder in percent

            allocations = members.map(member => {
                const percent = shares[member.id] || 0
                const amount = (totalAmount * percent) / 100
                return {
                    memberId: member.id,
                    amountOwed: Math.round(amount * 100) / 100,
                    percent: percent
                }
            })

            // Check if rounding caused total amount mismatch
            const totalCalculatedAmount = allocations.reduce((sum, a) => sum + a.amountOwed, 0)
            const amountDiff = totalAmount - totalCalculatedAmount

            // Distribute penny diff if valid
            if (isValid && Math.abs(amountDiff) > 0) {
                // Add to first person with > 0 share
                const idx = allocations.findIndex(a => a.amountOwed > 0)
                if (idx !== -1) {
                    allocations[idx].amountOwed += amountDiff
                    allocations[idx].amountOwed = Math.round(allocations[idx].amountOwed * 100) / 100
                }
            }
        }

        return { allocations, isValid, remainder }
    }, [state, totalAmount, members])

    return {
        ...state,
        setSplitType,
        setPayerId,
        toggleMemberSelection,
        updateShare,
        ...calculation
    }
}

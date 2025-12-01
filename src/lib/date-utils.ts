import { format, isToday, isYesterday } from 'date-fns'

export function formatTransactionDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date

    if (isToday(d)) {
        return format(d, 'h:mm a')
    }

    if (isYesterday(d)) {
        return `Yesterday, ${format(d, 'h:mm a')}`
    }

    return format(d, 'dd/MM/yyyy, h:mm a')
}

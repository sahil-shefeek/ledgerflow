'use client'

import { useContacts } from '@/hooks/useContacts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

export function BusinessSummary() {
    const { data: contacts, isLoading } = useContacts()

    const youWillGet = contacts
        ?.filter(c => c.net_balance > 0)
        .reduce((sum, c) => sum + c.net_balance, 0) || 0

    const youWillGive = contacts
        ?.filter(c => c.net_balance < 0)
        .reduce((sum, c) => sum + Math.abs(c.net_balance), 0) || 0

    if (isLoading) return null

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-green-600">
                        You will get
                    </CardTitle>
                    <ArrowDownLeft className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                        ₹{youWillGet.toLocaleString()}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-red-600">
                        You will give
                    </CardTitle>
                    <ArrowUpRight className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                        ₹{youWillGive.toLocaleString()}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

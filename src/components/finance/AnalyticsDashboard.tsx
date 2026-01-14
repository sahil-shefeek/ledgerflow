'use client'

import { useMonthlyCategorySpend } from '@/hooks/useAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Loader2 } from 'lucide-react'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export function AnalyticsDashboard() {
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1
    const currentYear = currentDate.getFullYear()

    const { data, isLoading, error } = useMonthlyCategorySpend(currentMonth, currentYear)

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-64 items-center justify-center text-destructive">
                Error loading analytics
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Spending by Category</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex h-64 items-center justify-center text-muted-foreground">
                        No spending data for this month.
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data as any[]} // eslint-disable-line @typescript-eslint/no-explicit-any
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                cornerRadius={5}
                                dataKey="total_spent"
                                nameKey="category_name"
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number | string | undefined) =>
                                    value !== undefined ? `₹${Number(value).toLocaleString()}` : '₹0'
                                }
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}

'use client'

import { useAppStore } from '@/store/useAppStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContactList } from '@/components/ledger/ContactList'
import { TransactionDrawer } from '@/components/ledger/TransactionDrawer'
import { AnalyticsDashboard } from '@/components/finance/AnalyticsDashboard'
import { BudgetCard } from '@/components/finance/BudgetCard'
import { GoalCard } from '@/components/finance/GoalCard'

export default function DashboardPage() {
    const { mode } = useAppStore()

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">
                {mode === 'business' ? 'Business Ledger' : 'Personal Finance'}
            </h1>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹45,231.89</div>
                        <p className="text-xs text-muted-foreground">
                            +20.1% from last month
                        </p>
                    </CardContent>
                </Card>
                {/* Add more summary cards here */}
            </div>

            {mode === 'business' ? (
                <>
                    <ContactList />
                    <TransactionDrawer />
                </>
            ) : (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <div className="col-span-4">
                            <AnalyticsDashboard />
                        </div>
                        <div className="col-span-3 space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Budgets</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <BudgetCard category="Food" spent={12000} limit={15000} />
                                    <BudgetCard category="Transport" spent={4500} limit={5000} />
                                    <BudgetCard category="Entertainment" spent={8000} limit={5000} />
                                </CardContent>
                            </Card>
                            <GoalCard
                                name="New Laptop"
                                current={45000}
                                target={120000}
                                deadline={new Date('2025-12-31')}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

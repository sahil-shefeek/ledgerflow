'use client'

import { useAppStore } from '@/store/useAppStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContactList } from '@/components/ledger/ContactList'
import { TransactionDrawer } from '@/components/ledger/TransactionDrawer'
import { AnalyticsDashboard } from '@/components/finance/AnalyticsDashboard'
import { BudgetRow } from '@/components/finance/BudgetCard'
import { GoalCard } from '@/components/finance/GoalCard'
import { useBudgets } from '@/hooks/useBudgets'
import { useGoals } from '@/hooks/useGoals'
import { ManageCategoriesDrawer } from '@/components/finance/EditBudgetsDrawer'
import { AddGoalDrawer } from '@/components/finance/AddGoalDrawer'
import { Button } from '@/components/ui/button'
import { BusinessSummary } from '@/components/ledger/BusinessSummary'
import { PersonalTransactionList } from '@/components/finance/PersonalTransactionList'
import { AccountsList } from '@/components/finance/AccountsList'
import { Plus } from 'lucide-react'

import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { BusinessSwitcher } from '@/components/layout/BusinessSwitcher'

export default function DashboardPage() {
    const { mode } = useAppStore()

    return (
        <div className="space-y-4">


            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MobileSidebar />
                    {mode === 'business' ? (
                        <BusinessSwitcher />
                    ) : (
                        <h1 className="text-2xl font-bold tracking-tight">
                            Personal Finance
                        </h1>
                    )}
                </div>
            </div>
            {mode === 'personal' && (
                <div className="text-muted-foreground">
                    Welcome back! Here's your financial overview.
                </div>
            )}
            {mode === 'business' ? (
                <>
                    <BusinessSummary />
                    <ContactList />
                </>
            ) : (
                <div className="space-y-4">
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                        <div className="lg:col-span-4 space-y-4 flex flex-col">
                            <AnalyticsDashboard />
                            <PersonalTransactionList />
                        </div>
                        <div className="lg:col-span-3 space-y-4">
                            <AccountsList />
                            <BudgetsList />
                            <GoalsList />
                        </div>
                    </div>
                </div>
            )
            }
            <TransactionDrawer />
        </div >
    )
}

function BudgetsList() {
    const { data: budgets, isLoading } = useBudgets()

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Budgets</CardTitle>
                <ManageCategoriesDrawer />
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading budgets...</div>
                ) : budgets?.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No budgets set.</div>
                ) : (
                    budgets?.map((budget) => (
                        <BudgetRow
                            key={budget.id}
                            category={budget.name}
                            spent={budget.spent}
                            limit={budget.budget_limit}
                        />
                    ))
                )}
            </CardContent>
        </Card>
    )
}

function GoalsList() {
    const { data: goals, isLoading } = useGoals()

    if (isLoading) return null

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold">Goals</h3>
                <AddGoalDrawer>
                    <Button size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Goal
                    </Button>
                </AddGoalDrawer>
            </div>

            {goals?.map((goal) => (
                <GoalCard
                    key={goal.id}
                    id={goal.id}
                    name={goal.name}
                    current={goal.current_amount}
                    target={goal.target_amount}
                    deadline={new Date(goal.deadline!)}
                />
            ))}
            {goals?.length === 0 && (
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                        No goals set. Add one to start saving!
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

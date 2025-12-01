'use client'

import { useAccounts } from '@/hooks/useAccounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AddAccountDrawer } from './AddAccountDrawer'
import { Button } from '@/components/ui/button'
import { Plus, Wallet, Landmark, Banknote, CreditCard } from 'lucide-react'

const ICONS = {
    CASH: Banknote,
    BANK: Landmark,
    WALLET: Wallet,
    OTHER: CreditCard,
}

export function AccountsList() {
    const { data: accounts, isLoading } = useAccounts()

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Accounts</CardTitle>
                <AddAccountDrawer>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                    </Button>
                </AddAccountDrawer>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading accounts...</div>
                ) : accounts?.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No accounts added.</div>
                ) : (
                    accounts?.map((account) => {
                        const Icon = ICONS[account.type] || CreditCard
                        return (
                            <div key={account.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium leading-none">{account.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{account.type}</p>
                                    </div>
                                </div>
                                <div className="font-medium">
                                    ₹{account.balance.toLocaleString()}
                                </div>
                            </div>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )
}

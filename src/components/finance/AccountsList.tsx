'use client'

import { useAccounts } from '@/hooks/useAccounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AddAccountDrawer } from './AddAccountDrawer'
import { Button } from '@/components/ui/button'
import { Icon } from "@/components/ui/icon";
import { CreditCardIcon, BanknoteIcon, LandmarkIcon, Wallet05Icon, PlusIcon } from "@hugeicons/core-free-icons";
import { paiseToRupees } from "@/lib/currency";

const ICONS = {
    CASH: BanknoteIcon,
    BANK: LandmarkIcon,
    WALLET: Wallet05Icon,
    OTHER: CreditCardIcon,
}

export function AccountsList() {
    const { data: accounts, isLoading } = useAccounts()

    return (
        <Card data-testid="accounts-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Accounts</CardTitle>
                <AddAccountDrawer>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                        <Icon icon={PlusIcon} className="h-4 w-4" />
                    </Button>
                </AddAccountDrawer>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading accounts...</div>
                ) : (accounts?.length ?? 0) > 0 ? (
                    accounts!.map((account) => {
                        const TypeIcon = ICONS[account.type] || CreditCardIcon
                        return (
                            <div key={account.id} data-testid="account-item" className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                        <Icon icon={TypeIcon} className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p data-testid="account-name" className="text-sm font-medium leading-none">{account.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{account.type}</p>
                                    </div>
                                </div>
                                <div data-testid="account-balance" className="font-medium">
                                    ₹{paiseToRupees(account.balance).toNumber().toLocaleString()}
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center p-4 border border-dashed rounded-lg bg-muted/20 text-center space-y-3">
                        <div className="p-2.5 bg-muted/50 rounded-full text-muted-foreground">
                            <Icon icon={LandmarkIcon} className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold">No accounts created</p>
                            <p className="text-xs text-muted-foreground">
                                Add bank accounts, cash wallets, or cards to log transactions.
                            </p>
                        </div>
                        <AddAccountDrawer>
                            <Button size="sm" variant="outline">
                                <Icon icon={PlusIcon} className="mr-1.5 h-3.5 w-3.5" />
                                Add Your First Account
                            </Button>
                        </AddAccountDrawer>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

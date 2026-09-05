/** Represents a monetary value stored as integer paise (100 paise = ₹1). Never do raw arithmetic on this — use src/lib/currency.ts helpers. */
export type Paise = number

export interface Contact {
    id: string
    name: string
    phone: string | null
    type: 'CUSTOMER' | 'SUPPLIER' | 'OTHER'
    /** Stored as integer paise (100 paise = ₹1). Use currency.ts helpers for arithmetic. */
    net_balance: Paise
    last_transaction_at: string | null
    business_id: string | null
    image_url: string | null
    transaction_count: number
    invite_token?: string
    linked_user_id?: string | null
}

export interface Group {
    id: string
    name: string
    created_by: string
    avatar_url: string | null
    type: 'GENERAL' | 'TRIP' | 'HOME' | 'COUPLE' | 'OTHER'
    invite_code: string
    created_at: string
}

export interface GroupMember {
    id: string
    group_id: string
    user_id: string | null
    ghost_name: string | null
    avatar_url: string | null
    joined_at: string
    profiles?: {
        avatar_url: string | null
        full_name?: string | null
    } | null
}

export interface Friendship {
    id: string
    user_id_1: string
    user_id_2: string
    status: 'PENDING' | 'ACCEPTED'
}

export interface TransactionSplit {
    id: string
    transaction_id: string
    user_id: string | null
    group_member_id: string | null
    /** Stored as integer paise (100 paise = ₹1). Use currency.ts helpers for arithmetic. */
    amount: Paise
    percentage?: number
    is_settled: boolean
    member_name_snapshot?: string
}

export type NotificationData =
    | { type: 'FRIEND_REQ'; initiator_id: string }
    | { type: 'GROUP_INVITE'; group_id: string; group_name: string }
    | { type: 'EXPENSE_ADDED'; transaction_id: string; amount: number; [key: string]: any }

export interface Notification {
    id: string
    user_id: string
    type: 'FRIEND_REQ' | 'GROUP_INVITE' | 'EXPENSE_ADDED'
    title: string | null
    message: string | null
    data: NotificationData
    is_read: boolean
    created_at: string
}

export interface TransactionRow {
    id: string
    user_id: string
    /** Stored as integer paise (100 paise = ₹1). Use currency.ts helpers for arithmetic. */
    amount: Paise
    flow: 'IN' | 'OUT'
    mode: 'BUSINESS' | 'PERSONAL'
    date: string
    due_date?: string | null
    name: string
    note?: string | null
    contact_id?: string | null
    category_id?: string | null
    account_id?: string | null
    business_id?: string | null
    group_id?: string | null
    payer_id?: string | null
    payer_group_member_id?: string | null
    split_type?: 'EQUALLY' | 'BY_AMOUNT' | 'BY_PERCENTAGE'
}

export interface TransactionWithJoins extends TransactionRow {
    splits?: TransactionSplit[]
    contacts?: {
        name: string
        phone: string | null
    }
    contact?: {
        id: string
        name: string
    } | null
    category?: {
        name: string
        icon: string
    } | null
    payer?: {
        full_name: string
        avatar_url: string | null
    } | null
    account?: {
        name: string
    } | null
    group?: {
        id: string
        name: string
    } | null
}

/**
 * @deprecated Use `TransactionRow` or `TransactionWithJoins` instead.
 * Kept temporarily as an alias for backwards compatibility.
 */
export type Transaction = TransactionWithJoins

export interface Profile {
    id: string
    full_name: string | null
    username: string | null
    business_name: string | null
    phone: string | null
    email: string | null
    avatar_url: string | null
    currency_symbol: string
    discoverable_by_phone: boolean
    discoverable_by_username: boolean
    friend_invite_token?: string
}

export interface Goal {
    id: string
    name: string
    /** Stored as integer paise (100 paise = ₹1). Use currency.ts helpers for arithmetic. */
    target_amount: Paise
    /** Stored as integer paise (100 paise = ₹1). Use currency.ts helpers for arithmetic. */
    current_amount: Paise
    deadline: string | null
}

export interface RecurringTransaction {
    id: string
    /** Stored as integer paise (100 paise = ₹1). Use currency.ts helpers for arithmetic. */
    amount: number
    name: string
    note?: string
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
    schedule_mode: 'CALENDAR' | 'FIXED_INTERVAL'
    start_date: string
    next_run_date: string
    last_run_date: string | null
    active: boolean
    failure_count: number
    last_failure_reason: string | null
    category_id: string | null
    account_id: string | null
    flow: 'IN' | 'OUT'
    category: {
        name: string
        icon: string
    } | null
    account: {
        name: string
        type: string
    } | null
}

export interface Contact {
    id: string
    name: string
    phone: string | null
    type: 'CUSTOMER' | 'SUPPLIER' | 'OTHER'
    net_balance: number
    last_transaction_at: string
    business_id: string | null
    image_url: string | null
    transaction_count: number
}

export interface Group {
    id: string
    name: string
    created_by: string
    avatar_url: string | null
    type: string // 'GENERAL'
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
    amount: number
    percentage?: number
    is_settled: boolean
}

export interface Notification {
    id: string
    user_id: string
    type: 'FRIEND_REQ' | 'GROUP_INVITE' | 'EXPENSE_ADDED'
    title: string | null
    message: string | null
    data: any
    is_read: boolean
    created_at: string
}

export interface Transaction {
    id: string
    amount: number
    flow: 'IN' | 'OUT'
    mode: 'BUSINESS' | 'PERSONAL'
    date: string
    name: string
    note?: string | null
    contact_id: string | null
    group_id?: string | null
    payer_id?: string | null
    split_type?: 'EQUALLY' | 'BY_AMOUNT' | 'BY_PERCENTAGE'
    splits?: TransactionSplit[]
    contacts?: {
        name: string
        phone: string | null
    }
}

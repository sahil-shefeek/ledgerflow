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

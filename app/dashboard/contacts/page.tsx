'use client'

import { ContactList } from '@/components/ledger/ContactList'

export default function ContactsPage() {
    return (
        <div className="container mx-auto p-4 max-w-2xl h-[calc(100vh-4rem)]">
            <ContactList />
        </div>
    )
}

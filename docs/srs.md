# **Project: LedgerFlow**
- **Version:** 1.0
- **Date:** November 29, 2025
- **Tech Stack:** Next.js 15, TypeScript, Supabase, Tailwind, Shadcn/UI, React Query.

---

### Section 1: Environment & Dependency Verification

I have initialized the project with Next.js, Supabase, Shadcn, and Framer Motion, the core is ready. However, for a production-grade financial app, please verify you have the following specific utility packages.

**Check your `package.json` for these specific additions.** If missing, install them:

1.  **State Management & Caching (Crucial for Supabase):**
    *   `@tanstack/react-query`: Needed for caching DB responses, handling loading states, and optimistic updates (instant UI feedback).
    *   `zustand`: For global client-side UI state (toggling between Business/Personal modes).
2.  **Form Handling & Validation:**
    *   `react-hook-form`: To manage complex inputs without re-renders.
    *   `zod`: For schema validation (ensuring a transaction amount is actually a number).
3.  **Data Visualization:**
    *   `recharts`: The industry standard for React charts (for the Analytics dashboard).
4.  **Date Management:**
    *   `date-fns`: Lightweight date formatting.
5.  **Utilities:**
    *   `sonner`: The best toast notification library for React (cleaner than default options).
    *   `vaul`: For those polished mobile "drawer" interactions seen in the screenshots.

**Installation Command (Add missing ones):**
```bash
pnpm add @tanstack/react-query zustand react-hook-form zod recharts date-fns sonner vaul
```

---

### Section 2: Database Architecture & Schema Design

**Context:** We are using **Supabase (PostgreSQL)**.
**Goal:** Optimize for read-heavy dashboards (Mobile view) and write-heavy entry (Ledger).

#### 2.1 Entity Relationship Strategy
To avoid "N+1" problems (fetching a list of contacts and then making a separate API call for every contact to get their balance), we will use **Database Triggers** and **Denormalization**.

*   **Normalization:** Transactions are stored individually.
*   **Denormalization:** The "Current Balance" for a contact is stored directly on the `contacts` table. This is updated automatically via a Postgres Trigger. This allows the Contact List to load instantly without summing thousands of rows on every page load.

#### 2.2 The Schema (SQL Definition)

Copy this mental model for your Supabase Table Editor or SQL Editor.

**1. Table: `profiles`** (Extends Supabase Auth)
*   `id` (uuid, PK): References `auth.users.id`.
*   `full_name` (text): Display name.
*   `business_name` (text, nullable): For Business Mode.
*   `currency_symbol` (text, default '₹').
*   `created_at` (timestamptz).

**2. Table: `contacts`** (The "Khata" entities)
*   `id` (uuid, PK).
*   `user_id` (uuid): FK to `profiles.id`. **(Indexed)**
*   `name` (text): Name of customer/vendor.
*   `phone` (text, nullable).
*   `type` (text): 'CUSTOMER' or 'VENDOR'.
*   `net_balance` (numeric, default 0.00): **Crucial optimization column.**
    *   Positive (+) means they owe you.
    *   Negative (-) means you owe them.
*   `last_transaction_at` (timestamptz): To sort list by "Recently Active".

**3. Table: `categories`** (For Personal Expense tracking)
*   `id` (uuid, PK).
*   `user_id` (uuid): FK to `profiles.id`.
*   `name` (text): e.g., "Food", "Rent".
*   `icon` (text): storing Lucide icon name string.
*   `type` (text): 'INCOME' or 'EXPENSE'.
*   `budget_limit` (numeric, nullable): Monthly limit for this category.

**4. Table: `transactions`** (The Single Source of Truth)
*   `id` (uuid, PK).
*   `user_id` (uuid): FK to `profiles.id`. **(Indexed)**
*   `amount` (numeric): Always positive value.
*   `flow` (text): 'IN' (Money Received) or 'OUT' (Money Paid).
*   `mode` (text): 'BUSINESS' or 'PERSONAL'. **(Indexed)**
*   `contact_id` (uuid, nullable): FK to `contacts.id`. Used if `mode` = 'BUSINESS'.
*   `category_id` (uuid, nullable): FK to `categories.id`. Used if `mode` = 'PERSONAL'.
*   `date` (timestamptz): Transaction date. **(Indexed for Date Range queries)**
*   `description` (text, nullable).
*   `attachment_url` (text, nullable): For images/receipts.

#### 2.3 Optimization & Safety (SQL Functions)

To ensure the `contacts.net_balance` is always correct without manual calculation in the frontend, we use a Postgres Trigger.

**The Logic:**
1.  If you add a transaction of type 'OUT' (You gave money) linked to a Contact, `net_balance` increases.
2.  If you add 'IN' (You received money), `net_balance` decreases.

**SQL Function for Trigger (Run this in Supabase SQL Editor):**

```sql
-- Function to auto-update contact balance
CREATE OR REPLACE FUNCTION update_contact_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Logic for INSERT
  IF (TG_OP = 'INSERT') THEN
    UPDATE contacts
    SET 
      net_balance = net_balance + (CASE WHEN NEW.flow = 'OUT' THEN NEW.amount ELSE -NEW.amount END),
      last_transaction_at = NEW.date
    WHERE id = NEW.contact_id;
  END IF;

  -- Logic for DELETE (Reverse the math)
  IF (TG_OP = 'DELETE') THEN
    UPDATE contacts
    SET net_balance = net_balance - (CASE WHEN OLD.flow = 'OUT' THEN OLD.amount ELSE -OLD.amount END)
    WHERE id = OLD.contact_id;
  END IF;
  
  -- Logic for UPDATE (Handle diffs - simplified for SRS, usually requires handling old vs new)
  -- For V1, we can suggest deleting and re-adding complicated edits, or full trigger logic.
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach Trigger to Transactions Table
CREATE TRIGGER trigger_update_balance
AFTER INSERT OR DELETE ON transactions
FOR EACH ROW
WHEN (NEW.mode = 'BUSINESS' OR OLD.mode = 'BUSINESS')
EXECUTE FUNCTION update_contact_balance();
```

#### 2.4 Performance Considerations (The "Why")

1.  **Composite Indexes:** We will add a composite index on `transactions(user_id, date)` because almost every query will filter by the logged-in user and sort by date.
2.  **Row Level Security (RLS):**
    *   Enable RLS on all tables.
    *   Policy: `auth.uid() = user_id`.
    *   *Benefit:* You can query `supabase.from('transactions').select('*')` without manual `where` clauses in your frontend code. Supabase automatically filters data for the logged-in user.

---


### Section 3: Authentication & Onboarding Architecture

**Goal:** Frictionless entry. Mobile users hate typing passwords. We will prioritize **Phone OTP** (common in India/Asia) with **Google** as a backup.

#### 3.1 Authentication Flow (Supabase Auth)

1.  **Login Page:**
    *   **UI:** A clean Shadcn Card centered on screen.
    *   **Input:** Phone Number (masked input).
    *   **Action:** "Send OTP".
    *   **Verification:** 6-digit input slot (using `input-otp` component from Shadcn).

2.  **Backend Logic (Supabase):**
    *   We will use the Supabase JS Client: `supabase.auth.signInWithOtp({ phone: '+91...' })`.
    *   *Note:* For development, you can set up "Fixed OTPs" in Supabase Dashboard (e.g., Phone: +919999999999, OTP: 123456) to save SMS costs.

#### 3.2 The "Profile Trigger" (Crucial Pattern)
When a user signs up via Auth, their data lives in a protected system schema (`auth.users`). We need to create a corresponding row in our public table (`public.profiles`) automatically to store their name, business name, and currency.

**Run this SQL in Supabase Editor to automate onboarding:**

```sql
-- Trigger to create a public profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone);
  return new;
end;
$$;

-- Attach the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

#### 3.3 Next.js Middleware Protection
We must ensure no unauthorized user can access the dashboard.
*   **File:** `middleware.ts` (root of project).
*   **Logic:**
    1.  Create a Supabase Server Client.
    2.  Check `await supabase.auth.getSession()`.
    3.  If no session & path is not `/login`, redirect to `/login`.
    4.  If session exists & path is `/login`, redirect to `/dashboard`.

---

### Section 4: Business Ledger Logic & Frontend Architecture

**Context:** This is the "Blue Theme" functionality (Khata/Credit Book).
**Challenge:** Users demand instant feedback. If they record a sale, the balance must update immediately, even on slow networks (3G).

#### 4.1 Data Fetching Strategy (React Query)
We will organize queries into custom hooks.

*   **`useContacts` Hook:**
    *   **Query Key:** `['contacts', userId]`
    *   **Query Fn:** `supabase.from('contacts').select('*').order('last_transaction_at', { ascending: false })`
    *   *Optimization:* This fetches the `net_balance` we defined in the DB section. We do NOT calculate balances on the client.

*   **`useTransactions` Hook:**
    *   **Query Key:** `['transactions', contactId]` (if viewing specific person) OR `['transactions', 'all']`.
    *   **Implementation:** `useInfiniteQuery` for infinite scrolling (Load 20 items at a time).
    *   **Join:** `supabase.from('transactions').select('*, contacts(name, phone)')`. This prevents the N+1 problem by fetching the contact name alongside the transaction in a single request.

#### 4.2 The "Add Transaction" Flow (Optimistic Updates)

This is the most complex part of the UX. We will implement **Optimistic UI** to make the app feel "Native".

**Scenario:** User adds a "Credit" (You gave money) of ₹500 to "Raju".

**Step-by-Step Logic:**

1.  **User Action:** Fills form, clicks "Save".
2.  **Immediate Frontend Change (Before Server Response):**
    *   **Cache Update 1 (Transaction List):** Inject a "fake" transaction object into the top of the `['transactions', 'Raju']` list. Mark it visually as "pending" (maybe slightly transparent).
    *   **Cache Update 2 (Contact Balance):** Find "Raju" in the `['contacts']` cache. Manually add ₹500 to his `net_balance`. Update the UI number immediately.
3.  **Background Network Request:**
    *   React Query sends the `INSERT` to Supabase.
4.  **Server Response:**
    *   **Success:** Replace the "fake" ID with the real UUID from the DB. Remove "pending" style.
    *   **Error:** Roll back the cache (remove transaction, revert balance) and show a Toast Error: "Failed to save. check internet."

#### 4.3 Component Architecture for Ledger

*   **`DashboardLayout.tsx`:**
    *   Contains the `Sidebar` (Desktop) / `BottomNav` (Mobile).
    *   Uses `useStore` (Zustand) to check `activeMode` ('business' | 'personal') and conditionally render the theme wrapper.

*   **`ContactList.tsx`:**
    *   Virtual list (if user has >1000 contacts).
    *   Each row shows: Name, Last Transaction Date (formatted "2 days ago"), and **Net Balance** (Green text if positive, Red if negative).

*   **`TransactionDrawer.tsx` (Vaul Component):**
    *   This is the input form.
    *   **State:** Controlled inputs for `amount`, `date`, `description`.
    *   **Calculator UI:** Custom number pad component so users don't struggle with the native mobile keyboard.

#### 4.4 Reporting Logic (PDF)
*   **Library:** `@react-pdf/renderer`.
*   **Logic:** Since PDF generation is heavy, we do this **Client Side** on demand.
*   **Data:** Fetch all transactions for the date range -> Pass to PDF Component -> `BlobProvider` -> Download/Share via Web Share API (`navigator.share`).

---


### Section 5: Personal Finance Logic (Wealth & Analytics)

**Context:** The "Earthy/Dark Theme".
**Challenge:** Unlike the ledger (which is a simple list), Personal Finance requires heavy **Aggregation** (Summing totals by category, filtering by month).
**Optimization:** We will use **PostgreSQL Views/RPCs** to handle calculations on the database side. Fetching 5,000 transactions to the client just to calculate a pie chart is an anti-pattern.

#### 5.1 Analytics Architecture (Supabase RPC)

Instead of complex JS `reduce` functions, we will create a dedicated SQL function to fetch chart data.

**SQL Function for "Spending by Category":**
(Run this in Supabase SQL Editor)

```sql
-- Function to get monthly spending breakdown
create or replace function get_monthly_category_spend(
  p_user_id uuid, 
  p_month int, 
  p_year int
)
returns table (
  category_name text,
  category_color text,
  total_spent numeric
)
language plpgsql
as $$
begin
  return query
  select 
    c.name as category_name,
    c.icon as category_color, -- utilizing icon field for color hex or name
    sum(t.amount) as total_spent
  from transactions t
  join categories c on t.category_id = c.id
  where t.user_id = p_user_id
    and t.mode = 'PERSONAL'
    and t.flow = 'OUT'
    and extract(month from t.date) = p_month
    and extract(year from t.date) = p_year
  group by c.name, c.icon;
end;
$$;
```

**Frontend Usage (React Query):**
```typescript
const { data } = useQuery({
  queryKey: ['analytics', month, year],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_monthly_category_spend', {
      p_user_id: user.id,
      p_month: currentMonth, // e.g., 11
      p_year: currentYear    // e.g., 2025
    });
    if (error) throw error;
    return data;
  }
});
```

#### 5.2 Budgeting Engine
*   **Logic:** A Budget is simply a comparison: `Actual Spend` vs `Limit`.
*   **Database:** We need a `budgets` table, or we can add a `budget_limit` column to the `categories` table (simpler for V1).
*   **Visual Component:** `<Progress value={(spent / limit) * 100} />` (Shadcn Component).
*   **Alert Logic:**
    *   Green: 0-50%
    *   Yellow: 51-85%
    *   Red: >85%

#### 5.3 Goal Tracker (Sinking Funds)
*   **Formula:** `Daily Saving Needed = (Target - Current) / Days Remaining`.
*   **Component:** `GoalCard.tsx`
    *   **Inputs:** Name, Target Amount, Target Date.
    *   **Display:** Circular Progress Ring (SVG/Recharts) showing % achieved.
    *   **Interaction:** A "Quick Add" button (+ ₹500) that creates a transaction categorized as "Savings/Transfer" and updates the Goal's `current_amount`.

---

### Section 6: Styling & Theming System (The "Dual Persona")

**Context:** The app needs to radically change its "Vibe" based on the selected mode.
*   **Business Mode:** Clean, Professional, High Contrast, Blue/White.
*   **Personal Mode:** Cozy, Dark/Earthy, Gamified, Brown/Green.

#### 6.1 CSS Variables Strategy (Tailwind)

We will not use hardcoded colors. We will use **Semantic Tokens**.

**Update your `globals.css` (Tailwind Config Layer):**

```css
@layer base {
  :root {
    /* Default Base (Business - Blue) */
    --background: 210 40% 98%;      /* Light Blueish Grey */
    --foreground: 222 47% 11%;      /* Dark Navy */
    
    --primary: 221 83% 53%;         /* Bright Royal Blue */
    --primary-foreground: 210 40% 98%;
    
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    
    --radius: 0.75rem;
  }

  /* Personal Mode Overrides (Data Attribute) */
  [data-mode="personal"] {
    --background: 20 14% 4%;        /* Very Dark Brown/Black */
    --foreground: 60 9% 98%;        /* Off-white */
    
    --primary: 24 95% 53%;          /* Vibrant Orange/Earth */
    --primary-foreground: 60 9% 98%;
    
    --card: 20 14% 8%;              /* Dark Earthy Card */
    --card-foreground: 60 9% 98%;
  }
}
```

#### 6.2 The Theme Store (Zustand)

Create a store to manage this switch globally.

`src/store/useAppStore.ts`:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppMode = 'business' | 'personal';

interface AppState {
  mode: AppMode;
  toggleMode: () => void;
  setMode: (mode: AppMode) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'business', // Default
      toggleMode: () => set((state) => ({ 
        mode: state.mode === 'business' ? 'personal' : 'business' 
      })),
      setMode: (mode) => set({ mode }),
    }),
    { name: 'app-preference' } // Saves to localStorage
  )
);
```

#### 6.3 The Root Layout Wrapper

To apply the theme, we wrap the entire application in a component that reads the store.

`src/components/providers/ThemeWrapper.tsx`:
```typescript
'use client';
import { useAppStore } from '@/store/useAppStore';
import { useEffect } from 'react';

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { mode } = useAppStore();

  useEffect(() => {
    // Apply the data-attribute to the <body> or a root <div>
    const body = document.querySelector('body');
    if (body) {
      body.setAttribute('data-mode', mode);
    }
  }, [mode]);

  return <>{children}</>;
}
```

#### 6.4 Transition Animations
When switching modes, we want a fluid transition, not a jarring flash.

**Global CSS Transition:**
```css
body, div, span, button {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

**Toggle Component (Framer Motion):**
A sliding toggle switch in the Sidebar/Header.
```tsx
<div onClick={toggleMode} className="cursor-pointer bg-muted rounded-full p-1 flex relative">
  <motion.div 
    layout 
    className="bg-primary h-6 w-6 rounded-full shadow-sm"
    transition={{ type: "spring", stiffness: 700, damping: 30 }}
    // Move logic based on mode state
  />
</div>
```

---
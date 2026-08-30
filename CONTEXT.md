# Shared Core Context Glossary

This glossary defines the ubiquitous language for the **Shared Core Context** of LedgerFlow, which governs user identity, workspace state, preferences, and identity reconciliation across Personal and Business modes.

---

## 1. Workspace & Preference Management

### Workspace Mode
The top-level operational scope of LedgerFlow, operating as either **Personal Mode** or **Business Mode**. Switching mode alters the active UI navigation shell, styling themes, accessible features, and transaction data boundaries.

### Theme & Accent Preference
Mode-specific visual appearance settings:
- **Theme**: Light or Dark mode setting, configured independently per Workspace Mode.
- **Accent Color**: Selection of 6 curated accent color palettes (Blue, Green, Violet, Orange, Rose, Slate) configured per Workspace Mode.
- **Theme Sync**: Optional setting allowing users to mirror Light/Dark appearance across modes while maintaining mode-specific accent styling.

---

## 2. Identity & Social Entities

### Registered Profile
An authenticated user in LedgerFlow possessing a verified identity, user settings, profile picture avatar, phone number, and mandatory `@username` handle.

### Unregistered Contact
A local contact entry created by a Registered Profile (User A) to record 1:1 transactions, IOUs, or balances with an external individual (User B) who does not yet have an active LedgerFlow account. An Unregistered Contact is scoped locally to the user who created it.

### Ghost Member
A non-registered participant in a shared Group Ledger represented by a placeholder name. 

> **Relationship between Unregistered Contact & Ghost Member:**
> When User A adds an Unregistered Contact (User B) to a shared Group Ledger (e.g. with members C, D), that Unregistered Contact becomes a **Ghost Member** within the context of that specific Group Ledger. An Unregistered Contact appearing in a Group Ledger functions as a Ghost Member for group expense splitting.

---

## 3. Identity Reconciliation

### Contact Merging
The process of linking one or more `Unregistered Contact` entries (1:1 context) and/or `Ghost Member` records (group context) to a newly registered or existing `Registered Profile` upon phone/email verification or invite link acceptance.

- **Verification Guard**: Auto-matching by phone or email requires verified identity status on the target profile to prevent spoofing.
- **Deterministic Matching**: Performed strictly via verified phone/email matches or explicit unique invite link tokens (excluding ambiguous fuzzy name matching).
- **1:1 Contact Linking**: Automatically links matching Unregistered Contact entries to the target Registered Profile.
- **Group Ghost Member Claiming**:
  - *Direct Token Claim*: Claiming via an explicit group invite token immediately converts the Ghost Member to a linked Registered Profile in the group.
  - *Phone/Email Match*: Matching via phone/email notifies the group creator/admin for approval before re-assigning historical group transaction splits.
- **Friendship Auto-Creation**: Merging automatically establishes a mutual `Friend` relationship between the inviter and the newly linked Registered Profile.

## 4. Domain Services

### Onboarding Service
Centralizes the multi-domain initialization of a newly registered user, decoupling the `auth` lifecycle from the provisioning of default profiles, preferences, businesses, accounts, and budget categories.
- **Branched Mode Onboarding**: Onboarding strictly branches based on the user's `Workspace Mode` selection. Users are only asked for data relevant to their chosen mode (e.g., Bank Accounts for Personal, Business Name for Business).
- **Mode-Specific State Tracking**: The database tracks setup progress independently per mode (e.g., `personal_setup_status`, `business_setup_status`, and current `setup_step`). This allows complex multi-step flows to be paused and resumed.
- **Just-In-Time (JIT) Onboarding**: Intercepts user intent when prerequisite data is missing. This occurs in two phases:
  1. **Mode Switch Block**: When entering a new mode for the first time, users are intercepted before reaching the dashboard and prompted to complete the mode's required setup.
  2. **Action Block**: If a user bypasses initial setup and attempts an action (e.g., creating a transaction without a bank account), they are redirected to complete the specific setup step before seamlessly returning them to their original task via URL parameters (`?returnTo=`).
- **Username Generation**: Handles real-time validation and conflict resolution during profile setup by auto-suggesting alternatives (based on name, email, or alphanumeric suffixes) if a desired handle is unavailable.

### Notification Service
Centralizes the composition and fan-out of activity notifications (e.g., deleted transactions) to relevant contacts and group members. It handles both in-app notification state and out-of-app delivery (such as filtering and dispatching high-priority alerts via Web Push).

### Web Push Subscription
A browser-specific device registration (containing an endpoint and VAPID auth keys) linked to a `Registered Profile`, enabling the delivery of offline push notifications to the user's device.
## 5. Ledger & Transactions

### Transaction Category
A user-defined classification (Income or Expense) used to group and track personal or business transactions. Categories dictate the visual representation of transactions (via icons) and form the basis for budgeting and analytics.

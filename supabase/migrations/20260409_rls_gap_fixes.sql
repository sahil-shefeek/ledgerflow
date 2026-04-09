-- RLS Audit: 2026-04-09
-- Audited tables: transactions, contacts, categories, goals, recurring_transactions, accounts
--
-- Findings:
--   - transactions: SELECT ✓, INSERT ✓, UPDATE ✓, DELETE ✓
--   - contacts: SELECT ✓, INSERT ✓, UPDATE ✓, DELETE ✓
--   - categories: SELECT ✓, INSERT ✓, UPDATE ✓, DELETE ✓
--   - goals: SELECT ✓, INSERT ✓, UPDATE ✓, DELETE ✓
--   - accounts: SELECT ✓, INSERT ✓, UPDATE ✓, DELETE ✓
--   - recurring_transactions: SELECT ✓, INSERT ✓, UPDATE ✓, DELETE ✗ (MISSING)
--
-- Fix: Add missing DELETE policy for recurring_transactions.

CREATE POLICY "Users can delete own recurring transactions"
  ON public.recurring_transactions
  FOR DELETE
  USING (auth.uid() = user_id);

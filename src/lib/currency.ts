// src/lib/currency.ts
// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL INTEGRITY LAYER
// All amounts are stored as INTEGER PAISE (100 paise = ₹1).
// Rule: Never perform arithmetic on raw JS numbers for currency.
// ─────────────────────────────────────────────────────────────────────────────

import Decimal from 'decimal.js'

Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

/** Convert a rupee float from user input (e.g. "12.50") to integer paise (1250). */
export function rupeesToPaise(rupees: number | string): number {
  return new Decimal(rupees).times(100).toDecimalPlaces(0).toNumber()
}

/** Convert integer paise from DB (e.g. 1250) to a Decimal rupee value. */
export function paiseToRupees(paise: number): Decimal {
  return new Decimal(paise).dividedBy(100)
}

/** Format integer paise for display. Returns a string like "₹12.50". */
export function formatCurrency(paise: number, symbol = '₹'): string {
  return `${symbol}${paiseToRupees(paise).toFixed(2)}`
}

/** Safe integer addition of two paise values. */
export function addPaise(a: number, b: number): number {
  return new Decimal(a).plus(new Decimal(b)).toNumber()
}

/** Safe integer subtraction of two paise values. */
export function subtractPaise(a: number, b: number): number {
  return new Decimal(a).minus(new Decimal(b)).toNumber()
}

/** Validate that a raw user-input string is a valid positive monetary amount. */
export function isValidAmount(value: string): boolean {
  try {
    const d = new Decimal(value)
    return d.isFinite() && d.greaterThan(0) && d.decimalPlaces() <= 2
  } catch {
    return false
  }
}

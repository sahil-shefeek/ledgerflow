import { describe, it, expect } from 'vitest'
import {
  rupeesToPaise,
  paiseToRupees,
  formatCurrency,
  addPaise,
  subtractPaise,
  isValidAmount,
} from '../currency'

describe('rupeesToPaise', () => {
  it('converts "12.50" → 1250', () => {
    expect(rupeesToPaise('12.50')).toBe(1250)
  })

  it('converts "0.01" → 1', () => {
    expect(rupeesToPaise('0.01')).toBe(1)
  })

  it('converts "100" → 10000', () => {
    expect(rupeesToPaise('100')).toBe(10000)
  })

  it('converts 0.1 + 0.2 (the classic float trap) → 30', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30)
  })

  it('throws or returns NaN for non-numeric input', () => {
    expect(() => rupeesToPaise('abc')).toThrow()
  })
})

describe('paiseToRupees', () => {
  it('converts 1250 → Decimal("12.50")', () => {
    expect(paiseToRupees(1250).toString()).toBe('12.5')
    expect(paiseToRupees(1250).toFixed(2)).toBe('12.50')
  })

  it('converts 1 → Decimal("0.01")', () => {
    expect(paiseToRupees(1).toFixed(2)).toBe('0.01')
  })

  it('converts 0 → Decimal("0.00")', () => {
    expect(paiseToRupees(0).toFixed(2)).toBe('0.00')
  })
})

describe('formatCurrency', () => {
  it('formats 1250 → "₹12.50"', () => {
    expect(formatCurrency(1250)).toBe('₹12.50')
  })

  it('formats 0 → "₹0.00"', () => {
    expect(formatCurrency(0)).toBe('₹0.00')
  })

  it('formats 100000 → "₹1000.00"', () => {
    expect(formatCurrency(100000)).toBe('₹1000.00')
  })

  it('uses custom symbol when provided', () => {
    expect(formatCurrency(1250, '$')).toBe('$12.50')
  })
})

describe('addPaise', () => {
  it('100 + 200 → 300', () => {
    expect(addPaise(100, 200)).toBe(300)
  })

  it('1 + 1 → 2', () => {
    expect(addPaise(1, 1)).toBe(2)
  })

  it('large values do not drift (10_000_000 + 10_000_000 = 20_000_000)', () => {
    expect(addPaise(10_000_000, 10_000_000)).toBe(20_000_000)
  })
})

describe('subtractPaise', () => {
  it('200 - 100 → 100', () => {
    expect(subtractPaise(200, 100)).toBe(100)
  })

  it('result can be negative (100 - 200 → -100)', () => {
    expect(subtractPaise(100, 200)).toBe(-100)
  })
})

describe('isValidAmount', () => {
  it('"100" → true', () => {
    expect(isValidAmount('100')).toBe(true)
  })

  it('"12.50" → true', () => {
    expect(isValidAmount('12.50')).toBe(true)
  })

  it('"0.001" → false (too many decimals)', () => {
    expect(isValidAmount('0.001')).toBe(false)
  })

  it('"-1" → false (negative)', () => {
    expect(isValidAmount('-1')).toBe(false)
  })

  it('"0" → false (zero not allowed)', () => {
    expect(isValidAmount('0')).toBe(false)
  })

  it('"abc" → false', () => {
    expect(isValidAmount('abc')).toBe(false)
  })

  it('"" → false', () => {
    expect(isValidAmount('')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { formatNumber, Decimal } from './numbers.js'

describe('formatNumber', () => {
  it('returns "0.0" for 0', () => {
    expect(formatNumber(0)).toBe('0.0')
  })

  it('returns "999.0" for 999', () => {
    expect(formatNumber(999)).toBe('999.0')
  })

  it('returns "1.0K" for 1000', () => {
    expect(formatNumber(1000)).toBe('1.0K')
  })

  it('returns "1.5K" for 1500', () => {
    expect(formatNumber(1500)).toBe('1.5K')
  })

  it('returns "1.0M" for 1000000', () => {
    expect(formatNumber(1000000)).toBe('1.0M')
  })

  it('returns "1.0B" for 1e9', () => {
    expect(formatNumber(1e9)).toBe('1.0B')
  })

  it('returns "1.0T" for 1e12', () => {
    expect(formatNumber(1e12)).toBe('1.0T')
  })

  it('returns "1.0Qa" for 1e15', () => {
    expect(formatNumber(1e15)).toBe('1.0Qa')
  })

  it('returns "0" for Infinity', () => {
    expect(formatNumber(Infinity)).toBe('0')
  })

  it('returns "0" for NaN', () => {
    expect(formatNumber(NaN)).toBe('0')
  })

  it('returns "-500.0" for -500', () => {
    expect(formatNumber(-500)).toBe('-500.0')
  })

  it('returns scientific notation for very large Decimal values', () => {
    const result = formatNumber(new Decimal('1e308'))
    expect(typeof result).toBe('string')
    expect(result).not.toBe('0')
    expect(result.length).toBeGreaterThan(0)
  })

  it('re-exports Decimal class', () => {
    const d = new Decimal(42)
    expect(d.toNumber()).toBe(42)
  })
})

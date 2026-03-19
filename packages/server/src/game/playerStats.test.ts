import { describe, it, expect, vi, afterEach } from 'vitest'
import Decimal from 'break_eternity.js'

import {
  getPlayerDamage,
  getUpgradeCost,
  computeOfflineGold,
} from './playerStats.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getPlayerDamage', () => {
  it('Test 1: base stats (atkLevel:0, critLevel:0, spdLevel:0) with Math.random > critChance returns damage=25, isCrit=false, attackDelay=1000', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const result = getPlayerDamage({ atkLevel: 0, critLevel: 0, spdLevel: 0 })
    expect(result.damage).toBe(25)
    expect(result.isCrit).toBe(false)
    expect(result.attackDelay).toBe(1000)
  })

  it('Test 2: atkLevel:10 returns damage=75 (BASE_DAMAGE 25 + 10*5 = 75) without crit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const result = getPlayerDamage({ atkLevel: 10, critLevel: 0, spdLevel: 0 })
    expect(result.damage).toBe(75)
    expect(result.isCrit).toBe(false)
    expect(result.attackDelay).toBe(1000)
  })

  it('Test 3: critLevel:10 with Math.random=0.01 returns isCrit=true, damage doubled (25*2=50)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    const result = getPlayerDamage({ atkLevel: 0, critLevel: 10, spdLevel: 0 })
    expect(result.isCrit).toBe(true)
    expect(result.damage).toBe(50)
  })

  it('Test 4: spdLevel:10 returns attackDelay=667 (1000 / (1.0 + 10*0.05) = 1000/1.5 ≈ 666)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const result = getPlayerDamage({ atkLevel: 0, critLevel: 0, spdLevel: 10 })
    // 1000 / 1.5 = 666.67, floored = 666
    expect(result.attackDelay).toBe(666)
    expect(result.isCrit).toBe(false)
  })

  it('Test 5: crit chance is capped at 0.80 even for very high critLevel', () => {
    // critLevel=50 would give 0.05 + 50*0.02 = 1.05 — capped at 0.80
    // Math.random=0.79 should still crit; Math.random=0.81 should not
    vi.spyOn(Math, 'random').mockReturnValue(0.79)
    const result = getPlayerDamage({ atkLevel: 0, critLevel: 50, spdLevel: 0 })
    expect(result.isCrit).toBe(true)
  })

  it('Test 6: attackDelay has a minimum of 50ms to prevent divide-by-zero / absurd speed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const result = getPlayerDamage({ atkLevel: 0, critLevel: 0, spdLevel: 999 })
    expect(result.attackDelay).toBeGreaterThanOrEqual(50)
  })
})

describe('getUpgradeCost', () => {
  it('Test 7: getUpgradeCost("atk", 0) returns Decimal(10)', () => {
    const cost = getUpgradeCost('atk', 0)
    expect(cost.toNumber()).toBeCloseTo(10, 5)
  })

  it('Test 8: getUpgradeCost("atk", 10) returns approximately Decimal(40.46) (10 * 1.15^10)', () => {
    const cost = getUpgradeCost('atk', 10)
    // 10 * 1.15^10 = 10 * 4.04556... = 40.4556
    expect(cost.toNumber()).toBeCloseTo(40.46, 1)
  })

  it('Test 9: getUpgradeCost("crit", 0) returns Decimal(25)', () => {
    const cost = getUpgradeCost('crit', 0)
    expect(cost.toNumber()).toBeCloseTo(25, 5)
  })

  it('Test 10: getUpgradeCost("spd", 0) returns Decimal(50)', () => {
    const cost = getUpgradeCost('spd', 0)
    expect(cost.toNumber()).toBeCloseTo(50, 5)
  })

  it('Test 11: getUpgradeCost("spd", 0) has higher base cost than "atk" (50 vs 10)', () => {
    const atkCost = getUpgradeCost('atk', 0)
    const spdCost = getUpgradeCost('spd', 0)
    expect(spdCost.gt(atkCost)).toBe(true)
  })
})

describe('computeOfflineGold', () => {
  it('Test 12: base stats with 3600 seconds returns Decimal(45000) (25 * 1.0 * 3600 * 0.5 * 1.0)', () => {
    const gold = computeOfflineGold({ atkLevel: 0, critLevel: 0, spdLevel: 0 }, 3600)
    // baseDamage=25, attackSpeed=1.0, offlineDps=25, cappedSecs=3600, rate=0.5
    // 25 * 1.0 * 3600 * 0.5 = 45000
    expect(gold.toNumber()).toBeCloseTo(45000, 0)
  })

  it('Test 13: 10 hours offline returns same as 8 hours (MAX_OFFLINE_HOURS cap)', () => {
    const gold8h = computeOfflineGold({ atkLevel: 0, critLevel: 0, spdLevel: 0 }, 8 * 3600)
    const gold10h = computeOfflineGold({ atkLevel: 0, critLevel: 0, spdLevel: 0 }, 10 * 3600)
    expect(gold10h.toNumber()).toBeCloseTo(gold8h.toNumber(), 0)
  })

  it('Test 14: 30 seconds offline returns Decimal(0) (below 60s minimum threshold)', () => {
    const gold = computeOfflineGold({ atkLevel: 0, critLevel: 0, spdLevel: 0 }, 30)
    expect(gold.toNumber()).toBe(0)
  })

  it('Test 15: exactly 60 seconds returns non-zero gold (minimum threshold met)', () => {
    const gold = computeOfflineGold({ atkLevel: 0, critLevel: 0, spdLevel: 0 }, 60)
    expect(gold.toNumber()).toBeGreaterThan(0)
  })

  it('Test 16: atkLevel:10 increases offline gold compared to atkLevel:0', () => {
    const goldBase = computeOfflineGold({ atkLevel: 0, critLevel: 0, spdLevel: 0 }, 3600)
    const goldAtk10 = computeOfflineGold({ atkLevel: 10, critLevel: 0, spdLevel: 0 }, 3600)
    expect(goldAtk10.gt(goldBase)).toBe(true)
  })
})

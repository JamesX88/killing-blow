import Decimal from 'break_eternity.js'
import type { PrismaClient } from '@prisma/client'

// Constants
export const BASE_DAMAGE = 25
const BASE_ATTACK_SPEED = 1.0
const CRIT_CHANCE_BASE = 0.05
const CRIT_DAMAGE_MULT = 2.0
export const GOLD_PER_DAMAGE = 1.0
export const OFFLINE_RATE = 0.5
export const MAX_OFFLINE_HOURS = 8
export const ACTIVE_BONUS_MULTIPLIER = 2.0

const UPGRADE_COSTS = {
  atk:  { base: 10,  growth: 1.15 },
  crit: { base: 25,  growth: 1.15 },
  spd:  { base: 50,  growth: 1.18 },
} as const

export type StatKey = keyof typeof UPGRADE_COSTS

export interface PlayerDamageResult {
  damage: number
  isCrit: boolean
  attackDelay: number
}

export function getPlayerDamage(stats: { atkLevel: number; critLevel: number; spdLevel: number }): PlayerDamageResult {
  const attackDamage = BASE_DAMAGE + stats.atkLevel * 5
  const critChance = Math.min(CRIT_CHANCE_BASE + stats.critLevel * 0.02, 0.80)
  const attackSpeed = BASE_ATTACK_SPEED + stats.spdLevel * 0.05
  const isCrit = Math.random() < critChance
  const damage = isCrit ? Math.floor(attackDamage * CRIT_DAMAGE_MULT) : attackDamage
  const attackDelay = Math.max(50, Math.floor(1000 / attackSpeed))
  return { damage, isCrit, attackDelay }
}

export function getUpgradeCost(stat: StatKey, currentLevel: number): Decimal {
  const { base, growth } = UPGRADE_COSTS[stat]
  return new Decimal(base).mul(new Decimal(growth).pow(currentLevel))
}

export function computeOfflineGold(
  stats: { atkLevel: number; critLevel: number; spdLevel: number },
  offlineSeconds: number
): Decimal {
  if (offlineSeconds < 30) return new Decimal(0)
  const cappedSeconds = Math.min(offlineSeconds, MAX_OFFLINE_HOURS * 3600)
  const baseDamage = BASE_DAMAGE + stats.atkLevel * 5
  const attackSpeed = BASE_ATTACK_SPEED + stats.spdLevel * 0.05
  const offlineDps = baseDamage * attackSpeed
  return new Decimal(offlineDps * cappedSeconds * OFFLINE_RATE * GOLD_PER_DAMAGE)
}

export async function creditGold(
  prisma: PrismaClient,
  userId: string,
  amount: Decimal
): Promise<string> {
  const stats = await prisma.$transaction(async (tx: any) => {
    const existing = await tx.playerStats.upsert({
      where: { userId },
      update: {},
      create: { userId, goldBalance: '0' },
    })
    const newBalance = new Decimal(existing.goldBalance).add(amount)
    return tx.playerStats.update({
      where: { userId },
      data: { goldBalance: newBalance.toString() },
    })
  })
  return stats.goldBalance
}

export async function purchaseUpgrade(
  prisma: PrismaClient,
  userId: string,
  stat: StatKey
): Promise<{ success: boolean; stats?: any; error?: string }> {
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.playerStats.upsert({
        where: { userId },
        update: {},
        create: { userId, goldBalance: '0' },
      })
      const currentLevel = existing[`${stat}Level`] as number
      const cost = getUpgradeCost(stat, currentLevel)
      const balance = new Decimal(existing.goldBalance)
      if (balance.lt(cost)) {
        throw new Error('INSUFFICIENT_GOLD')
      }
      const newBalance = balance.sub(cost)
      return tx.playerStats.update({
        where: { userId },
        data: {
          goldBalance: newBalance.toString(),
          [`${stat}Level`]: { increment: 1 },
        },
      })
    })
    return { success: true, stats: result }
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_GOLD') {
      return { success: false, error: 'INSUFFICIENT_GOLD' }
    }
    throw err
  }
}

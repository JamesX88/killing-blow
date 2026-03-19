import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'
import type { BossState, ActivePlayer } from '@killing-blow/shared-types'

type RedisClient = ReturnType<typeof createClient>

const __dirname = dirname(fileURLToPath(import.meta.url))
const killClaimScript = readFileSync(join(__dirname, 'killClaim.lua'), 'utf8')

const BASE_DAMAGE = 25
const BOSS_MAX_HP = 1000
const TARGET_FIGHT_DURATION = 300  // 5 minutes
const MIN_BOSS_HP = 1000
const MAX_BOSS_HP = 10_000_000

export function getBaseDamage(): number {
  return BASE_DAMAGE
}

export async function applyDamage(
  redis: RedisClient,
  bossId: string,
  userId: string,
  damage: number,
  maxHp: number
): Promise<{ newHp: number; killed: boolean; winnerId: string }> {
  const threshold = Math.floor(maxHp * 0.01)

  const result = await redis.eval(killClaimScript, {
    keys: [
      `boss:${bossId}:hp`,
      `boss:${bossId}:damage`,
      `boss:${bossId}:last1pct`,
      `boss:${bossId}:killed`,
    ],
    arguments: [userId, String(damage), String(threshold)],
  }) as [number | string, number | string, string]

  const newHp = Number(result[0])
  const killed = Number(result[1]) === 1
  const winnerId = String(result[2])

  return { newHp, killed, winnerId }
}

export async function computeAggregateDps(
  redis: RedisClient,
  prisma: PrismaClient,
  bossId: string
): Promise<number> {
  const damageMap = await redis.hGetAll(`boss:${bossId}:damage`)
  const totalDamage = Object.values(damageMap).reduce((sum, v) => sum + Number(v), 0)

  const boss = await prisma.boss.findUnique({ where: { id: bossId } })
  if (!boss || !boss.defeatedAt) return 0

  const fightSeconds = (boss.defeatedAt.getTime() - boss.spawnedAt.getTime()) / 1000
  return fightSeconds > 0 ? totalDamage / fightSeconds : 0
}

export async function spawnNextBoss(
  redis: RedisClient,
  prisma: PrismaClient,
  prevBossNumber: number,
  overrideMaxHp?: number
): Promise<BossState> {
  const bossNumber = prevBossNumber + 1
  const name = `Boss #${bossNumber}`
  const maxHp = Math.round(
    Math.min(MAX_BOSS_HP, Math.max(MIN_BOSS_HP, overrideMaxHp != null && overrideMaxHp > 0 ? overrideMaxHp : BOSS_MAX_HP))
  )

  const boss = await prisma.boss.create({
    data: { bossNumber, name, maxHp },
  })

  const bossId = boss.id

  // Set live state keys
  await redis.set(`boss:${bossId}:hp`, String(maxHp))
  await redis.set(`boss:${bossId}:maxHp`, String(maxHp))
  await redis.set(`boss:${bossId}:meta`, JSON.stringify({ name, bossNumber }))
  await redis.set('boss:current', bossId)

  // Set expiry on all fight keys (24h)
  await redis.expire(`boss:${bossId}:hp`, 86400)
  await redis.expire(`boss:${bossId}:maxHp`, 86400)
  await redis.expire(`boss:${bossId}:meta`, 86400)

  return { bossId, name, hp: maxHp, maxHp, bossNumber }
}

export async function ensureActiveBoss(
  redis: RedisClient,
  prisma: PrismaClient
): Promise<void> {
  const current = await redis.get('boss:current')
  if (current) {
    // Boss exists — skip spawn only if it hasn't been killed yet
    const killed = await redis.get(`boss:${current}:killed`)
    if (!killed) return
    // Dead boss still in current slot — clear it and spawn fresh
    await redis.del('boss:current')
  }
  const lastBoss = await prisma.boss.findFirst({ orderBy: { bossNumber: 'desc' } })
  await spawnNextBoss(redis, prisma, lastBoss?.bossNumber ?? 0)
}

export async function getActivePlayers(
  redis: RedisClient,
  bossId: string
): Promise<ActivePlayer[]> {
  const damageMap = await redis.hGetAll(`boss:${bossId}:damage`)
  const usernameMap = await redis.hGetAll(`boss:${bossId}:usernames`)

  const players: ActivePlayer[] = Object.entries(damageMap).map(([userId, dmgStr]) => ({
    userId,
    username: usernameMap[userId] ?? userId,
    damageDealt: Number(dmgStr),
  }))

  players.sort((a, b) => b.damageDealt - a.damageDealt)

  return players
}

export async function getCurrentBossId(redis: RedisClient): Promise<string | null> {
  return redis.get('boss:current')
}

export async function getBossState(
  redis: RedisClient,
  bossId: string
): Promise<BossState | null> {
  const [hpStr, maxHpStr, metaStr] = await Promise.all([
    redis.get(`boss:${bossId}:hp`),
    redis.get(`boss:${bossId}:maxHp`),
    redis.get(`boss:${bossId}:meta`),
  ])

  if (hpStr === null || maxHpStr === null || metaStr === null) return null

  const meta = JSON.parse(metaStr) as { name: string; bossNumber: number }

  return {
    bossId,
    name: meta.name,
    hp: Number(hpStr),
    maxHp: Number(maxHpStr),
    bossNumber: meta.bossNumber,
  }
}

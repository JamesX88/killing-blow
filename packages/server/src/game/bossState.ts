import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { PrismaClient } from '@prisma/client'
import type { RedisClientType } from 'redis'
import type { BossState, ActivePlayer } from '@killing-blow/shared-types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const killClaimScript = readFileSync(join(__dirname, 'killClaim.lua'), 'utf8')

const BASE_DAMAGE = 25
const BOSS_MAX_HP = 1000

export function getBaseDamage(): number {
  return BASE_DAMAGE
}

export async function applyDamage(
  redis: RedisClientType,
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

export async function spawnNextBoss(
  redis: RedisClientType,
  prisma: PrismaClient,
  prevBossNumber: number
): Promise<BossState> {
  const bossNumber = prevBossNumber + 1
  const name = `Boss #${bossNumber}`
  const maxHp = BOSS_MAX_HP

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
  redis: RedisClientType,
  prisma: PrismaClient
): Promise<void> {
  const current = await redis.get('boss:current')
  if (current) return
  await spawnNextBoss(redis, prisma, 0)
}

export async function getActivePlayers(
  redis: RedisClientType,
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

export async function getCurrentBossId(redis: RedisClientType): Promise<string | null> {
  return redis.get('boss:current')
}

export async function getBossState(
  redis: RedisClientType,
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

/**
 * Reset all boss data so the next boss spawns as Boss #1 with proper HP scaling.
 * Run from repo root: node scripts/reset-bosses.mjs
 */
import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../packages/server/.env') })

const prisma = new PrismaClient()
const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' })

await redis.connect()

console.log('Clearing boss data from DB...')
await prisma.fightContribution.deleteMany()
await prisma.boss.deleteMany()
console.log('  ✓ DB cleared')

console.log('Clearing boss keys from Redis...')
const keys = await redis.keys('boss:*')
if (keys.length > 0) {
  await redis.del(keys)
  console.log(`  ✓ Deleted ${keys.length} Redis key(s)`)
} else {
  console.log('  ✓ No Redis boss keys found')
}

await prisma.$disconnect()
await redis.disconnect()

console.log('\nDone! Restart the server — next boss will be #1 with proper HP scaling.')

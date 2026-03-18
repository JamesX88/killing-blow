import 'dotenv/config'
import { buildApp } from './app.js'
import { Server as SocketIOServer } from 'socket.io'
import { setupGateway } from './ws/gateway.js'
import redisPlugin from './plugins/redis.js'
import { ensureActiveBoss } from './game/bossState.js'
import { prisma } from './db/prisma.js'

const app = await buildApp({ logger: true })

// Register Redis plugin before app.ready()
await app.register(redisPlugin)

await app.ready()

// Spawn initial boss if none exists (requires Redis to be available)
if (app.redis) {
  await ensureActiveBoss(app.redis, prisma)
}

// Attach Socket.IO to the underlying HTTP server AFTER app.ready()
const io = new SocketIOServer(app.server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5174', credentials: true }
})
setupGateway(io, app.redis)

await app.listen({ port: 3000, host: '0.0.0.0' })

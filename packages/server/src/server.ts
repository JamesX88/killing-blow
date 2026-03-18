import 'dotenv/config'
import { buildApp } from './app.js'
import { Server as SocketIOServer } from 'socket.io'
import { setupGateway } from './ws/gateway.js'
import redisPlugin from './plugins/redis.js'

const app = await buildApp({ logger: true })

// Register Redis plugin before app.ready()
await app.register(redisPlugin)

await app.ready()

// Attach Socket.IO to the underlying HTTP server AFTER app.ready()
const io = new SocketIOServer(app.server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }
})
setupGateway(io)

await app.listen({ port: 3000, host: '0.0.0.0' })

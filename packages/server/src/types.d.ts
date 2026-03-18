import 'fastify'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from 'redis'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    redis: ReturnType<typeof createClient> | undefined
  }
  interface FastifyRequest {
    user: { userId: string; username: string }
  }
}

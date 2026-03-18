import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { parse as parseCookie } from 'cookie'

export function setupGateway(io: Server) {
  // JWT middleware — validates token from cookie on WebSocket upgrade
  io.use((socket: Socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie
    if (!cookieHeader) return next(new Error('Authentication required'))

    const cookies = parseCookie(cookieHeader)
    const token = cookies.token
    if (!token) return next(new Error('Authentication required'))

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as {
        userId: string
        username: string
      }
      socket.data.userId = decoded.userId
      socket.data.username = decoded.username
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    // socket.data.userId is guaranteed here
    socket.join('global-boss-room')
    console.log(`Player connected: ${socket.data.username} (${socket.data.userId})`)

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.data.username}`)
    })
  })
}

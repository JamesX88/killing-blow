import { io } from 'socket.io-client'

export const socket = io(import.meta.env.VITE_SERVER_URL || '', {
  autoConnect: false,
  withCredentials: true
  // JWT is in HTTP-only cookie — browser sends it on WebSocket upgrade automatically
})

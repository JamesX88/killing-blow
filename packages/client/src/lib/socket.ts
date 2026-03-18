import { io } from 'socket.io-client'
import { useBossStore } from '../stores/bossStore.js'
import { usePlayerStore } from '../stores/playerStore.js'

export const socket = io(import.meta.env.VITE_SERVER_URL || '', {
  autoConnect: false,
  withCredentials: true
  // JWT is in HTTP-only cookie — browser sends it on WebSocket upgrade automatically
})

export function subscribeToGame() {
  socket.on('boss:hp_update', ({ hp }) => {
    useBossStore.getState().updateHp(hp)
  })
  socket.on('boss:spawn', (boss) => {
    useBossStore.getState().setBoss(boss)
  })
  socket.on('boss:death', ({ winnerUsername }) => {
    useBossStore.getState().markDefeated(winnerUsername || null)
  })
  socket.on('player:list_update', (players) => {
    usePlayerStore.getState().setPlayers(players)
  })
}

export function unsubscribeFromGame() {
  socket.off('boss:hp_update')
  socket.off('boss:spawn')
  socket.off('boss:death')
  socket.off('player:list_update')
  socket.off('boss:damage_dealt')
}

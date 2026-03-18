export interface BossState {
  bossId: string
  name: string
  hp: number
  maxHp: number
  bossNumber: number
}

export interface ActivePlayer {
  userId: string
  username: string
  damageDealt: number
}

export interface ServerToClientEvents {
  'boss:hp_update': (payload: { bossId: string; hp: number; maxHp: number }) => void
  'boss:damage_dealt': (payload: { amount: number; hitId: string }) => void
  'boss:death': (payload: { bossId: string; winnerId: string; winnerUsername: string }) => void
  'boss:spawn': (payload: BossState) => void
  'player:list_update': (payload: ActivePlayer[]) => void
}

export interface ClientToServerEvents {
  'attack:intent': (payload: { bossId: string }) => void
}

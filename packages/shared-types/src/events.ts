export interface BossState {
  bossId: string
  name: string
  lore?: string
  hp: number
  maxHp: number
  bossNumber: number
}

export interface ActivePlayer {
  userId: string
  username: string
  damageDealt: number
  equippedTitle: string | null
}

export interface ContributorEntry {
  username: string
  damageDealt: number
  title: string | null
}

export interface ServerToClientEvents {
  'boss:hp_update': (payload: { bossId: string; hp: number; maxHp: number }) => void
  'boss:damage_dealt': (payload: { amount: number; hitId: string }) => void
  'boss:death': (payload: {
    bossId: string
    winnerId: string
    winnerUsername: string
    winnerTitle: string | null
    winnerKillCount: number
    topContributors: ContributorEntry[]
  }) => void
  'boss:spawn': (payload: BossState) => void
  'player:list_update': (payload: ActivePlayer[]) => void
  'player:gold_update': (payload: { goldBalance: string; goldEarned: string }) => void
  'player:stats_update': (payload: { atkLevel: number; critLevel: number; spdLevel: number; goldBalance: string }) => void
  'player:offline_reward': (payload: { goldEarned: string; offlineSeconds: number }) => void
}

export interface ClientToServerEvents {
  'attack:intent': (payload: { bossId: string }) => void
  'player:heartbeat': () => void
}

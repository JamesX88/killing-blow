import { create } from 'zustand'
import type { BossState } from '@killing-blow/shared-types'

interface BossStoreState extends BossState {
  isDefeated: boolean
  defeatMessage: string | null
  setBoss: (boss: BossState) => void
  updateHp: (hp: number) => void
  markDefeated: (winnerUsername: string | null) => void
}

export const useBossStore = create<BossStoreState>((set) => ({
  bossId: '',
  name: '',
  lore: '',
  hp: 0,
  maxHp: 1,
  bossNumber: 0,
  isDefeated: false,
  defeatMessage: null,

  setBoss: (boss) => set({ ...boss, isDefeated: false, defeatMessage: null }),
  updateHp: (hp) => set({ hp }),
  markDefeated: (winnerUsername) => set({
    isDefeated: true,
    defeatMessage: winnerUsername
      ? `Defeated by ${winnerUsername} \u2014 new boss spawning...`
      : 'Defeated \u2014 new boss spawning...'
  })
}))

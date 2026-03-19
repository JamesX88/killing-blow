import { create } from 'zustand'
import { Decimal } from '@killing-blow/shared-types'

interface ProgressionState {
  goldBalance: string
  atkLevel: number
  critLevel: number
  spdLevel: number
  isTabActive: boolean
  offlineReward: { goldEarned: string; offlineSeconds: number } | null
  setStats: (stats: Partial<Omit<ProgressionState, 'setStats' | 'addGold' | 'setGoldBalance' | 'dismissOfflineReward'>>) => void
  addGold: (amount: string) => void
  setGoldBalance: (balance: string) => void
  dismissOfflineReward: () => void
}

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  goldBalance: '0',
  atkLevel: 0,
  critLevel: 0,
  spdLevel: 0,
  isTabActive: true,
  offlineReward: null,
  setStats: (stats) => set(stats),
  addGold: (amount) => {
    const newBalance = new Decimal(get().goldBalance).add(new Decimal(amount))
    set({ goldBalance: newBalance.toString() })
  },
  setGoldBalance: (balance) => set({ goldBalance: balance }),
  dismissOfflineReward: () => set({ offlineReward: null }),
}))

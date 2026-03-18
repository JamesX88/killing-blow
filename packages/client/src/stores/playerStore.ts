import { create } from 'zustand'
import type { ActivePlayer } from '@killing-blow/shared-types'

interface PlayerStoreState {
  activePlayers: ActivePlayer[]
  setPlayers: (players: ActivePlayer[]) => void
}

export const usePlayerStore = create<PlayerStoreState>((set) => ({
  activePlayers: [],
  setPlayers: (players) => set({ activePlayers: players })
}))

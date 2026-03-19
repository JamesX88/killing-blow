import { create } from 'zustand'
import type { ContributorEntry } from '@killing-blow/shared-types'

interface AnnouncementState {
  active: boolean
  winnerId: string | null
  winnerUsername: string | null
  winnerTitle: string | null
  winnerKillCount: number
  topContributors: ContributorEntry[]
  setAnnouncement: (data: {
    winnerId: string
    winnerUsername: string
    winnerTitle: string | null
    winnerKillCount: number
    topContributors: ContributorEntry[]
  }) => void
  clearAnnouncement: () => void
}

export const useAnnouncementStore = create<AnnouncementState>((set) => ({
  active: false,
  winnerId: null,
  winnerUsername: null,
  winnerTitle: null,
  winnerKillCount: 0,
  topContributors: [],
  setAnnouncement: (data) => set({ active: true, ...data }),
  clearAnnouncement: () => set({
    active: false,
    winnerId: null,
    winnerUsername: null,
    winnerTitle: null,
    winnerKillCount: 0,
    topContributors: [],
  }),
}))

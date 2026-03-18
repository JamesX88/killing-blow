import { create } from 'zustand'

interface Session {
  userId: string | null
  username: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface SessionActions {
  setSession: (userId: string, username: string) => void
  clearSession: () => void
  setLoading: (loading: boolean) => void
  checkSession: () => Promise<void>
}

export const useSessionStore = create<Session & SessionActions>((set) => ({
  userId: null,
  username: null,
  isAuthenticated: false,
  isLoading: true,

  setSession: (userId, username) =>
    set({ userId, username, isAuthenticated: true, isLoading: false }),

  clearSession: () =>
    set({ userId: null, username: null, isAuthenticated: false, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  checkSession: async () => {
    try {
      const res = await fetch('/auth/me', { credentials: 'include' })
      if (res.ok) {
        const user = await res.json()
        set({ userId: user.id, username: user.username, isAuthenticated: true, isLoading: false })
      } else {
        set({ isAuthenticated: false, isLoading: false })
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false })
    }
  }
}))

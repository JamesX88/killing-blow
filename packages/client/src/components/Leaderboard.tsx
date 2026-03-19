import { useState, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore.js'
import { Button } from './ui/button.js'

interface LeaderboardUser {
  id: string
  username: string
  killCount: number
  equippedTitle: string | null
}

export function Leaderboard() {
  const { userId } = useSessionStore()
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const limit = 20

  useEffect(() => {
    setError(null)
    fetch(`/leaderboard?page=${page}&limit=${limit}`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(data => {
        setUsers(data.users)
        setTotal(data.total)
      })
      .catch(() => setError('Could not load leaderboard. Refresh to try again.'))
  }, [page])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">Killing Blow Leaderboard</h1>

      {error && (
        <p className="text-sm text-destructive mb-4">{error}</p>
      )}

      {!error && users.length === 0 && (
        <div className="text-center py-16">
          <h2 className="text-base font-bold text-foreground mb-2">No kills yet</h2>
          <p className="text-sm text-muted-foreground">Be the first to land the killing blow.</p>
        </div>
      )}

      {users.length > 0 && (
        <div
          className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-4"
          style={{ boxShadow: 'var(--panel-border-glow)' }}
        >
          {/* Column headers */}
          <div className="grid grid-cols-[3rem_1fr_8rem_4rem] gap-2 px-4 py-2 text-sm font-bold text-muted-foreground border-b border-white/10">
            <span>Rank</span>
            <span>Player</span>
            <span>Title</span>
            <span className="text-right">Kills</span>
          </div>

          {/* Rows */}
          <ul>
            {users.map((user, i) => {
              const rank = (page - 1) * limit + i + 1
              const isCurrentUser = user.id === userId
              const isFirst = rank === 1
              return (
                <li
                  key={user.id}
                  className={`grid grid-cols-[3rem_1fr_8rem_4rem] gap-2 px-4 py-3 text-sm border-b border-white/10 ${
                    isCurrentUser ? 'bg-primary/10' : ''
                  }`}
                >
                  <span className={`font-mono ${isFirst ? 'text-yellow-400 font-bold' : 'text-muted-foreground'}`}>
                    {rank}
                  </span>
                  <span className={`truncate ${isFirst ? 'text-yellow-400 font-bold' : 'text-foreground'}`}>
                    {user.username}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {user.equippedTitle ? `[${user.equippedTitle}]` : ''}
                  </span>
                  <span className="text-right font-bold text-foreground font-mono">
                    {user.killCount}
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Back to game link */}
      <div className="mt-8 text-center">
        <a href="/game" className="text-sm text-muted-foreground hover:text-foreground underline">
          Back to Game
        </a>
      </div>
    </div>
  )
}

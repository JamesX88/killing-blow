import type { ActivePlayer } from '@killing-blow/shared-types'
import { formatNumber, Decimal } from '@killing-blow/shared-types'

interface PlayerSidebarProps {
  players: ActivePlayer[]
}

export function PlayerSidebar({ players }: PlayerSidebarProps) {
  return (
    <div className="w-64 flex-shrink-0">
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-zinc-50 mb-4">In the Fight</h2>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">Waiting for players...</p>
        ) : (
          <ul className="space-y-2">
            {players.map(player => (
              <li key={player.userId} className="flex items-center justify-between">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-sm text-zinc-300 truncate">{player.username}</span>
                  {player.equippedTitle && (
                    <span className="text-sm text-muted-foreground flex-shrink-0">[{player.equippedTitle}]</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-zinc-50 flex-shrink-0">
                  {formatNumber(new Decimal(player.damageDealt))} dmg
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

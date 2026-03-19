import { useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore.js'
import { useBossStore } from '../stores/bossStore.js'
import { usePlayerStore } from '../stores/playerStore.js'
import { useProgressionStore } from '../stores/progressionStore.js'
import { socket, subscribeToGame, unsubscribeFromGame } from '../lib/socket.js'
import { BossHpBar } from '../components/BossHpBar.js'
import { BossSprite } from '../components/BossSprite.js'
import { DamageNumbers } from '../components/DamageNumbers.js'
import { PlayerSidebar } from '../components/PlayerSidebar.js'
import { UpgradePanel } from '../components/UpgradePanel.js'
import { OfflineRewardToast } from '../components/OfflineRewardToast.js'
import { Button } from '../components/ui/button.js'

export default function Game() {
  const { isAuthenticated } = useSessionStore()
  const { bossId, name, hp, maxHp, bossNumber, isDefeated, defeatMessage } = useBossStore()
  const { activePlayers } = usePlayerStore()

  // Connect socket and subscribe to game events on mount
  useEffect(() => {
    if (!isAuthenticated) return

    socket.connect()
    subscribeToGame()

    // Fetch initial boss state via HTTP
    fetch('/boss/current', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          const { activePlayers, ...boss } = data
          useBossStore.getState().setBoss(boss)
          if (activePlayers) usePlayerStore.getState().setPlayers(activePlayers)
        }
      })
      .catch(() => {})

    return () => {
      unsubscribeFromGame()
      socket.disconnect()
    }
  }, [isAuthenticated])

  // Tab heartbeat for active-play bonus
  useEffect(() => {
    if (!isAuthenticated) return

    const sendHeartbeat = () => {
      if (!document.hidden && socket.connected) {
        socket.emit('player:heartbeat')
      }
    }

    sendHeartbeat() // immediate on mount

    const interval = setInterval(sendHeartbeat, 5000)
    document.addEventListener('visibilitychange', sendHeartbeat)

    // Track isTabActive in progression store
    const handleVisibility = () => {
      useProgressionStore.getState().setStats({ isTabActive: !document.hidden })
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', sendHeartbeat)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isAuthenticated])

  // Loading state — return null until bossId is populated (same as Profile.tsx pattern)
  if (!isAuthenticated || !bossId) return null

  const handleAttack = () => {
    if (isDefeated) return
    socket.emit('attack:intent', { bossId })
  }

  return (
    <>
      <div className="min-h-screen flex flex-wrap lg:flex-nowrap gap-8 p-8">
        {/* Boss Area */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            {/* Boss Name */}
            <h1 className="text-xl font-semibold text-zinc-50 mb-2">{name}</h1>

            {/* Boss Sprite + Damage Numbers */}
            <div className="relative">
              <BossSprite bossNumber={bossNumber} isDefeated={isDefeated} />
              <DamageNumbers />
            </div>

            {/* Defeat Overlay */}
            {isDefeated && defeatMessage && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                {defeatMessage}
              </p>
            )}
          </div>

          {/* HP Bar */}
          <BossHpBar hp={hp} maxHp={maxHp} />

          {/* Attack Button */}
          <Button
            onClick={handleAttack}
            disabled={isDefeated}
            className="min-h-[44px] text-base font-semibold"
            aria-label="Attack the boss"
          >
            Attack Boss
          </Button>
        </div>

        {/* Upgrade Panel */}
        <UpgradePanel />

        {/* Player Sidebar */}
        <PlayerSidebar players={activePlayers} />
      </div>

      {/* Offline Reward Toast (outside main layout, fixed positioned) */}
      <OfflineRewardToast />
    </>
  )
}

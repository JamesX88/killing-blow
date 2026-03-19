import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Trophy } from 'lucide-react'
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
import { KillingBlowAnnouncement } from '../components/KillingBlowAnnouncement.js'
import { TitleShop } from '../components/TitleShop.js'
import { DungeonBackground } from '../components/DungeonBackground.js'
import { KillFlashOverlay } from '../components/KillFlashOverlay.js'
import { Button } from '../components/ui/button.js'

export default function Game() {
  const { isAuthenticated } = useSessionStore()
  const { bossId, name, lore, hp, maxHp, bossNumber, isDefeated, defeatMessage } = useBossStore()
  const { activePlayers } = usePlayerStore()
  const { spdLevel } = useProgressionStore()

  const [killFlashActive, setKillFlashActive] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'upgrades' | 'titles' | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'upgrades' | 'titles' | 'players'>('upgrades')
  const contentRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

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

  // Auto-attack loop — interval matches server-side attackDelay for the player's SPD level
  useEffect(() => {
    if (!isAuthenticated) return
    const attackDelay = Math.max(50, Math.floor(1000 / (1.0 + spdLevel * 0.05)))
    const interval = setInterval(() => {
      const boss = useBossStore.getState()
      if (boss.bossId && !boss.isDefeated && socket.connected && !document.hidden) {
        socket.emit('attack:intent', { bossId: boss.bossId })
      }
    }, attackDelay)
    return () => clearInterval(interval)
  }, [isAuthenticated, spdLevel])

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

  // Kill flash + screen shake on boss:death
  // CRITICAL: Trigger from socket event directly, NOT from zustand isDefeated state.
  // This avoids the race condition where isDefeated is stale on remount (see RESEARCH.md Pitfall 4).
  useEffect(() => {
    const handleDeath = () => {
      setKillFlashActive(true)
      setTimeout(() => setKillFlashActive(false), 600)
      // Screen shake on content layer (not root -- see Pitfall 3)
      if (contentRef.current && !prefersReducedMotion) {
        contentRef.current.classList.add('screen-shake')
        setTimeout(() => contentRef.current?.classList.remove('screen-shake'), 400)
      }
    }
    socket.on('boss:death', handleDeath)
    return () => { socket.off('boss:death', handleDeath) }
  }, [prefersReducedMotion])

  // Loading state — atmospheric dungeon loading screen
  if (!isAuthenticated || !bossId) {
    return (
      <div className="relative h-dvh overflow-hidden flex items-center justify-center">
        <DungeonBackground />
        <p className="relative z-10 text-[28px] font-bold text-muted-foreground">Summoning...</p>
      </div>
    )
  }

  const handleAttack = () => {
    if (isDefeated) return
    socket.emit('attack:intent', { bossId })
  }

  return (
    <>
      <div className="relative h-dvh overflow-hidden">
        {/* Layer 0: Dungeon background */}
        <DungeonBackground />

        {/* Layer 10: Game content -- screen shake applies here */}
        <div ref={contentRef} className="relative z-10 h-full flex flex-col lg:flex-row">

          {/* Boss zone -- fills available space */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 pt-4 pb-20 lg:pb-4 min-w-0">
            {/* Leaderboard nav -- top right trophy icon */}
            <div className="absolute top-4 right-4 z-20">
              <a
                href="/leaderboard"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Leaderboard"
              >
                <Trophy className="w-5 h-5" />
              </a>
            </div>

            {/* Boss Name + Lore */}
            <div className="text-center">
              <h1
                className="text-[28px] font-bold text-foreground leading-[1.1]"
                style={{ textShadow: '0 0 20px rgba(220, 38, 38, 0.6)' }}
              >
                {name}
              </h1>
              {lore && (
                <p className="text-[14px] text-muted-foreground mt-1">{lore}</p>
              )}
            </div>

            {/* Boss Sprite + Damage Numbers */}
            <div className="relative flex-1 flex items-center justify-center w-full max-w-[400px]">
              <BossSprite bossNumber={bossNumber} isDefeated={isDefeated} />
              <DamageNumbers />
            </div>

            {/* Defeat Message */}
            {isDefeated && defeatMessage && (
              <p className="text-[14px] text-muted-foreground text-center">
                {defeatMessage}
              </p>
            )}

            {/* HP Bar */}
            <div className="w-full max-w-[400px]">
              <BossHpBar hp={hp} maxHp={maxHp} />
            </div>

            {/* Attack Button */}
            <Button
              onClick={handleAttack}
              disabled={isDefeated}
              className="min-h-[64px] w-full max-w-[320px] text-base font-bold active:scale-95 transition-all"
              style={{ boxShadow: '0 0 24px rgba(220,38,38,0.5), 0 0 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' }}
              aria-label="Attack the boss"
            >
              Attack
            </Button>
          </div>

          {/* Desktop right sidebar -- tabbed, hidden on mobile */}
          <div className="hidden lg:flex flex-col w-72 p-4 gap-3">
            {/* Tab strip */}
            <div
              className="flex bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden flex-shrink-0"
              style={{ boxShadow: 'var(--panel-border-glow)' }}
            >
              {(['upgrades', 'titles', 'players'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-2.5 text-[12px] font-bold capitalize transition-colors ${
                    sidebarTab === tab
                      ? 'bg-white/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'players' ? `Players (${activePlayers.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            {/* Active panel -- fades between tabs */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={sidebarTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {sidebarTab === 'upgrades' && <UpgradePanel />}
                  {sidebarTab === 'titles' && <TitleShop />}
                  {sidebarTab === 'players' && <PlayerSidebar players={activePlayers} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Layer 20: Mobile bottom tab bar -- visible only on mobile */}
        <div className="fixed bottom-0 left-0 right-0 z-20 h-12 flex lg:hidden border-t border-white/10 bg-black/60 backdrop-blur-sm">
          <button
            className={`flex-1 text-[14px] font-bold transition-colors ${drawerTab === 'upgrades' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setDrawerTab(drawerTab === 'upgrades' ? null : 'upgrades')}
          >
            Upgrades
          </button>
          <button
            className={`flex-1 text-[14px] font-bold transition-colors ${drawerTab === 'titles' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={() => setDrawerTab(drawerTab === 'titles' ? null : 'titles')}
          >
            Titles
          </button>
        </div>

        {/* Layer 20: Mobile drawer -- slides up when tab active */}
        <AnimatePresence>
          {drawerTab && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed bottom-12 left-0 right-0 z-20 h-[60vh] lg:hidden bg-black/90 backdrop-blur-sm border-t border-white/10 overflow-y-auto p-4"
            >
              {drawerTab === 'upgrades' ? <UpgradePanel /> : <TitleShop />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Layer 40: Kill flash overlay */}
        <KillFlashOverlay active={killFlashActive} />

        {/* Layer 50: KBA already at z-50 (positioned fixed in its own component) */}
      </div>

      {/* Outside viewport container -- fixed positioned independently */}
      <OfflineRewardToast />
      <KillingBlowAnnouncement />
    </>
  )
}

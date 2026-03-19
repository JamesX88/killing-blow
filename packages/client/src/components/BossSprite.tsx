import { motion, AnimatePresence } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { useState, useEffect } from 'react'
import { socket } from '../lib/socket.js'

interface BossSpriteProps {
  bossNumber: number
  isDefeated: boolean
}

const SILHOUETTES = [
  // 0: Dragon — large winged serpent silhouette
  <svg key="dragon" viewBox="0 0 200 200" className="w-[200px] h-[200px] lg:w-[280px] lg:h-[280px]" style={{ filter: 'drop-shadow(0 0 16px rgba(220,38,38,0.5))' }} aria-hidden="true">
    <path
      d="M100 160 L60 130 L30 100 L20 70 L40 50 L60 60 L70 80 L80 70 L75 40 L90 30 L100 50 L110 30 L125 40 L120 70 L130 80 L140 60 L160 50 L180 70 L170 100 L140 130 Z"
      fill="#1a1a1a"
    />
    <path
      d="M60 130 L10 150 L40 120 Z M140 130 L190 150 L160 120 Z"
      fill="#1a1a1a"
    />
    <path
      d="M85 90 L95 110 L105 110 L115 90 L100 95 Z"
      fill="#2a2a2a"
    />
    <circle cx="85" cy="65" r="4" fill="#dc2626" />
    <circle cx="115" cy="65" r="4" fill="#dc2626" />
  </svg>,

  // 1: Golem — massive blocky humanoid
  <svg key="golem" viewBox="0 0 200 200" className="w-[200px] h-[200px] lg:w-[280px] lg:h-[280px]" style={{ filter: 'drop-shadow(0 0 16px rgba(220,38,38,0.5))' }} aria-hidden="true">
    <rect x="65" y="30" width="70" height="60" rx="4" fill="#1a1a1a" />
    <rect x="55" y="95" width="90" height="70" rx="4" fill="#1a1a1a" />
    <rect x="30" y="95" width="30" height="65" rx="4" fill="#1a1a1a" />
    <rect x="140" y="95" width="30" height="65" rx="4" fill="#1a1a1a" />
    <rect x="65" y="165" width="28" height="35" rx="3" fill="#1a1a1a" />
    <rect x="107" y="165" width="28" height="35" rx="3" fill="#1a1a1a" />
    <rect x="80" y="45" width="14" height="14" rx="2" fill="#dc2626" />
    <rect x="106" y="45" width="14" height="14" rx="2" fill="#dc2626" />
    <rect x="75" y="68" width="50" height="8" rx="2" fill="#2a0000" />
  </svg>,

  // 2: Wraith — wispy spectral form
  <svg key="wraith" viewBox="0 0 200 200" className="w-[200px] h-[200px] lg:w-[280px] lg:h-[280px]" style={{ filter: 'drop-shadow(0 0 16px rgba(220,38,38,0.5))' }} aria-hidden="true">
    <path
      d="M100 20 C70 20, 50 40, 50 70 C50 100, 45 120, 40 140 C35 160, 30 175, 35 185 C45 175, 50 165, 60 170 C65 160, 70 150, 80 155 C85 145, 90 140, 100 145 C110 140, 115 145, 120 155 C130 150, 135 160, 140 170 C150 165, 155 175, 165 185 C170 175, 165 160, 160 140 C155 120, 150 100, 150 70 C150 40, 130 20, 100 20 Z"
      fill="#1a1a1a"
    />
    <ellipse cx="82" cy="60" rx="8" ry="10" fill="#dc2626" />
    <ellipse cx="118" cy="60" rx="8" ry="10" fill="#dc2626" />
    <path d="M85 90 Q100 100 115 90" stroke="#3a0000" strokeWidth="3" fill="none" />
    <path d="M65 30 Q55 15 45 25" stroke="#1a1a1a" strokeWidth="8" strokeLinecap="round" fill="none" />
    <path d="M135 30 Q145 15 155 25" stroke="#1a1a1a" strokeWidth="8" strokeLinecap="round" fill="none" />
  </svg>,

  // 3: Spider — eight-legged horror
  <svg key="spider" viewBox="0 0 200 200" className="w-[200px] h-[200px] lg:w-[280px] lg:h-[280px]" style={{ filter: 'drop-shadow(0 0 16px rgba(220,38,38,0.5))' }} aria-hidden="true">
    <ellipse cx="100" cy="95" rx="35" ry="30" fill="#1a1a1a" />
    <ellipse cx="100" cy="65" rx="22" ry="18" fill="#1a1a1a" />
    <line x1="65" y1="85" x2="15" y2="65" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
    <line x1="65" y1="95" x2="10" y2="95" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
    <line x1="65" y1="105" x2="15" y2="130" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
    <line x1="65" y1="115" x2="25" y2="150" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
    <line x1="135" y1="85" x2="185" y2="65" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
    <line x1="135" y1="95" x2="190" y2="95" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
    <line x1="135" y1="105" x2="185" y2="130" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
    <line x1="135" y1="115" x2="175" y2="150" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
    <circle cx="90" cy="60" r="5" fill="#dc2626" />
    <circle cx="102" cy="57" r="5" fill="#dc2626" />
    <circle cx="114" cy="60" r="5" fill="#dc2626" />
    <circle cx="85" cy="70" r="4" fill="#dc2626" />
    <circle cx="115" cy="70" r="4" fill="#dc2626" />
    <path d="M88 78 Q100 85 112 78" stroke="#2a0000" strokeWidth="2" fill="none" />
    <path d="M95 140 Q100 170 105 140" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" fill="none" />
  </svg>,

  // 4: Lich — undead sorcerer with staff
  <svg key="lich" viewBox="0 0 200 200" className="w-[200px] h-[200px] lg:w-[280px] lg:h-[280px]" style={{ filter: 'drop-shadow(0 0 16px rgba(220,38,38,0.5))' }} aria-hidden="true">
    <ellipse cx="100" cy="45" rx="20" ry="22" fill="#1a1a1a" />
    <rect x="80" y="65" width="40" height="55" rx="3" fill="#1a1a1a" />
    <path d="M80 75 L50 95 L45 130 L60 125 L65 100 Z" fill="#1a1a1a" />
    <path d="M120 75 L150 95 L155 130 L140 125 L135 100 Z" fill="#1a1a1a" />
    <rect x="85" y="120" width="13" height="50" rx="3" fill="#1a1a1a" />
    <rect x="102" y="120" width="13" height="50" rx="3" fill="#1a1a1a" />
    <line x1="155" y1="120" x2="155" y2="30" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
    <circle cx="155" cy="25" r="10" fill="#1a1a1a" />
    <circle cx="155" cy="25" r="6" fill="#dc2626" />
    <rect x="88" y="38" width="9" height="12" rx="1" fill="#dc2626" />
    <rect x="103" y="38" width="9" height="12" rx="1" fill="#dc2626" />
    <path d="M90 60 Q100 65 110 60" stroke="#2a0000" strokeWidth="3" fill="none" />
    <path d="M75 20 L80 10 L85 20" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M115 20 L120 10 L125 20" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" fill="none" />
  </svg>,
]

export function BossSprite({ bossNumber, isDefeated }: BossSpriteProps) {
  const prefersReducedMotion = useReducedMotion()
  const [hitFlash, setHitFlash] = useState(false)

  useEffect(() => {
    const handler = () => {
      setHitFlash(true)
      setTimeout(() => setHitFlash(false), 80)
    }
    socket.on('boss:damage_dealt', handler)
    return () => {
      socket.off('boss:damage_dealt', handler)
    }
  }, [])

  const silhouette = SILHOUETTES[bossNumber % 5]

  const breatheAnimation = prefersReducedMotion
    ? {}
    : { animate: { scale: [1, 1.02, 1] }, transition: { duration: 3, ease: 'easeInOut' as const, repeat: Infinity } }

  const deathAnimation = isDefeated
    ? { scale: 1.4, opacity: 0, filter: 'drop-shadow(0 0 24px rgba(220,38,38,0.9))' }
    : { scale: 1, opacity: 1 }

  return (
    <div className="relative flex items-center justify-center min-h-[200px] lg:min-h-[280px]" aria-hidden="true">
      <AnimatePresence mode="wait">
        <motion.div
          key={bossNumber}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isDefeated ? deathAnimation : (prefersReducedMotion ? { scale: 1, opacity: 1 } : { scale: [1, 1.02, 1], opacity: 1 })}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={
            isDefeated
              ? { duration: 0.4, ease: 'easeOut' }
              : prefersReducedMotion
              ? { duration: 0.3, ease: 'easeIn' }
              : { duration: 3, ease: 'easeInOut', repeat: Infinity }
          }
          className={hitFlash ? 'boss-hit-flash' : ''}
        >
          {silhouette}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

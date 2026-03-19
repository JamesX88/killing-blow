import { motion, AnimatePresence } from 'motion/react'
import { formatNumber, Decimal } from '@killing-blow/shared-types'
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket.js'

interface Hit {
  hitId: string
  amount: number
  xOffset: number
}

export function DamageNumbers() {
  const [hits, setHits] = useState<Hit[]>([])

  useEffect(() => {
    const handler = ({ amount, hitId }: { amount: number; hitId: string }) => {
      const xOffset = (Math.random() - 0.5) * 40
      setHits(prev => [...prev, { hitId, amount, xOffset }])
      setTimeout(() => {
        setHits(prev => prev.filter(h => h.hitId !== hitId))
      }, 1200)
    }
    socket.on('boss:damage_dealt', handler)
    return () => { socket.off('boss:damage_dealt', handler) }
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <AnimatePresence>
        {hits.map(hit => {
          const isCrit = hit.amount >= 75
          return (
            <motion.div
              key={hit.hitId}
              initial={{ opacity: 0, scale: 1.2, y: 0 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [1.2, 1.0, 0.8], y: -80 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, times: [0, 0.1, 0.7, 1], ease: 'easeOut' }}
              className={`absolute font-bold top-1/2 ${isCrit ? 'text-[28px] text-yellow-400' : 'text-[20px] text-white'}`}
              style={{
                left: `calc(50% + ${hit.xOffset}px)`,
                transform: 'translateX(-50%)',
                ...(isCrit ? { textShadow: '0 0 8px rgba(245,158,11,0.8)' } : {}),
              }}
            >
              -{formatNumber(new Decimal(hit.amount))}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

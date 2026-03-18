import { motion, AnimatePresence } from 'motion/react'
import { formatNumber, Decimal } from '@killing-blow/shared-types'
import { useEffect, useState } from 'react'
import { socket } from '../lib/socket.js'

interface Hit {
  hitId: string
  amount: number
}

export function DamageNumbers() {
  const [hits, setHits] = useState<Hit[]>([])

  useEffect(() => {
    const handler = ({ amount, hitId }: { amount: number; hitId: string }) => {
      setHits(prev => [...prev, { hitId, amount }])
      setTimeout(() => {
        setHits(prev => prev.filter(h => h.hitId !== hitId))
      }, 1200)
    }
    socket.on('boss:damage_dealt', handler)
    return () => { socket.off('boss:damage_dealt', handler) }
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {hits.map(hit => (
          <motion.div
            key={hit.hitId}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -60 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            className="absolute text-yellow-400 font-semibold text-xl left-1/2 -translate-x-1/2 top-1/2"
          >
            -{formatNumber(new Decimal(hit.amount))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

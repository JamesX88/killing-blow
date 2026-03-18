import { motion, AnimatePresence } from 'motion/react'

interface BossSpriteProps {
  bossNumber: number
  isDefeated: boolean
}

export function BossSprite({ bossNumber, isDefeated }: BossSpriteProps) {
  return (
    <div className="relative flex items-center justify-center h-48" aria-hidden="true">
      <AnimatePresence mode="wait">
        <motion.div
          key={bossNumber}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: isDefeated ? 0 : 1,
            scale: isDefeated ? 1.2 : 1
          }}
          exit={{ opacity: 0, scale: 1.2 }}
          transition={{ duration: isDefeated ? 0.4 : 0.3, ease: isDefeated ? 'easeOut' : 'easeIn' }}
          className="flex items-center justify-center w-32 h-32 rounded-full bg-zinc-800 border-2 border-zinc-700 text-4xl font-bold text-zinc-400"
        >
          #{bossNumber}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

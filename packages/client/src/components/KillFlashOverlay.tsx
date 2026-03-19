import { motion, AnimatePresence } from 'motion/react'

interface KillFlashOverlayProps {
  active: boolean
}

export function KillFlashOverlay({ active }: KillFlashOverlayProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-40 pointer-events-none"
          style={{ backgroundColor: 'var(--kill-flash-color)' }}
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  )
}

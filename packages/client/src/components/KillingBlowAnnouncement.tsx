import { useAnnouncementStore } from '../stores/announcementStore.js'
import { formatNumber, Decimal } from '@killing-blow/shared-types'
import { motion, AnimatePresence } from 'motion/react'

export function KillingBlowAnnouncement() {
  const { active, winnerUsername, winnerTitle, winnerKillCount, topContributors } =
    useAnnouncementStore()

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kb-announcement-title"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70" />

          {/* Content */}
          <div className="relative bg-card border border-border rounded-lg p-8 shadow-xl w-96 flex flex-col items-center gap-4 text-center">
            {/* Headline */}
            <h2
              id="kb-announcement-title"
              className="text-[28px] font-semibold text-foreground leading-[1.1]"
            >
              Killing Blow!
            </h2>

            {/* Winner name — primary accent */}
            <p className="text-[20px] font-semibold text-primary leading-[1.2]">
              {winnerUsername} dealt the final blow
            </p>

            {/* Winner title badge (if equipped) */}
            {winnerTitle && (
              <span className="text-[14px] text-muted-foreground">[{winnerTitle}]</span>
            )}

            {/* Kill count */}
            <p className="text-[28px] font-semibold text-foreground leading-[1.1]">
              Kill #{winnerKillCount}
            </p>

            {/* Top Contributors — PostFightScreen embedded */}
            {topContributors.length > 0 && (
              <div className="w-full mt-4 border-t border-border pt-4">
                <h3 className="text-[16px] font-semibold text-foreground mb-3">Top Contributors</h3>
                <ul className="space-y-2">
                  {topContributors.map((c, i) => (
                    <li key={c.username} className="flex items-center justify-between text-[14px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground w-6">{i + 1}.</span>
                        <span className="text-foreground truncate max-w-[140px]">{c.username}</span>
                        {c.title && (
                          <span className="text-muted-foreground">[{c.title}]</span>
                        )}
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatNumber(new Decimal(c.damageDealt))} dmg
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

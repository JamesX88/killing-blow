import { useProgressionStore } from '../stores/progressionStore.js'
import { formatNumber, Decimal } from '@killing-blow/shared-types'
import { Button } from './ui/button.js'

export function OfflineRewardToast() {
  const offlineReward = useProgressionStore((s) => s.offlineReward)
  const dismissOfflineReward = useProgressionStore((s) => s.dismissOfflineReward)

  if (!offlineReward) return null

  const hours = Math.floor(offlineReward.offlineSeconds / 3600)
  const minutes = Math.floor((offlineReward.offlineSeconds % 3600) / 60)
  const seconds = offlineReward.offlineSeconds % 60
  const timeAway = hours > 0
    ? `${hours}h ${minutes}m`
    : minutes > 0
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`
  const goldFormatted = formatNumber(new Decimal(offlineReward.goldEarned))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-reward-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg p-8 shadow-xl w-80 flex flex-col items-center gap-4 text-center">
        <p className="text-[28px]">💰</p>
        <h2 id="offline-reward-title" className="text-[22px] font-semibold text-zinc-50 leading-[1.2]">
          Welcome back!
        </h2>
        <p className="text-[14px] text-muted-foreground leading-[1.5]">
          You were away for <span className="text-zinc-300 font-medium">{timeAway}</span>
        </p>
        <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-md px-6 py-3">
          <p className="text-[13px] text-muted-foreground mb-1">Gold earned while offline</p>
          <p className="text-[32px] font-semibold text-yellow-400 leading-[1.1]">{goldFormatted}</p>
        </div>
        <Button onClick={dismissOfflineReward} className="w-full min-h-[44px] text-base font-semibold mt-2">
          Collect!
        </Button>
      </div>
    </div>
  )
}

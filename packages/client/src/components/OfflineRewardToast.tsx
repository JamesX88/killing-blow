import { useEffect } from 'react'
import { useProgressionStore } from '../stores/progressionStore.js'
import { formatNumber, Decimal } from '@killing-blow/shared-types'

export function OfflineRewardToast() {
  const offlineReward = useProgressionStore((s) => s.offlineReward)
  const dismissOfflineReward = useProgressionStore((s) => s.dismissOfflineReward)

  useEffect(() => {
    if (!offlineReward) return
    const timer = setTimeout(dismissOfflineReward, 8000)
    return () => clearTimeout(timer)
  }, [offlineReward, dismissOfflineReward])

  if (!offlineReward) return null

  const hours = Math.floor(offlineReward.offlineSeconds / 3600)
  const minutes = Math.floor((offlineReward.offlineSeconds % 3600) / 60)
  const goldFormatted = formatNumber(new Decimal(offlineReward.goldEarned))

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={dismissOfflineReward}
      className="fixed top-4 right-4 z-50 bg-card border border-border rounded-lg p-4 shadow-lg cursor-pointer max-w-sm"
    >
      <p className="text-[20px] font-semibold text-zinc-50 leading-[1.2]">Welcome back!</p>
      <p className="text-[14px] text-muted-foreground mt-1 leading-[1.5]">
        You earned <span className="text-yellow-400 font-semibold">{goldFormatted}</span> gold while away ({hours}h {minutes}m offline).
      </p>
    </div>
  )
}

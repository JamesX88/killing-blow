import { Progress, ProgressTrack, ProgressIndicator } from './ui/progress.js'
import { formatNumber, Decimal } from '@killing-blow/shared-types'

interface BossHpBarProps {
  hp: number
  maxHp: number
}

export function BossHpBar({ hp, maxHp }: BossHpBarProps) {
  const percent = maxHp > 0 ? (hp / maxHp) * 100 : 0

  return (
    <div className="space-y-2">
      <Progress
        value={percent}
        aria-label="Boss HP"
        className="w-full"
      >
        <ProgressTrack className="h-4 bg-zinc-800">
          <ProgressIndicator className="bg-primary transition-all duration-150" />
        </ProgressTrack>
      </Progress>
      <p className="text-center text-[28px] font-semibold leading-[1.1]">
        {formatNumber(new Decimal(hp))} / {formatNumber(new Decimal(maxHp))}
      </p>
    </div>
  )
}

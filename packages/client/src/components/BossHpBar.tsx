import { formatNumber, Decimal } from '@killing-blow/shared-types'

interface BossHpBarProps {
  hp: number
  maxHp: number
}

export function BossHpBar({ hp, maxHp }: BossHpBarProps) {
  const percent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0

  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-label="Boss HP"
        aria-valuenow={hp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        className="h-4 w-full rounded-full bg-zinc-800 overflow-hidden"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-center text-[28px] font-semibold leading-[1.1]">
        {formatNumber(new Decimal(hp))} / {formatNumber(new Decimal(maxHp))}
      </p>
    </div>
  )
}

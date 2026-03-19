import { formatNumber, Decimal } from '@killing-blow/shared-types'

interface BossHpBarProps {
  hp: number
  maxHp: number
}

export function BossHpBar({ hp, maxHp }: BossHpBarProps) {
  const percent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const isLowHp = percent < 20

  return (
    <div className="space-y-2">
      <p className="text-center text-[28px] font-bold leading-[1.1]">
        {formatNumber(new Decimal(hp))} / {formatNumber(new Decimal(maxHp))}
      </p>
      <div
        role="progressbar"
        aria-label="Boss HP"
        aria-valuenow={hp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        style={{
          height: '28px',
          width: '100%',
          borderRadius: '4px',
          backgroundColor: '#0f0f0f',
          border: '1px solid rgba(220,38,38,0.2)',
          overflow: 'visible',
        }}
      >
        <div
          className={isLowHp ? 'hp-bar-low' : ''}
          style={{
            height: '100%',
            width: `${percent}%`,
            backgroundColor: '#dc2626',
            borderRadius: '4px',
            transition: 'width 200ms ease-out',
            boxShadow: 'var(--hp-bar-glow)',
          }}
        />
      </div>
    </div>
  )
}

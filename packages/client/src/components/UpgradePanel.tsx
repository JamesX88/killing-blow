import { useState, useEffect, useCallback } from 'react'
import { useProgressionStore } from '../stores/progressionStore.js'
import { formatNumber, Decimal } from '@killing-blow/shared-types'
import { Card, CardHeader, CardContent } from './ui/card.js'
import { Button } from './ui/button.js'

const STAT_CONFIG = {
  atk: { label: 'ATK', subtext: 'Flat damage per hit' },
  crit: { label: 'CRIT', subtext: 'Critical hit chance' },
  spd: { label: 'SPD', subtext: 'Auto-attack speed' },
} as const

function statValue(stat: StatKey, level: number): string {
  switch (stat) {
    case 'atk': return `${25 + level * 5} dmg/hit`
    case 'crit': return `${Math.min(5 + level * 2, 80)}% crit chance`
    case 'spd': return `${(1.0 + level * 0.05).toFixed(2)} atk/s`
  }
}

type StatKey = keyof typeof STAT_CONFIG

interface CostData {
  atk: { level: number; cost: string }
  crit: { level: number; cost: string }
  spd: { level: number; cost: string }
  goldBalance: string
}

export function UpgradePanel() {
  const { goldBalance, atkLevel, critLevel, spdLevel, isTabActive } = useProgressionStore()
  const [costs, setCosts] = useState<CostData | null>(null)
  const [upgrading, setUpgrading] = useState<StatKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchCosts = useCallback(async () => {
    try {
      const res = await fetch('/upgrades/costs', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setCosts(data)
        // Sync levels from server
        useProgressionStore.getState().setStats({
          atkLevel: data.atk.level,
          critLevel: data.crit.level,
          spdLevel: data.spd.level,
          goldBalance: data.goldBalance,
        })
      }
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => { fetchCosts() }, [fetchCosts])

  const handleUpgrade = async (stat: StatKey) => {
    setUpgrading(stat)
    setError(null)
    try {
      const res = await fetch(`/upgrades/${stat}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        useProgressionStore.getState().setStats({
          atkLevel: data.atkLevel,
          critLevel: data.critLevel,
          spdLevel: data.spdLevel,
          goldBalance: data.goldBalance,
        })
        await fetchCosts()
      } else {
        if (res.status === 400) {
          setError('Upgrade failed — not enough gold.')
        } else {
          setError('Something went wrong. Try again.')
        }
        // Auto-dismiss error
        setTimeout(() => setError(null), res.status === 400 ? 3000 : 5000)
      }
    } catch {
      setError('Something went wrong. Try again.')
      setTimeout(() => setError(null), 5000)
    } finally {
      setUpgrading(null)
    }
  }

  const levels = { atk: atkLevel, crit: critLevel, spd: spdLevel }
  const goldDecimal = new Decimal(goldBalance)
  const goldFormatted = formatNumber(goldDecimal)

  // If no gold and no levels, show empty state
  const hasNoProgress = goldDecimal.eq(0) && atkLevel === 0 && critLevel === 0 && spdLevel === 0 && !costs

  return (
    <Card className="flex-shrink-0 w-64">
      <CardHeader className="pb-2">
        <h2 className="text-[20px] font-semibold leading-[1.2]">Upgrades</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gold Display */}
        <div>
          <p className="text-[16px] text-muted-foreground leading-[1.5]">Gold</p>
          <p className="text-[28px] font-semibold text-yellow-400 leading-[1.1]" aria-live="polite">
            {goldFormatted}
          </p>
        </div>

        {/* Active bonus badge */}
        {isTabActive && (
          <span
            className="inline-block text-[14px] bg-primary/20 text-primary px-2 py-0.5 rounded"
            aria-label="Active DPS bonus active"
          >
            Active bonus: 2x DPS
          </span>
        )}

        {hasNoProgress ? (
          <div>
            <p className="text-[16px] font-semibold text-zinc-50 leading-[1.5]">Attack to earn gold</p>
            <p className="text-[14px] text-muted-foreground leading-[1.5]">Every hit earns gold. Spend gold to grow stronger.</p>
          </div>
        ) : (
          /* Upgrade Rows */
          (['atk', 'crit', 'spd'] as const).map((stat) => {
            const config = STAT_CONFIG[stat]
            const level = levels[stat]
            const cost = costs ? new Decimal(costs[stat].cost) : null
            const canAfford = cost ? goldDecimal.gte(cost) : false
            const costFormatted = cost ? formatNumber(cost) : '...'

            return (
              <div key={stat} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[16px] font-semibold text-zinc-50">{config.label}</span>
                    <span className="text-[14px] text-muted-foreground ml-2">Lv. {level}</span>
                  </div>
                </div>
                <p className="text-[14px] text-muted-foreground leading-[1.5]">{config.subtext}</p>
                <p className="text-[13px] text-zinc-400 font-mono leading-[1.5]">{statValue(stat, level)}</p>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleUpgrade(stat)}
                    disabled={!canAfford || upgrading === stat}
                    className="min-h-[44px] flex-1"
                    variant={canAfford ? 'default' : 'outline'}
                  >
                    {upgrading === stat ? 'Upgrading...' : 'Upgrade'}
                  </Button>
                  <span className={`text-[14px] leading-[1.5] ${canAfford ? 'text-zinc-300' : 'text-muted-foreground'}`}>
                    Cost: {costFormatted}
                  </span>
                </div>
                {!canAfford && costs && (
                  <p className="text-[14px] text-muted-foreground">Not enough gold</p>
                )}
              </div>
            )
          })
        )}

        {/* Error display */}
        {error && (
          <p className="text-[14px] text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}

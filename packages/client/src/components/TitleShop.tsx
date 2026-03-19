import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button.js'

interface TitleEntry {
  id: string
  label: string
  cost: number
  owned: boolean
  equipped: boolean
}

export function TitleShop() {
  const [titles, setTitles] = useState<TitleEntry[]>([])
  const [kbBalance, setKbBalance] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const fetchTitles = useCallback(() => {
    fetch('/titles', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setTitles(data.titles)
          setKbBalance(data.kbBalance)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchTitles() }, [fetchTitles])

  const handlePurchase = async (titleId: string) => {
    setError(null)
    try {
      const res = await fetch(`/titles/${titleId}/purchase`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Purchase failed. Try again.')
        return
      }
      fetchTitles()
    } catch {
      setError('Purchase failed. Try again.')
    }
  }

  const handleEquip = async (titleId: string) => {
    setError(null)
    try {
      const res = await fetch(`/titles/${titleId}/equip`, {
        method: 'PATCH',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Could not equip title. Try again.')
        return
      }
      fetchTitles()
    } catch {
      setError('Could not equip title. Try again.')
    }
  }

  const handleUnequip = async () => {
    setError(null)
    try {
      const res = await fetch('/titles/none/equip', {
        method: 'PATCH',
        credentials: 'include',
      })
      if (res.ok) fetchTitles()
    } catch {
      setError('Could not equip title. Try again.')
    }
  }

  return (
    <div className="w-72 flex-shrink-0">
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-base font-semibold text-foreground mb-3">Titles</h2>

        {/* KB Balance — primary visual focal point */}
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground mb-1">KB</p>
          <p className="text-[28px] font-semibold text-foreground leading-[1.1]">{kbBalance}</p>
        </div>

        {error && (
          <p className="text-sm text-destructive mb-3">{error}</p>
        )}

        <p className="text-sm text-muted-foreground mb-4">
          Earn KB by landing killing blows.
        </p>

        <ul className="space-y-3">
          {titles.map(t => (
            <li key={t.id} className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm text-foreground">{t.label}</span>
                <span className="text-sm text-muted-foreground">{t.cost} KB</span>
              </div>
              <div>
                {t.equipped ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[36px] text-sm"
                    onClick={handleUnequip}
                  >
                    Equipped
                  </Button>
                ) : t.owned ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[36px] text-sm"
                    onClick={() => handleEquip(t.id)}
                  >
                    Equip Title
                  </Button>
                ) : kbBalance >= t.cost ? (
                  <Button
                    size="sm"
                    className="min-h-[36px] text-sm"
                    onClick={() => handlePurchase(t.id)}
                  >
                    Buy Title
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Not enough KB</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

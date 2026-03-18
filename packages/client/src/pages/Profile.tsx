import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '@/stores/sessionStore'
import { formatNumber } from '@killing-blow/shared-types'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface ProfileData {
  id: string
  username: string
  killCount: number
  kbRank: number | null
  createdAt: string
}

export default function Profile() {
  const { userId, isAuthenticated, clearSession } = useSessionStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileData | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      navigate('/login', { replace: true })
      return
    }
    fetch(`/profile/${userId}`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed')
        return res.json()
      })
      .then(setProfile)
      .catch(() => navigate('/login', { replace: true }))
  }, [userId, isAuthenticated, navigate])

  const handleSignOut = async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    clearSession()
    navigate('/login', { replace: true })
  }

  if (!profile) return null

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="min-h-screen flex items-start justify-center py-16">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-6">
          {/* Username */}
          <h1 className="text-[28px] font-semibold leading-[1.1] text-zinc-50">
            {profile.username}
          </h1>

          {/* Stats row */}
          <div className="flex gap-8">
            <div>
              <p className="text-sm text-zinc-400">Kills</p>
              <p className="text-[28px] font-semibold leading-[1.1] text-white">
                {formatNumber(profile.killCount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-400">Rank</p>
              <p className="text-[28px] font-semibold leading-[1.1] text-white">
                {profile.kbRank !== null ? formatNumber(profile.kbRank) : '\u2014'}
              </p>
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Member since */}
          <p className="text-sm text-zinc-400">
            Member since {memberSince}
          </p>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="text-sm text-zinc-400 underline hover:text-zinc-300 cursor-pointer bg-transparent border-none p-0"
          >
            Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

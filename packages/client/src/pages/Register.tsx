import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { apiPost } from '@/lib/api'
import { useSessionStore } from '@/stores/sessionStore'

export default function Register() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [serverError, setServerError] = useState('')

  const validate = (): boolean => {
    let valid = true
    setUsernameError('')
    setPasswordError('')
    setServerError('')

    if (!username.trim()) {
      setUsernameError('This field is required.')
      valid = false
    }
    if (password.length === 0) {
      setPasswordError('This field is required.')
      valid = false
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      valid = false
    }
    return valid
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const { ok, status, data } = await apiPost('/auth/register', { username, password })

      if (ok) {
        useSessionStore.getState().setSession(data.id, data.username)
        navigate('/profile')
      } else if (status === 409) {
        setUsernameError('That username is already taken. Try a different one.')
      } else {
        setServerError('Something went wrong. Please try again.')
      }
    } catch {
      setServerError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-[calc(50vh-12rem)] px-4">
      <Card className="w-full max-w-sm bg-zinc-900 border-zinc-800">
        <CardContent className="flex flex-col gap-4 p-6">
          <h1 className="text-xl font-semibold leading-[1.2] text-zinc-50">Create account</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username" className="text-sm text-zinc-50">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                aria-describedby={usernameError ? 'username-error' : undefined}
                aria-invalid={!!usernameError}
                className="bg-zinc-950 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-600 focus:ring-2 focus:ring-primary focus:ring-offset-2"
              />
              {usernameError && (
                <p id="username-error" className="text-sm text-red-500">
                  {usernameError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm text-zinc-50">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                aria-describedby={passwordError ? 'password-error' : undefined}
                aria-invalid={!!passwordError}
                className="bg-zinc-950 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-600 focus:ring-2 focus:ring-primary focus:ring-offset-2"
              />
              {passwordError && (
                <p id="password-error" className="text-sm text-red-500">
                  {passwordError}
                </p>
              )}
            </div>

            {serverError && (
              <p className="text-sm text-red-500">{serverError}</p>
            )}

            <Button
              type="submit"
              className="w-full hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          <Separator />

          <p className="text-sm text-zinc-400 text-center">Or continue with</p>

          <a href="/auth/google" className="w-full">
            <Button
              variant="outline"
              className="w-full min-h-[44px] border-zinc-800 hover:bg-zinc-800 hover:text-zinc-50 focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
            >
              Continue with Google
            </Button>
          </a>

          <a href="/auth/discord" className="w-full">
            <Button
              variant="outline"
              className="w-full min-h-[44px] border-zinc-800 hover:bg-zinc-800 hover:text-zinc-50 focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
            >
              Continue with Discord
            </Button>
          </a>

          <p className="text-sm text-zinc-400 text-center">
            Already have an account?{' '}
            <Link to="/login" className="underline text-zinc-400 hover:text-zinc-50">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

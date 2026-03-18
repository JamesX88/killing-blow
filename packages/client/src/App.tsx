import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSessionStore } from './stores/sessionStore.js'
import Register from './pages/Register.js'
import Login from './pages/Login.js'
import Profile from './pages/Profile.js'

function AuthRedirect() {
  const { isAuthenticated, isLoading } = useSessionStore()
  if (isLoading) return null
  return <Navigate to={isAuthenticated ? '/profile' : '/login'} replace />
}

export default function App() {
  useEffect(() => {
    useSessionStore.getState().checkSession()
  }, [])

  const { isLoading } = useSessionStore()
  if (isLoading) return null

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/" element={<AuthRedirect />} />
      </Routes>
    </div>
  )
}

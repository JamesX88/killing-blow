import { Routes, Route, Navigate } from 'react-router-dom'
import Register from './pages/Register.js'
import Login from './pages/Login.js'

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<div className="p-8 text-zinc-50">Profile coming in Plan 04</div>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  )
}

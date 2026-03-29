import { useState } from 'react'
import { GraduationCap, ArrowRight } from 'lucide-react'

export default function LoginPage({ setToken, setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', data.role)
      localStorage.setItem('user', JSON.stringify(data))
      setToken(data.access_token)
      setUser(data)
    } catch {
      setErr('Invalid email or password access.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white relative bg-[#050505]">
      <div className="bg-mesh">
          <div className="blob blob1"></div>
          <div className="blob blob2"></div>
          <div className="blob blob3"></div>
      </div>
      
      <div className="content-panel p-12 max-w-md w-full rounded-2xl border border-white/10 z-10 flex flex-col items-center">
        <div className="flex items-center space-x-3 mb-8">
            <GraduationCap className="text-indigo-400" size={36} />
            <span className="text-3xl font-bold tracking-widest text-white">EDUFLOW</span>
        </div>
        
        <p className="text-gray-400 text-sm mb-8 text-center">Sign in to your university portal to access assessments and global faculty records.</p>
        
        {err && <div className="w-full bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm text-center">{err}</div>}

        <form onSubmit={handleLogin} className="w-full space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">University Email</label>
              <input 
                type="email" 
                required 
                className="glass-input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@university.edu"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Password</label>
              <input 
                type="password" 
                required 
                className="glass-input w-full"
                value={password}
                placeholder="Enter your password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <button type="submit" className="glass-btn accent w-full py-3 mt-4 flex justify-center items-center space-x-2">
                <span>Sign In Portal</span> <ArrowRight size={18} />
            </button>
        </form>

        <div className="mt-8 text-xs text-gray-700 font-mono text-center">
          <p>EDUFLOW — University Learning Portal</p>
        </div>
      </div>
    </div>
  )
}

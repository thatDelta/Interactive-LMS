import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { GraduationCap, BookOpen, FileQuestion, LineChart, LogOut, Users, ClipboardList } from 'lucide-react'
import StudentsPage from './pages/StudentsPage'
import CoursesPage from './pages/CoursesPage'
import QuizzesPage from './pages/QuizzesPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

function NavLink({ to, icon: Icon, children }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link to={to} className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${active ? 'bg-indigo-500/15 text-indigo-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
      <Icon size={18} /> <span>{children}</span>
    </Link>
  )
}

function AppShell({ token, user, handleLogout }) {
  return (
    <div className="min-h-screen flex text-white relative bg-[#0a0a0a]">
      <div className="bg-mesh">
        <div className="blob blob1"></div>
        <div className="blob blob2"></div>
        <div className="blob blob3"></div>
      </div>

      <aside className="w-60 sidebar-panel m-3 flex flex-col py-6 px-4 space-y-6 z-10 rounded-xl border border-white/5">
        <div className="text-xl font-bold flex items-center space-x-2.5 text-white px-2">
          <GraduationCap className="text-indigo-400" size={24} />
          <span className="tracking-widest">EDUFLOW</span>
        </div>
        
        <div className="px-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mb-1">Signed in as</p>
          <p className="text-sm font-semibold text-gray-300 truncate">{user.name}</p>
          <p className="text-[10px] text-gray-500 font-mono">{user.role.toUpperCase()}</p>
        </div>

        <nav className="flex flex-col space-y-1 font-medium flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold px-3 mb-1 mt-2">Overview</p>
          <NavLink to="/" icon={LineChart}>
            {user.role === 'student' ? 'My Details' : 'Analysis'}
          </NavLink>

          <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold px-3 mb-1 mt-4">Academics</p>
          <NavLink to="/courses" icon={BookOpen}>My Courses</NavLink>
          {user.role !== 'student' && (
            <NavLink to="/quizzes" icon={FileQuestion}>Quiz Manager</NavLink>
          )}

          {user.role !== 'student' && (
            <>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold px-3 mb-1 mt-4">Admin</p>
              <NavLink to="/students" icon={Users}>Students</NavLink>
              <NavLink to="/enrollments" icon={ClipboardList}>Enrollments</NavLink>
            </>
          )}
        </nav>
        
        <button onClick={handleLogout} className="flex items-center space-x-3 px-3 py-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all mt-auto">
          <LogOut size={18} />
          <span className="text-sm">Sign Out</span>
        </button>
      </aside>

      <main className="flex-1 p-3 z-10 overflow-y-auto">
        <div className="content-panel p-6 min-h-[calc(100vh-1.5rem)] rounded-xl border border-white/5">
          <Routes>
            <Route path="/" element={<DashboardPage token={token} user={user} />} />
            <Route path="/students" element={<StudentsPage user={user} token={token} />} />
            <Route path="/courses" element={<CoursesPage user={user} token={token} />} />
            <Route path="/quizzes" element={<QuizzesPage token={token} user={user} />} />
            <Route path="/enrollments" element={<StudentsPage user={user} token={token} mode="enrollments" />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const getInitialUser = () => {
    try {
        const u = localStorage.getItem('user');
        return u && u !== "undefined" ? JSON.parse(u) : null;
    } catch { return null; }
  }
  const [user, setUser] = useState(getInitialUser())

  const handleLogout = () => {
    localStorage.clear()
    setToken(null)
    setUser(null)
  }

  if (!token || !user) {
    return <LoginPage setToken={setToken} setUser={setUser} />
  }

  return (
    <Router>
      <AppShell token={token} user={user} handleLogout={handleLogout} />
    </Router>
  )
}

export default App

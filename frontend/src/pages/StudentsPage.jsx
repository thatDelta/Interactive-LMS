import { useState } from 'react'
import DataTable from '../components/DataTable'
import { Users, ClipboardList, Plus } from 'lucide-react'

export default function StudentsPage({ user, token, mode }) {
  const [showModal, setShowModal] = useState(false)
  const [courses, setCourses] = useState([])
  const [unenrolled, setUnenrolled] = useState([])
  const [courseId, setCourseId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const openEnrollModal = async () => {
    setShowModal(true)
    setCourseId('')
    setStudentId('')
    setUnenrolled([])
    const res = await fetch(`http://localhost:8000/api/courses?limit=100`, { 
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const d = await res.json()
    setCourses(d.data || [])
  }

  const handleCourseChange = async (cid) => {
    setCourseId(cid)
    setStudentId('')
    if (!cid) { setUnenrolled([]); return }
    const res = await fetch(`http://localhost:8000/api/courses/${cid}/unenrolled_students`, { 
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const d = await res.json()
    setUnenrolled(d.data || [])
  }

  const submitEnrollment = async () => {
    const res = await fetch(`http://localhost:8000/api/enrollments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId, student_id: studentId })
    })
    if(res.ok) {
      setShowModal(false)
      setRefreshKey(prev => prev + 1)
    } else {
      const err = await res.json()
      alert("Enrollment Failed: " + (err.detail || JSON.stringify(err)))
    }
  }

  if (mode === 'enrollments') {
    const enrollColumns = [
      { key: 'registration_number', label: 'Student Reg No' },
      { key: 'student_name', label: 'Student Name' },
      { key: 'course_code', label: 'Course Code' },
      { key: 'course_name', label: 'Course Name' },
      { key: 'attended_classes', label: 'Attended' },
      { key: 'total_classes', label: 'Total Classes' },
      { key: 'attendance_percentage', label: 'Attendance %' },
      { key: 'eligibility', label: 'Eligibility' }
    ]
    return (
      <div className="space-y-4 relative z-0">
        <div className="flex justify-between items-end">
          <div className="flex items-center space-x-3">
            <ClipboardList className="text-indigo-400" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-white">Enrollment & Attendance Ledger</h2>
              <p className="text-gray-500 text-sm">Editing attendance auto-computes eligibility (≥75% = Eligible).</p>
            </div>
          </div>
          {user?.role !== 'student' && (
            <button onClick={openEnrollModal} className="flex items-center space-x-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-all font-semibold text-sm shadow-xl shadow-indigo-500/5">
              <Plus size={16} /> <span>Enroll Student</span>
            </button>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]" onClick={() => setShowModal(false)}>
            <div className="bg-[#111] p-6 w-full max-w-md rounded-xl border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center"><Plus size={18} className="mr-2 text-indigo-400"/> New Enrollment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1">Select Course</label>
                  <select className="glass-input w-full text-sm" value={courseId} onChange={e => handleCourseChange(e.target.value)}>
                    <option value="">-- Choose a Course --</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                  </select>
                </div>
                {courseId && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1">Select Student</label>
                    <select className="glass-input w-full text-sm" value={studentId} onChange={e => setStudentId(e.target.value)}>
                      <option value="">-- Choose Student to Enroll --</option>
                      {unenrolled.map(u => <option key={u.id} value={u.id}>{u.name} ({u.registration_number})</option>)}
                    </select>
                    {unenrolled.length === 0 && <p className="text-xs text-yellow-500/80 mt-2">All your students are already enrolled in this course!</p>}
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-white/5">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors">Cancel</button>
                <button onClick={submitEnrollment} disabled={!courseId || !studentId}
                  className="px-4 py-2 text-sm rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all disabled:opacity-40">Enroll</button>
              </div>
            </div>
          </div>
        )}

        <DataTable key={refreshKey} endpoint="/api/enrollments" columns={enrollColumns} title="Enrollment" hideActions={user?.role === 'student'} hideInsert={true} token={token} />
      </div>
    )
  }

  const columns = [
    { key: 'registration_number', label: 'Reg. No.' },
    { key: 'name', label: 'Full Name' },
    { key: 'email', label: 'Email' },
    { key: 'birth_year', label: 'Birth Year' },
    { key: 'role', label: 'Role' }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <Users className="text-indigo-400" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-white">
            {user?.role === 'admin' ? 'All Students' : 'My Course Students'}
          </h2>
          <p className="text-gray-500 text-sm">
            {user?.role === 'admin' ? 'Full student database with DML operations.' : 'Students enrolled in your courses.'}
          </p>
        </div>
      </div>
      <DataTable endpoint="/api/students" columns={columns} title="Student" hideActions={user?.role === 'student'} token={token} />
    </div>
  )
}

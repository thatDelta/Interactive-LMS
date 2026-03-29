import { useState, useEffect } from 'react'
import { BookOpen, FileText, FileQuestion, ClipboardCheck, ArrowLeft, Download, Plus, Trash2, ChevronRight, Upload, Calendar, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react'

export default function CoursesPage({ user, token }) {
  const [courses, setCourses] = useState([])
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [activeTab, setActiveTab] = useState('materials')
  const [materials, setMaterials] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  // Quiz builder state
  const [showQuizBuilder, setShowQuizBuilder] = useState(false)
  const [quizForm, setQuizForm] = useState({ title: '', weightage: 100, max_marks: 100, questions: [{ text: '', options: ['', '', '', ''], answer: '' }] })

  // Material upload state
  const [showUpload, setShowUpload] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState(null)

  // Assignment create state
  const [showAssignCreate, setShowAssignCreate] = useState(false)
  const [assignForm, setAssignForm] = useState({ title: '', description: '', due_date: '', reference_file_url: '' })

  const headers = token ? { 'Authorization': `Bearer ${token}` } : {}

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true)

      // Map roles to their specific endpoints
      const endpoints = {
        student: '/api/me/courses',
        faculty: '/api/courses?skip=0&limit=50', // Backend now filters this!
        admin: '/api/courses?skip=0&limit=50'    // Backend returns all!
      }

      let url = `http://localhost:8000${endpoints[user.role] || endpoints.student}`

      try {
        const res = await fetch(url, { headers })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setCourses(data.data || [])
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    fetchCourses()
  }, [user, token])

  useEffect(() => {
    if (!selectedCourse) return
    const cid = selectedCourse.id
    fetch(`http://localhost:8000/api/courses/${cid}/materials`).then(r => r.json()).then(d => setMaterials(d.data || [])).catch(() => setMaterials([]))
    fetch(`http://localhost:8000/api/quizzes/list?skip=0&limit=50`, { headers }).then(r => r.json()).then(d => {
      const filtered = (d.data || []).filter(q => q.course_id === cid)
      setQuizzes(filtered)
    }).catch(() => setQuizzes([]))
    fetch(`http://localhost:8000/api/courses/${cid}/assignments`, { headers }).then(r => r.json()).then(d => setAssignments(d.data || [])).catch(() => setAssignments([]))
  }, [selectedCourse])

  // ─── Material Upload Handler ─────────────────────────
  const handleUploadMaterial = async () => {
    if (!uploadFile || !uploadTitle) return
    const fd = new FormData()
    fd.append('title', uploadTitle)
    fd.append('file', uploadFile)
    await fetch(`http://localhost:8000/api/courses/${selectedCourse.id}/materials/upload`, { method: 'POST', body: fd })
    setShowUpload(false); setUploadTitle(''); setUploadFile(null)
    const res = await fetch(`http://localhost:8000/api/courses/${selectedCourse.id}/materials`)
    const d = await res.json(); setMaterials(d.data || [])
  }

  // ─── Quiz Builder Handler ────────────────────────────
  const handleCreateQuiz = async () => {
    await fetch('http://localhost:8000/api/quizzes/create', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...quizForm, course_id: selectedCourse.id })
    })
    setShowQuizBuilder(false)
    setQuizForm({ title: '', weightage: 100, max_marks: 100, questions: [{ text: '', options: ['', '', '', ''], answer: '' }] })
    // Refresh
    const res = await fetch(`http://localhost:8000/api/quizzes/list?skip=0&limit=50`, { headers })
    const d = await res.json(); setQuizzes((d.data || []).filter(q => q.course_id === selectedCourse.id))
  }

  const addQuestion = () => setQuizForm(f => ({ ...f, questions: [...f.questions, { text: '', options: ['', '', '', ''], answer: '' }] }))
  const updateQuestion = (idx, field, val) => {
    const qs = [...quizForm.questions]; qs[idx] = { ...qs[idx], [field]: val }; setQuizForm(f => ({ ...f, questions: qs }))
  }
  const updateOption = (qi, oi, val) => {
    const qs = [...quizForm.questions]; qs[qi].options[oi] = val; setQuizForm(f => ({ ...f, questions: qs }))
  }

  // ─── Assignment Handler ──────────────────────────────
  const handleCreateAssignment = async () => {
    await fetch(`http://localhost:8000/api/courses/${selectedCourse.id}/assignments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignForm)
    })
    const handleCreateAssignment = async () => {
      await fetch(`http://localhost:8000/api/courses/${selectedCourse.id}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm)
      })
      setShowAssignCreate(false);
      setAssignForm({ title: '', description: '', due_date: '', reference_file_url: '' }) // <-- Updated reset
      const res = await fetch(`http://localhost:8000/api/courses/${selectedCourse.id}/assignments`, { headers })
      const d = await res.json(); setAssignments(d.data || [])
    }
  }

  const handleTurnIn = async (assignmentId) => {
    const input = document.createElement('input'); input.type = 'file'
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return
      const fd = new FormData(); fd.append('file', file)
      await fetch(`http://localhost:8000/api/assignments/${assignmentId}/submit`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
      })
      const res = await fetch(`http://localhost:8000/api/courses/${selectedCourse.id}/assignments`, { headers })
      const d = await res.json(); setAssignments(d.data || [])
    }
    input.click()
  }

  const now = new Date()
  const categorize = (a) => {
    if (a.submission) return 'completed'
    if (new Date(a.due_date) < now) return 'past_due'
    return 'ongoing'
  }

  const tabs = [
    { id: 'materials', label: 'Materials', icon: FileText },
    { id: 'quizzes', label: 'Quizzes', icon: FileQuestion },
    { id: 'assignments', label: 'Assignments', icon: ClipboardCheck }
  ]

  // ─── Course Detail View ────────────────────────────────
  if (selectedCourse) {
    const pastDue = assignments.filter(a => categorize(a) === 'past_due')
    const ongoing = assignments.filter(a => categorize(a) === 'ongoing')
    const completed = assignments.filter(a => categorize(a) === 'completed')

    return (
      <div className="flex h-full min-h-[calc(100vh-5rem)] animate-fade-in">
        <div className="w-52 border-r border-white/5 pr-3 flex flex-col space-y-1 shrink-0">
          <button onClick={() => setSelectedCourse(null)} className="flex items-center text-xs text-gray-500 hover:text-indigo-400 mb-3 transition-colors">
            <ArrowLeft size={14} className="mr-1" /> All Courses
          </button>
          {courses.map(c => (
            <button key={c.id} onClick={() => { setSelectedCourse(c); setActiveTab('materials') }}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-all truncate ${selectedCourse.id === c.id ? 'bg-indigo-500/15 text-indigo-400 font-semibold' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex-1 pl-5 overflow-y-auto">
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-white">{selectedCourse.name}</h2>
            <p className="text-gray-500 text-sm font-mono mt-1">{selectedCourse.code} • {selectedCourse.credits} Credits • {selectedCourse.type}</p>
          </div>

          <div className="flex space-x-1 mb-5 bg-[#111] rounded-lg p-1 border border-white/5 w-fit">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                <tab.icon size={14} /><span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── Materials Tab ────────────────────────── */}
          {activeTab === 'materials' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-300">Course Materials</h3>
                {user.role !== 'student' && (
                  <button onClick={() => setShowUpload(true)} className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all">
                    <Upload size={14} /><span>Upload File</span>
                  </button>
                )}
              </div>
              {materials.length === 0 ? <p className="text-gray-600 text-sm py-6 text-center">No materials uploaded yet.</p> : (
                <div className="space-y-2">
                  {materials.map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-[#111] border border-white/5 rounded-lg px-4 py-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center space-x-3">
                        <FileText size={16} className="text-indigo-400/60" />
                        <div>
                          <p className="text-sm font-medium text-gray-200">{m.title}</p>
                          <p className="text-xs text-gray-600 font-mono">{m.file_url}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a href={`http://localhost:8000${m.file_url}`} target="_blank" className="text-gray-500 hover:text-indigo-400 transition-colors"><Download size={14} /></a>
                        {user.role !== 'student' && (
                          <button onClick={async () => { await fetch(`http://localhost:8000/api/materials/${m.id}`, { method: 'DELETE' }); setMaterials(prev => prev.filter(x => x.id !== m.id)) }}
                            className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Upload Modal */}
              {showUpload && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]" onClick={() => setShowUpload(false)}>
                  <div className="bg-[#111] p-6 w-full max-w-md rounded-xl border border-white/10" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold mb-4 text-white flex items-center"><Upload size={18} className="mr-2 text-indigo-400" /> Upload Material</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1">Title</label>
                        <input className="glass-input w-full text-sm" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="e.g. Lecture Notes Week 5" />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1">File</label>
                        <input type="file" onChange={e => setUploadFile(e.target.files[0])} className="text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-white/10 file:bg-[#1a1a1a] file:text-gray-300 file:text-sm hover:file:bg-white/5" />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-5">
                      <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                      <button onClick={handleUploadMaterial} disabled={!uploadFile || !uploadTitle}
                        className="px-4 py-2 text-sm rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all disabled:opacity-40">Upload</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Quizzes Tab ──────────────────────────── */}
          {activeTab === 'quizzes' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-300">Course Assessments</h3>
                {user.role !== 'student' && (
                  <button onClick={() => setShowQuizBuilder(true)} className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all">
                    <Plus size={14} /><span>Create Quiz</span>
                  </button>
                )}
              </div>
              {quizzes.length === 0 ? <p className="text-gray-600 text-sm py-6 text-center">No quizzes for this course.</p> : (
                <div className="space-y-2">
                  {quizzes.map(q => (
                    <div key={q.id} className="flex items-center justify-between bg-[#111] border border-white/5 rounded-lg px-4 py-3">
                      <div className="flex items-center space-x-3">
                        <FileQuestion size={16} className="text-violet-400/60" />
                        <div>
                          <p className="text-sm font-medium text-gray-200">{q.title}</p>
                          <p className="text-xs text-gray-600 font-mono">Weightage: {q.weightage}% • Max: {q.max_marks}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-700" />
                    </div>
                  ))}
                </div>
              )}
              {/* Quiz Builder Modal */}
              {showQuizBuilder && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]" onClick={() => setShowQuizBuilder(false)}>
                  <div className="bg-[#111] p-6 w-full max-w-2xl rounded-xl border border-white/10 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold mb-4 text-white flex items-center"><FileQuestion size={18} className="mr-2 text-violet-400" /> Quiz Builder</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1">Title</label>
                          <input className="glass-input w-full text-sm" value={quizForm.title} onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1">Weightage %</label>
                          <input type="number" className="glass-input w-full text-sm" value={quizForm.weightage} onChange={e => setQuizForm(f => ({ ...f, weightage: +e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1">Max Marks</label>
                          <input type="number" className="glass-input w-full text-sm" value={quizForm.max_marks} onChange={e => setQuizForm(f => ({ ...f, max_marks: +e.target.value }))} />
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-4">
                        <p className="text-sm font-semibold text-gray-400 mb-3">Questions</p>
                        {quizForm.questions.map((q, qi) => (
                          <div key={qi} className="mb-4 bg-[#0a0a0a] border border-white/5 rounded-lg p-4">
                            <label className="block text-[10px] uppercase text-gray-600 mb-1">Question {qi + 1}</label>
                            <input className="glass-input w-full text-sm mb-3" placeholder="Enter question text..."
                              value={q.text} onChange={e => updateQuestion(qi, 'text', e.target.value)} />
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {q.options.map((opt, oi) => (
                                <input key={oi} className="glass-input text-sm" placeholder={`Option ${oi + 1}`}
                                  value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                              ))}
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase text-emerald-500 mb-1">Correct Answer</label>
                              <select className="glass-input w-full text-sm" value={q.answer} onChange={e => updateQuestion(qi, 'answer', e.target.value)}>
                                <option value="">Select correct answer</option>
                                {q.options.filter(o => o).map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                        <button onClick={addQuestion} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"><Plus size={14} /><span>Add Question</span></button>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-5">
                      <button onClick={() => setShowQuizBuilder(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                      <button onClick={handleCreateQuiz} disabled={!quizForm.title}
                        className="px-4 py-2 text-sm rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 transition-all disabled:opacity-40">Create Quiz</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Assignments Tab ──────────────────────── */}
          {activeTab === 'assignments' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-300">Assignments</h3>
                {user.role !== 'student' && (
                  <button onClick={() => setShowAssignCreate(true)} className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                    <Plus size={14} /><span>Create Assignment</span>
                  </button>
                )}
              </div>

              {assignments.length === 0 ? <p className="text-gray-600 text-sm py-6 text-center">No assignments for this course.</p> : (
                <>
                  {/* Ongoing */}
                  {ongoing.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-emerald-500 font-bold mb-2 flex items-center"><Clock size={12} className="mr-1" /> Ongoing</p>
                      {ongoing.map(a => <AssignmentCard key={a.id} a={a} user={user} onTurnIn={handleTurnIn} />)}
                    </div>
                  )}
                  {/* Past Due */}
                  {pastDue.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-red-400 font-bold mb-2 flex items-center"><AlertTriangle size={12} className="mr-1" /> Past Due</p>
                      {pastDue.map(a => <AssignmentCard key={a.id} a={a} user={user} onTurnIn={handleTurnIn} pastDue />)}
                    </div>
                  )}
                  {/* Completed */}
                  {completed.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-indigo-400 font-bold mb-2 flex items-center"><CheckCircle size={12} className="mr-1" /> Turned In</p>
                      {completed.map(a => <AssignmentCard key={a.id} a={a} user={user} completed />)}
                    </div>
                  )}
                </>
              )}

              {/* Assignment Create Modal */}
              {showAssignCreate && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]" onClick={() => setShowAssignCreate(false)}>
                  <div className="bg-[#111] p-6 w-full max-w-md rounded-xl border border-white/10" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold mb-4 text-white">Create Assignment</h3>
                    <div className="space-y-3">
                      <div><label className="block text-[10px] uppercase text-gray-600 mb-1">Title</label>
                        <input className="glass-input w-full text-sm" value={assignForm.title} onChange={e => setAssignForm(f => ({ ...f, title: e.target.value }))} /></div>
                      <div><label className="block text-[10px] uppercase text-gray-600 mb-1">Description</label>
                        <textarea className="glass-input w-full text-sm h-20 resize-none" value={assignForm.description} onChange={e => setAssignForm(f => ({ ...f, description: e.target.value }))} /></div>

                      {/* NEW: Reference Material Dropdown */}
                      <div><label className="block text-[10px] uppercase text-gray-600 mb-1">Reference Material (Optional)</label>
                        <select className="glass-input w-full text-sm bg-[#1a1a1a]" value={assignForm.reference_file_url} onChange={e => setAssignForm(f => ({ ...f, reference_file_url: e.target.value }))}>
                          <option value="">None</option>
                          {materials.map(m => (
                            <option key={m.id} value={m.file_url}>{m.title}</option>
                          ))}
                        </select>
                      </div>

                      <div><label className="block text-[10px] uppercase text-gray-600 mb-1">Due Date</label>
                        <input type="datetime-local" className="glass-input w-full text-sm" value={assignForm.due_date} onChange={e => setAssignForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-5">
                      <button onClick={() => setShowAssignCreate(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                      <button onClick={handleCreateAssignment} disabled={!assignForm.title}
                        className="px-4 py-2 text-sm rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-40">Create</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Course Grid ────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3">
        <BookOpen className="text-indigo-400" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-white">{user.role === 'student' ? 'My Courses' : 'Course Registry'}</h2>
          <p className="text-gray-500 text-sm">Select a course to view materials, quizzes, and assignments.</p>
        </div>
      </div>
      {loading ? <div className="text-center py-12 text-gray-600 font-mono text-sm">Loading...</div> : courses.length === 0 ? <div className="text-center py-12 text-gray-600">No courses found.</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(c => (
            <button key={c.id} onClick={() => { setSelectedCourse(c); setActiveTab('materials') }}
              className="text-left bg-[#111] border border-white/5 rounded-xl p-5 hover:border-indigo-500/30 hover:bg-indigo-500/[0.03] transition-all group">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <BookOpen size={18} className="text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">{c.name}</h3>
                  <p className="text-xs font-mono text-gray-600 mt-0.5">{c.code}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 mt-4 text-xs text-gray-500">
                <span className="bg-white/5 px-2 py-1 rounded">{c.credits} Credits</span>
                <span className="bg-white/5 px-2 py-1 rounded">{c.type}</span>
                {c.attendance_percentage !== undefined && (
                  <span className={`px-2 py-1 rounded ${parseFloat(c.attendance_percentage) >= 75 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {parseFloat(c.attendance_percentage).toFixed(0)}% Att.
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Assignment Card Component ───────────────────────────
function AssignmentCard({ a, user, onTurnIn, pastDue, completed }) {
  const dueDate = new Date(a.due_date)
  return (
    <div className={`bg-[#111] border rounded-lg px-4 py-3 mb-2 ${pastDue ? 'border-red-500/20' : completed ? 'border-indigo-500/20' : 'border-white/5'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200">{a.title}</p>
          {a.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.description}</p>}
          <div className="flex items-center space-x-3 mt-2 text-xs text-gray-600">
            <span className="flex items-center"><Calendar size={11} className="mr-1" /> Due: {dueDate.toLocaleDateString()} {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {a.reference_file_url && <a href={`http://localhost:8000${a.reference_file_url}`} className="text-indigo-400 hover:underline">Reference File</a>}
          </div>
          {a.submission && (
            <p className="text-xs mt-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${a.submission.status === 'graded' ? 'bg-emerald-500/10 text-emerald-400' : a.submission.status === 'late' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                {a.submission.status.toUpperCase()}
              </span>
              {a.submission.grade && <span className="text-gray-400 ml-2">Grade: {a.submission.grade}</span>}
            </p>
          )}
        </div>
        {user.role === 'student' && !completed && onTurnIn && (
          <button onClick={() => onTurnIn(a.id)}
            className="shrink-0 ml-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
            Turn In
          </button>
        )}
      </div>
    </div>
  )
}

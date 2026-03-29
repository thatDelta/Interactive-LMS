import { useState, useEffect } from 'react'
import { Award, Book, Percent, LineChart, ChevronDown, CheckCircle, XCircle } from 'lucide-react'

export default function DashboardPage({ user, token }) {
  const [analysis, setAnalysis] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  
  useEffect(() => {
    const fetchAnalysis = async () => {
      const endpoint = user.role === 'student' ? '/api/me/analysis' : '/api/admin/analysis'
      const res = await fetch(`http://localhost:8000${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) return
      const data = await res.json()
      
      if (user.role === 'student') {
        // Mock the array structure for universal rendering
        setAnalysis([{ ...data, name: user.name, id: user.user_id, registration_number: "My Details" }])
      } else {
        setAnalysis(data.data || [])
      }
    }
    fetchAnalysis()
  }, [user, token])

  const toggleExpand = (id) => {
    if (expandedId === id) setExpandedId(null)
    else setExpandedId(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center content-panel p-8 border border-white/5 bg-[#111] rounded-xl">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-wide flex items-center space-x-3">
            <LineChart className="text-indigo-400" size={32} />
            <span>{user.role === 'student' ? 'My Analytics' : 'Student Analysis Data Matrix'}</span>
          </h2>
          <p className="text-gray-400 mt-2 font-medium">Dynamically computing final university CGPAs utilizing isolated TiDB joins.</p>
        </div>
        {user.role !== 'student' && (
           <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-4 py-2 rounded-full font-mono text-sm">
              Role: {user.role.toUpperCase()}
           </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {analysis.map((student, idx) => (
          <div key={idx} className="glass-panel overflow-hidden transition-all duration-300 border border-white/5 bg-[#141414]">
            {/* Top Level Brief: Just CGPA strictly configured per user logic */}
            <div 
              onClick={() => toggleExpand(student.id)}
              className="p-6 flex flex-col md:flex-row items-center justify-between hover:bg-white/[0.02] cursor-pointer transition-colors border-l-4 border-l-indigo-500"
            >
              <div className="flex items-center space-x-6 w-full md:w-auto">
                <div className="bg-[#1a1a1a] border border-white/10 p-4 rounded-full">
                  <Award className="text-indigo-400" size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">{student.name}</h3>
                  <p className="font-mono text-gray-500 text-sm mt-1">{student.registration_number}</p>
                </div>
              </div>

              <div className="flex items-center w-full md:w-auto justify-between md:justify-end md:space-x-12 px-4 md:px-0">
                <div className="text-right border-white/10 pr-6">
                  <p className="text-sm text-gray-500 mb-1 font-bold uppercase tracking-wider">Total Computed CGPA</p>
                  <p className="text-4xl font-bold text-white">{parseFloat(student.cgpa).toFixed(2)}</p>
                </div>
                <ChevronDown className={`text-gray-500 transition-transform ${expandedId === student.id ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {/* Expanded Detailed Module */}
            {expandedId === student.id && (
              <div className="border-t border-white/5 bg-[#0a0a0a] p-8">
                <h4 className="text-lg font-bold text-gray-300 mb-6 uppercase tracking-wider border-b border-white/5 pb-2">Comprehensive Course Ledgers</h4>
                
                {student.course_metrics && student.course_metrics.length > 0 ? (
                  <div className="space-y-4">
                    {student.course_metrics.map(course => (
                      <div key={course.course_id} className="flex flex-col md:flex-row items-center justify-between p-4 bg-[#111] border border-white/5 rounded-lg">
                        <div className="flex items-center space-x-4">
                           <Book size={20} className="text-gray-600" />
                           <div>
                             <p className="font-bold text-gray-200">{course.course_name} <span className="text-xs text-indigo-400 ml-2 font-mono">{course.course_code}</span></p>
                             <div className="flex space-x-4 mt-1 text-sm text-gray-500">
                               <span>Credits: {course.credits}</span>
                               <span className="flex items-center"><Percent size={12} className="mr-1"/> Attendance: {course.attendance_percentage}%</span>
                             </div>
                           </div>
                        </div>

                        <div className="flex items-center space-x-8 mt-4 md:mt-0">
                           <div className="flex flex-col items-end">
                             <p className="text-xs text-gray-500 uppercase">Eligibility Badge</p>
                             {course.eligibility === 'Eligible' ? 
                               <span className="flex items-center text-emerald-400 font-bold mt-1 text-sm"><CheckCircle size={14} className="mr-1" /> ELIGIBLE</span> : 
                               <span className="flex items-center text-red-400 font-bold mt-1 text-sm"><XCircle size={14} className="mr-1" /> DEBARRED</span>
                             }
                           </div>
                           <div className="text-center bg-[#1a1a1a] px-4 py-2 rounded-md border border-white/5">
                              <p className="text-xs text-gray-500 uppercase">Avg Score</p>
                              <p className="font-bold text-gray-200">{course.final_percentage}%</p>
                           </div>
                           <div className="text-center bg-indigo-500/10 px-4 py-2 rounded-md border border-indigo-500/20">
                              <p className="text-xs text-indigo-400 uppercase">Grade</p>
                              <p className="font-bold text-white text-lg">{course.grade_point >= 10 ? 'S' : course.grade_point >= 9 ? 'A' : course.grade_point >= 8 ? 'B' : course.grade_point >= 7 ? 'C' : course.grade_point >= 6 ? 'D' : course.grade_point >= 5 ? 'E' : 'F'} <span className="text-xs text-indigo-400/60">({course.grade_point})</span></p>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 p-4">No enrolled courses resolved for this student.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { FileQuestion, CheckCircle, XCircle, ArrowLeft, Trophy, BarChart3 } from 'lucide-react'
import DataTable from '../components/DataTable'

export default function QuizzesPage({ token, user }) {
  const [quizzes, setQuizzes] = useState([])
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchQuizzes = async () => {
      setLoading(true)
      try {
        // Students get filtered eligible quizzes, admin/faculty get all
        const url = user.role === 'student'
          ? 'http://localhost:8000/api/me/quizzes'
          : 'http://localhost:8000/api/quizzes'
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        setQuizzes(Array.isArray(data) ? data : [])
      } catch { setQuizzes([]) }
      setLoading(false)
    }
    fetchQuizzes()
  }, [token, user])

  const startQuiz = (quiz) => {
    setSelectedQuiz(quiz)
    setAnswers({})
    setResult(null)
  }

  const submitQuiz = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/me/quizzes/${selectedQuiz.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ answers })
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
      } else {
        setResult({ error: data.detail || 'Submission failed' })
      }
    } catch (e) {
      setResult({ error: 'Network error' })
    }
  }

  // ─── Admin/Faculty: Quiz Management Table ────────────
  if (user.role !== 'student') {
    const quizColumns = [
      { key: 'title', label: 'Quiz Title' },
      { key: 'course_name', label: 'Course' },
      { key: 'weightage', label: 'Weightage (%)' },
      { key: 'max_marks', label: 'Max Marks' }
    ]
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center space-x-3">
          <FileQuestion className="text-violet-400" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-white">Quiz Manager</h2>
            <p className="text-gray-500 text-sm">Create, edit, and manage assessments. DML operations execute directly on TiDB.</p>
          </div>
        </div>
        <DataTable
          endpoint="/api/quizzes/list"
          columns={quizColumns}
          title="Quiz"
          token={token}
        />
      </div>
    )
  }

  // ─── Student: Quiz Taking Interface ────────────
  if (selectedQuiz) {
    const qData = selectedQuiz.questions_json || {}
    const qKeys = Object.keys(qData)

    return (
      <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
        <button onClick={() => setSelectedQuiz(null)} className="flex items-center text-sm text-gray-500 hover:text-indigo-400 transition-colors">
          <ArrowLeft size={16} className="mr-1.5" /> Back to Assessments
        </button>
        
        <div className="border-b border-white/5 pb-4">
          <h2 className="text-2xl font-bold text-white">{selectedQuiz.title}</h2>
          <p className="text-gray-500 text-sm font-mono mt-1">
            {selectedQuiz.course_name} • Weightage: {selectedQuiz.weightage}% • Max: {selectedQuiz.max_marks} marks
          </p>
        </div>

        <div className="space-y-5">
          {qKeys.map((qKey, idx) => {
            const q = qData[qKey]
            if (!q || typeof q !== 'object') return null
            return (
              <div key={qKey} className="bg-[#111] border border-white/5 rounded-xl p-5">
                <p className="font-semibold text-gray-200 mb-4">
                  <span className="text-indigo-400 mr-2">Q{idx + 1}.</span>
                  {q.text}
                </p>
                <div className="space-y-2">
                  {(q.options || []).map((opt, oi) => {
                    const selected = answers[qKey] === opt
                    const isCorrect = result && opt === q.answer
                    const isWrong = result && selected && opt !== q.answer
                    return (
                      <label
                        key={oi}
                        className={`flex items-center space-x-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                          result
                            ? isCorrect ? 'border-emerald-500/40 bg-emerald-500/10' 
                              : isWrong ? 'border-red-500/40 bg-red-500/10'
                              : 'border-white/5 bg-white/[0.02]'
                            : selected
                              ? 'border-indigo-500/40 bg-indigo-500/10'
                              : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                        }`}
                      >
                        <input
                          type="radio"
                          name={qKey}
                          value={opt}
                          checked={selected}
                          onChange={() => !result && setAnswers(prev => ({ ...prev, [qKey]: opt }))}
                          disabled={!!result}
                          className="accent-indigo-500"
                        />
                        <span className={`text-sm ${selected ? 'text-white' : 'text-gray-400'}`}>{opt}</span>
                        {result && isCorrect && <CheckCircle size={16} className="ml-auto text-emerald-400" />}
                        {result && isWrong && <XCircle size={16} className="ml-auto text-red-400" />}
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {!result ? (
          <button
            onClick={submitQuiz}
            disabled={Object.keys(answers).length === 0}
            className="w-full py-3 rounded-xl font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all disabled:opacity-40"
          >
            Submit Assessment
          </button>
        ) : result.error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <XCircle size={32} className="text-red-400 mx-auto mb-2" />
            <p className="text-red-300 font-semibold">{result.error}</p>
          </div>
        ) : (
          <div className="bg-[#111] border border-white/5 rounded-xl p-6 text-center">
            <Trophy size={32} className="text-yellow-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Assessment Complete</h3>
            <p className="text-3xl font-bold text-indigo-400 mb-1">{result.percentage}%</p>
            <p className="text-sm text-gray-500">
              Score: {result.score} / {selectedQuiz.max_marks} marks — Stored to TiDB
            </p>
            <div className="w-full bg-[#1a1a1a] h-3 mt-4 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full transition-all duration-700" style={{ width: `${result.percentage}%` }}></div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Quiz List ────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center space-x-3">
        <FileQuestion className="text-violet-400" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-white">Assessments</h2>
          <p className="text-gray-500 text-sm">Select an assessment to begin. MCQ answers are graded and stored instantly.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-600 font-mono">Loading assessments...</div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500">No eligible assessments available.</p>
          <p className="text-gray-600 text-xs mt-1">You may be debarred from some courses due to low attendance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map(quiz => (
            <button
              key={quiz.id}
              onClick={() => startQuiz(quiz)}
              className="text-left bg-[#111] border border-white/5 rounded-xl p-5 hover:border-indigo-500/30 hover:bg-indigo-500/[0.03] transition-all group"
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <FileQuestion size={18} className="text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{quiz.title}</h3>
                  <p className="text-xs text-gray-600 font-mono">{quiz.course_name}</p>
                </div>
              </div>
              <div className="flex space-x-3 text-xs text-gray-500">
                <span className="bg-white/5 px-2 py-1 rounded">Weightage: {quiz.weightage}%</span>
                <span className="bg-white/5 px-2 py-1 rounded">Max: {quiz.max_marks}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

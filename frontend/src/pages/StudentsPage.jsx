import DataTable from '../components/DataTable'
import { Users, ClipboardList } from 'lucide-react'

export default function StudentsPage({ user, token, mode }) {
  if (mode === 'enrollments') {
    const enrollColumns = [
      { key: 'student_name', label: 'Student' },
      { key: 'course_name', label: 'Course' },
      { key: 'attended_classes', label: 'Attended' },
      { key: 'total_classes', label: 'Total Classes' },
      { key: 'attendance_percentage', label: 'Attendance %' },
      { key: 'eligibility', label: 'Eligibility' }
    ]
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <ClipboardList className="text-indigo-400" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-white">Enrollment & Attendance Ledger</h2>
            <p className="text-gray-500 text-sm">Editing attendance auto-computes eligibility (≥75% = Eligible).</p>
          </div>
        </div>
        <DataTable endpoint="/api/enrollments" columns={enrollColumns} title="Enrollment" hideActions={user?.role === 'student'} token={token} />
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

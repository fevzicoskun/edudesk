'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

type SystemStudent = { id: string; full_name: string; student_number: string | null }
type SystemClass = { id: string; name: string; students: SystemStudent[] }
type MentorNote = { id: string; content: string; created_at: string }
type ManualStudent = {
  id: string
  full_name: string
  parent_name: string | null
  phone: string | null
  created_at: string
  mentor_student_notes: MentorNote[]
}
type MentorReport = { id: string; content: string; report_date: string; student_id: string }

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-slate-500'

function today() {
  return new Date().toISOString().split('T')[0]
}

function ManualStudentCard({
  student,
  addNote,
  deleteNote,
  deleteStudent,
}: {
  student: ManualStudent
  addNote: (fd: FormData) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  deleteStudent: (id: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [, start] = useTransition()

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-slate-100">{student.full_name}</p>
          <div className="flex flex-wrap gap-3 mt-0.5">
            {student.parent_name && (
              <span className="text-xs text-gray-500 dark:text-slate-400">Veli: {student.parent_name}</span>
            )}
            {student.phone && (
              <a href={`tel:${student.phone}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                {student.phone}
              </a>
            )}
          </div>
          {student.mentor_student_notes.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              {student.mentor_student_notes.length} not
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setOpen(o => !o); setShowNoteForm(false) }}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {open ? 'Kapat' : 'Notlar'}
          </button>
          <form action={deleteStudent.bind(null, student.id)}>
            <button type="submit" className="text-xs text-red-400 hover:text-red-600 font-medium">Sil</button>
          </form>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3 space-y-3">
          {student.mentor_student_notes.length > 0 && (
            <div className="space-y-2">
              {[...student.mentor_student_notes]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map(note => (
                  <div key={note.id} className="flex items-start gap-2 bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-700 dark:text-slate-300 flex-1 whitespace-pre-wrap">{note.content}</p>
                    <form action={deleteNote.bind(null, note.id)}>
                      <button type="submit" className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                    </form>
                  </div>
                ))}
            </div>
          )}

          {showNoteForm ? (
            <form
              action={async (fd) => {
                fd.append('mentor_student_id', student.id)
                start(() => { addNote(fd) })
                setShowNoteForm(false)
              }}
              className="space-y-2"
            >
              <textarea
                name="content"
                rows={3}
                placeholder="Not ekle…"
                required
                minLength={2}
                className={inputCls + ' resize-none'}
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700">
                  Kaydet
                </button>
                <button type="button" onClick={() => setShowNoteForm(false)} className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400">
                  İptal
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowNoteForm(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Not ekle
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SystemStudentRow({
  student,
  cls,
  reports,
  addReport,
  deleteReport,
}: {
  student: SystemStudent
  cls: SystemClass
  reports: MentorReport[]
  addReport: (studentId: string, classId: string, fd: FormData) => Promise<void>
  deleteReport: (reportId: string, studentId: string, classId: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [, start] = useTransition()

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-slate-100">{student.full_name}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {cls.name}{student.student_number ? ` · No: ${student.student_number}` : ''}
            {reports.length > 0 && ` · ${reports.length} rapor`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/siniflar/${cls.id}/ogrenciler/${student.id}`}
            className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
          >
            Profil
          </Link>
          <button
            onClick={() => { setOpen(o => !o); setShowForm(false) }}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {open ? 'Kapat' : 'Raporlar'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3 space-y-3">
          {reports.length > 0 && (
            <div className="space-y-2">
              {reports.map(r => (
                <div key={r.id} className="flex items-start gap-2 bg-gray-50 dark:bg-slate-700 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 mb-0.5">{r.report_date}</p>
                    <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{r.content}</p>
                  </div>
                  <form action={deleteReport.bind(null, r.id, student.id, cls.id)}>
                    <button type="submit" className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                  </form>
                </div>
              ))}
            </div>
          )}
          {reports.length === 0 && !showForm && (
            <p className="text-xs text-gray-400 dark:text-slate-500">Henüz rapor yok.</p>
          )}

          {showForm ? (
            <form
              action={async (fd) => {
                start(() => { addReport(student.id, cls.id, fd) })
                setShowForm(false)
              }}
              className="space-y-2"
            >
              <input
                name="report_date"
                type="date"
                defaultValue={today()}
                required
                className={inputCls}
              />
              <textarea
                name="content"
                rows={3}
                placeholder="Rapor içeriği…"
                required
                minLength={5}
                className={inputCls + ' resize-none'}
              />
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700">
                  Kaydet
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400">
                  İptal
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Rapor ekle
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function MentorlukClient({
  systemClasses,
  manualStudents,
  reportsByStudent,
  addMentorStudent,
  deleteMentorStudent,
  addMentorStudentNote,
  deleteMentorStudentNote,
  addMentorReport,
  deleteMentorReport,
}: {
  systemClasses: SystemClass[]
  manualStudents: ManualStudent[]
  reportsByStudent: Record<string, MentorReport[]>
  addMentorStudent: (fd: FormData) => Promise<void>
  deleteMentorStudent: (id: string) => Promise<void>
  addMentorStudentNote: (fd: FormData) => Promise<void>
  deleteMentorStudentNote: (id: string) => Promise<void>
  addMentorReport: (studentId: string, classId: string, fd: FormData) => Promise<void>
  deleteMentorReport: (reportId: string, studentId: string, classId: string) => Promise<void>
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [, start] = useTransition()

  const allSystemStudents = systemClasses.flatMap(cls =>
    cls.students.map(s => ({ student: s, cls }))
  ).sort((a, b) => a.student.full_name.localeCompare(b.student.full_name, 'tr'))

  return (
    <div className="space-y-8">
      {/* Atanmış öğrenciler */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
          Atanmış Sınıf Öğrencileri
          {allSystemStudents.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">({allSystemStudents.length} öğrenci)</span>
          )}
        </h2>
        {allSystemStudents.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-6 text-center">
            <p className="text-sm text-gray-400 dark:text-slate-500">
              Henüz mentor olarak atandığınız bir sınıf yok.
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Atama için Müdür Yardımcısı ile iletişime geçin.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {allSystemStudents.map(({ student, cls }) => (
              <SystemStudentRow
                key={student.id}
                student={student}
                cls={cls}
                reports={reportsByStudent[student.id] ?? []}
                addReport={addMentorReport}
                deleteReport={deleteMentorReport}
              />
            ))}
          </div>
        )}
      </section>

      {/* Manuel öğrenciler */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            Kendi Eklediğim Öğrenciler
            {manualStudents.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">({manualStudents.length})</span>
            )}
          </h2>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showAddForm ? 'İptal' : '+ Öğrenci Ekle'}
          </button>
        </div>

        {showAddForm && (
          <form
            action={async (fd) => {
              start(() => { addMentorStudent(fd) })
              setShowAddForm(false)
            }}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-3 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Ad Soyad *</label>
                <input name="full_name" type="text" required minLength={2} placeholder="Ahmet Yılmaz" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Anne / Baba Adı</label>
                <input name="parent_name" type="text" placeholder="Mehmet Yılmaz" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Telefon</label>
                <input name="phone" type="tel" placeholder="0532 xxx xx xx" className={inputCls} />
              </div>
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Ekle
            </button>
          </form>
        )}

        {manualStudents.length === 0 && !showAddForm ? (
          <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-6 text-center">
            <p className="text-sm text-gray-400 dark:text-slate-500">Henüz öğrenci eklemediniz.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {manualStudents.map(student => (
              <ManualStudentCard
                key={student.id}
                student={student}
                addNote={addMentorStudentNote}
                deleteNote={deleteMentorStudentNote}
                deleteStudent={deleteMentorStudent}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import ExportButtons from './ExportButtons'

interface ClassItem {
  id: string
  name: string
  grade: number | null
}

interface StudentItem {
  id: string
  full_name: string
}

interface OgrenciRaporClientProps {
  classes: ClassItem[]
  schoolId: string
}

interface RaporData {
  odevTamamlama: { name: string; value: number; color: string }[]
  devamsizlik: { name: string; value: number; color: string }[]
  haftalikTrend: { hafta: string; tamamlama: number }[]
  notOrtalaması: number | null
  toplamOdev: number
  yoklamaGun: number
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

export default function OgrenciRaporClient({ classes, schoolId }: OgrenciRaporClientProps) {
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.id ?? '')
  const [students, setStudents] = useState<StudentItem[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RaporData | null>(null)

  // Sınıf değişince öğrenci listesini doldur
  useEffect(() => {
    if (!selectedClass) { setStudents([]); setSelectedStudent(''); return }
    const db = createSupabase()
    db.from('students')
      .select('id, full_name')
      .eq('class_id', selectedClass)
      .eq('school_id', schoolId)
      .order('full_name')
      .then(({ data }) => {
        const list = (data ?? []) as StudentItem[]
        setStudents(list)
        setSelectedStudent(list[0]?.id ?? '')
      })
  }, [selectedClass, schoolId])

  const fetchData = useCallback(async () => {
    if (!selectedStudent) return
    setLoading(true)
    setError(null)
    try {
      const db = createSupabase()

      // Ödev istatistikleri
      const { data: submissions } = await db
        .from('homework_submissions')
        .select('status, homework_id, homeworks(assigned_date)')
        .eq('student_id', selectedStudent)
        .gte('homeworks.assigned_date', dateFrom)
        .lte('homeworks.assigned_date', dateTo)
        .limit(1000)

      const submissionsData = (submissions ?? [] as unknown[]) as {
        status: string
        homework_id: string
        homeworks: { assigned_date: string } | null
      }[]

      const yapildi = submissionsData.filter(s => s.status === 'yapildi').length
      const eksik = submissionsData.filter(s => s.status === 'eksik').length
      const yapilmadi = submissionsData.filter(s => ['yapilmadi', 'gec', 'mazeretli'].includes(s.status)).length
      const total = submissionsData.length

      const odevTamamlama = [
        { name: 'Yapıldı', value: yapildi, color: '#22c55e' },
        { name: 'Eksik', value: eksik, color: '#f59e0b' },
        { name: 'Yapılmadı', value: yapilmadi, color: '#ef4444' },
      ].filter(d => d.value > 0)

      // Devamsızlık
      const { data: attendanceData } = await db
        .from('attendance')
        .select('status')
        .eq('student_id', selectedStudent)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .limit(500)

      const att = (attendanceData ?? []) as { status: string }[]
      const present = att.filter(a => a.status === 'present').length
      const absent = att.filter(a => a.status === 'absent').length
      const late = att.filter(a => a.status === 'late').length

      const devamsizlik = [
        { name: 'Var', value: present, color: '#22c55e' },
        { name: 'Yok', value: absent, color: '#ef4444' },
        { name: 'Geç', value: late, color: '#f59e0b' },
      ].filter(d => d.value > 0)

      // Haftalık ödev trendi (son 8 hafta)
      const haftalikTrend: { hafta: string; tamamlama: number }[] = []
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - i * 7 - weekStart.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)

        const ws = weekStart.toISOString().split('T')[0]
        const we = weekEnd.toISOString().split('T')[0]

        const weekSubs = submissionsData.filter(s => {
          const d = s.homeworks?.assigned_date ?? ''
          return d >= ws && d <= we
        })
        const weekTotal = weekSubs.length
        const weekDone = weekSubs.filter(s => s.status === 'yapildi').length
        const oran = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0

        haftalikTrend.push({
          hafta: `H${8 - i}`,
          tamamlama: oran,
        })
      }

      // Not ortalaması
      const { data: examData } = await db
        .from('exam_entries')
        .select('grade')
        .eq('student_id', selectedStudent)
        .eq('school_id', schoolId)
        .limit(100)

      const exams = (examData ?? []) as { grade: number }[]
      const notOrtalaması = exams.length > 0
        ? Math.round((exams.reduce((s, e) => s + e.grade, 0) / exams.length) * 10) / 10
        : null

      setData({
        odevTamamlama,
        devamsizlik,
        haftalikTrend,
        notOrtalaması,
        toplamOdev: total,
        yoklamaGun: att.length,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [selectedStudent, dateFrom, dateTo])

  useEffect(() => {
    if (selectedStudent) fetchData()
  }, [selectedStudent, fetchData])

  return (
    <div className="space-y-6">
      {/* Filtreler */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Sınıf</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              <option value="">— Sınıf seçin —</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Öğrenci</label>
            <select
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
              disabled={students.length === 0}
              className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] disabled:opacity-50"
            >
              <option value="">— Öğrenci seçin —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Başlangıç</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Bitiş</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={fetchData}
            disabled={!selectedStudent || loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {loading ? 'Yükleniyor…' : 'Raporu Getir'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && <RaporSkeleton />}

      {!loading && data && (
        <>
          {/* Özet kartlar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Toplam Ödev" value={String(data.toplamOdev)} />
            <SummaryCard label="Yoklama Günü" value={String(data.yoklamaGun)} />
            <SummaryCard
              label="Not Ortalaması"
              value={data.notOrtalaması !== null ? String(data.notOrtalaması) : '—'}
            />
            <SummaryCard
              label="Tamamlama %"
              value={data.odevTamamlama.length > 0
                ? `%${Math.round((data.odevTamamlama.find(d => d.name === 'Yapıldı')?.value ?? 0) / data.toplamOdev * 100)}`
                : '—'
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PieChart: ödev tamamlama */}
            {data.odevTamamlama.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Ödev Tamamlama Oranı</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.odevTamamlama}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {data.odevTamamlama.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* BarChart: devamsızlık */}
            {data.devamsizlik.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Devamsızlık İstatistikleri</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.devamsizlik}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Gün">
                      {data.devamsizlik.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* LineChart: haftalık trend */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Haftalık Ödev Tamamlama Trendi (Son 8 Hafta)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.haftalikTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hafta" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v) => [`%${v}`, 'Tamamlama']} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="tamamlama"
                  name="Tamamlama %"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <ExportButtons
            odevTamamlama={data.odevTamamlama}
            devamsizlik={data.devamsizlik}
            haftalikTrend={data.haftalikTrend}
            notOrtalaması={data.notOrtalaması}
            studentName={students.find(s => s.id === selectedStudent)?.full_name ?? 'Öğrenci'}
          />
        </>
      )}

      {!loading && !data && selectedStudent && (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500 text-sm">
          Raporu getirmek için yukarıdaki butona tıklayın.
        </div>
      )}

      {!loading && !selectedStudent && (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500 text-sm">
          Rapor görmek için bir sınıf ve öğrenci seçin.
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

function RaporSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      </div>
      <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import * as XLSX from 'xlsx'

interface Teacher {
  id: string
  full_name: string
  subject: string | null
}

interface OgretmenPerformansProps {
  teachers: Teacher[]
  currentUserId: string
  schoolId: string
}

interface PerformansData {
  aylikOdevler: { ay: string; sayi: number }[]
  yoklamaSikligi: number
  mufredat: number
  odevKontrolHizi: number | null
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

const MONTH_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

export default function OgretmenPerformans({ teachers, currentUserId, schoolId }: OgretmenPerformansProps) {
  const [selectedTeacher, setSelectedTeacher] = useState<string>(currentUserId || teachers[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PerformansData | null>(null)
  const [xlsxLoading, setXlsxLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!selectedTeacher) return
    setLoading(true)
    setError(null)
    try {
      const db = createSupabase()
      const now = new Date()

      // Son 6 ay ödev sayısı
      const aylikOdevler: { ay: string; sayi: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const ayStart = d.toISOString().split('T')[0]
        const ayEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]

        const { count } = await db
          .from('homeworks')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', selectedTeacher)
          .eq('school_id', schoolId)
          .gte('assigned_date', ayStart)
          .lte('assigned_date', ayEnd)

        aylikOdevler.push({ ay: MONTH_LABELS[d.getMonth()], sayi: count ?? 0 })
      }

      // Yoklama sıklığı (son 4 hafta) — seçili öğretmene göre
      const fourWeeksAgo = new Date(now.getTime() - 28 * 86400_000).toISOString().split('T')[0]
      const { data: yoklamaData } = await db
        .from('attendance')
        .select('date')
        .eq('school_id', schoolId)
        .eq('teacher_id', selectedTeacher)
        .gte('date', fourWeeksAgo)
        .limit(1000)

      const uniqueDates = new Set(((yoklamaData ?? []) as { date: string }[]).map(a => a.date))
      const yoklamaSikligi = uniqueDates.size

      // Müfredat tamamlama
      const { data: currTotal } = await db
        .from('curriculum_progress')
        .select('status')
        .eq('teacher_id', selectedTeacher)
        .eq('school_id', schoolId)
        .limit(1000)

      const curr = (currTotal ?? []) as { status: string }[]
      const tamamlandi = curr.filter(c => c.status === 'tamamlandi').length
      const mufredat = curr.length > 0 ? Math.round((tamamlandi / curr.length) * 100) : 0

      // Ödev kontrol hızı: homework_submissions updated_at - homework due_date ortalama fark
      const { data: homeworkIds } = await db
        .from('homeworks')
        .select('id, due_date')
        .eq('teacher_id', selectedTeacher)
        .eq('school_id', schoolId)
        .limit(50)

      let odevKontrolHizi: number | null = null
      const hwList = (homeworkIds ?? []) as { id: string; due_date: string }[]
      if (hwList.length > 0) {
        const { data: subData } = await db
          .from('homework_submissions')
          .select('updated_at, homework_id')
          .in('homework_id', hwList.map(h => h.id))
          .neq('status', 'yapilmadi')
          .limit(500)

        const subs = (subData ?? []) as { updated_at: string; homework_id: string }[]
        if (subs.length > 0) {
          const diffs = subs.map(s => {
            const hw = hwList.find(h => h.id === s.homework_id)
            if (!hw) return 0
            return (new Date(s.updated_at).getTime() - new Date(hw.due_date).getTime()) / 86400_000
          })
          odevKontrolHizi = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
        }
      }

      setData({ aylikOdevler, yoklamaSikligi, mufredat, odevKontrolHizi })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [selectedTeacher, schoolId])

  useEffect(() => {
    if (selectedTeacher) fetchData()
  }, [selectedTeacher, fetchData])

  function handleXlsx() {
    if (!data) return
    setXlsxLoading(true)
    try {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { 'Metrik': 'Müfredat Tamamlama %', 'Değer': data.mufredat },
        { 'Metrik': 'Yoklama Sıklığı (son 4 hafta, gün)', 'Değer': data.yoklamaSikligi },
        { 'Metrik': 'Ödev Kontrol Hızı (ortalama gün)', 'Değer': data.odevKontrolHizi ?? '—' },
      ]), 'Özet')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        data.aylikOdevler.map(a => ({ 'Ay': a.ay, 'Ödev Sayısı': a.sayi }))
      ), 'Aylık Ödevler')
      const date = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `ogretmen-performans-${date}.xlsx`)
    } finally {
      setXlsxLoading(false)
    }
  }

  async function handlePdf() {
    if (!data) return
    setPdfLoading(true)
    setPdfError(null)
    try {
      const { createDoc } = await import('@/src/lib/createPdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = await createDoc()
      const teacherName = teachers.find(t => t.id === selectedTeacher)?.full_name ?? ''
      const date = new Date().toLocaleDateString('tr-TR')

      doc.setFontSize(16)
      doc.text(`Öğretmen Performansı: ${teacherName}`, 14, 18)
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Oluşturulma: ${date}`, 14, 26)
      doc.setTextColor(0)
      doc.setFontSize(11)
      doc.text(`Müfredat Tamamlama: %${data.mufredat}`, 14, 36)
      doc.text(`Yoklama Sıklığı (son 4 hafta): ${data.yoklamaSikligi} gün`, 14, 44)
      if (data.odevKontrolHizi !== null) {
        doc.text(`Ödev Kontrol Hızı: ${data.odevKontrolHizi} gün (ortalama)`, 14, 52)
      }

      autoTable(doc, {
        head: [['Ay', 'Ödev Sayısı']],
        body: data.aylikOdevler.map(a => [a.ay, a.sayi]),
        startY: 62,
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      })

      doc.save(`ogretmen-performans-${teacherName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'PDF oluşturulamadı')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Öğretmen seçici */}
      {teachers.length > 1 && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Öğretmen</label>
          <select
            value={selectedTeacher}
            onChange={e => setSelectedTeacher(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
          >
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.full_name}{t.subject ? ` (${t.subject})` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
          <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">%{data.mufredat}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Müfredat Tamamlama</p>
              <div className="mt-2 w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${data.mufredat}%` }} />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{data.yoklamaSikligi} gün</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Yoklama Sıklığı (son 4 hafta)</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {data.odevKontrolHizi !== null ? `${data.odevKontrolHizi} gün` : '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Ödev Kontrol Hızı (ort.)</p>
            </div>
          </div>

          {/* Aylık ödev bar chart */}
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Aylık Ödev Sayısı (Son 6 Ay)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.aylikOdevler}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ay" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sayi" name="Ödev Sayısı" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Export */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleXlsx}
              disabled={xlsxLoading}
              className="flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {xlsxLoading ? 'İndiriliyor…' : 'Excel İndir'}
            </button>
            <div className="flex flex-col items-start gap-1">
              <button
                onClick={handlePdf}
                disabled={pdfLoading}
                className="flex items-center gap-2 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition-colors min-h-[40px] shadow-sm"
              >
                {pdfLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Hazırlanıyor…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    PDF İndir
                  </>
                )}
              </button>
              {pdfError && <p className="text-xs text-red-500">{pdfError}</p>}
            </div>
          </div>
        </>
      )}

      {!loading && !data && (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500 text-sm">
          Veri bulunamadı.
        </div>
      )}
    </div>
  )
}

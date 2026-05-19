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

interface ClassItem {
  id: string
  name: string
  grade: number | null
}

interface StudentStat {
  name: string
  tamamlama: number
}

interface SinifData {
  ortalamaOdev: number
  ortalamaDevamsizlik: number
  enAktif: StudentStat[]
  enPasif: StudentStat[]
  sinifKarsilastirma: { sinif: string; oran: number }[]
}

interface SinifIstatistiklerProps {
  classes: ClassItem[]
  schoolId: string
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

export default function SinifIstatistikler({ classes, schoolId }: SinifIstatistiklerProps) {
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SinifData | null>(null)
  const [xlsxLoading, setXlsxLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!selectedClass) return
    setLoading(true)
    setError(null)
    try {
      const db = createSupabase()

      // Öğrencileri çek
      const { data: studentsData } = await db
        .from('students')
        .select('id, full_name')
        .eq('class_id', selectedClass)
        .eq('school_id', schoolId)
        .limit(100)

      const students = (studentsData ?? []) as { id: string; full_name: string }[]

      // Tüm submissions
      const { data: submissionsData } = await db
        .from('homework_submissions')
        .select('student_id, status')
        .in('student_id', students.map(s => s.id))
        .limit(5000)

      const submissions = (submissionsData ?? []) as { student_id: string; status: string }[]

      // Her öğrenci için tamamlama oranı
      const studentStats: StudentStat[] = students.map(s => {
        const subs = submissions.filter(sub => sub.student_id === s.id)
        const done = subs.filter(sub => sub.status === 'yapildi').length
        const oran = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0
        return { name: s.full_name, tamamlama: oran }
      })

      const sorted = [...studentStats].sort((a, b) => b.tamamlama - a.tamamlama)
      const enAktif = sorted.slice(0, 5)
      const enPasif = sorted.slice(-5).reverse()

      const ortalamaOdev = studentStats.length > 0
        ? Math.round(studentStats.reduce((s, st) => s + st.tamamlama, 0) / studentStats.length)
        : 0

      // Devamsızlık ortalaması
      const { data: attData } = await db
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', selectedClass)
        .eq('school_id', schoolId)
        .eq('status', 'absent')
        .limit(5000)

      const absences = (attData ?? []) as { student_id: string; status: string }[]
      const ortalamaDevamsizlik = students.length > 0
        ? Math.round(absences.length / students.length)
        : 0

      // Tüm sınıflar karşılaştırma
      const sinifKarsilastirma: { sinif: string; oran: number }[] = []
      for (const cls of classes.slice(0, 10)) {
        const { data: clsStudents } = await db
          .from('students')
          .select('id')
          .eq('class_id', cls.id)
          .eq('school_id', schoolId)
          .limit(100)

        const ids = ((clsStudents ?? []) as { id: string }[]).map(s => s.id)
        if (ids.length === 0) { sinifKarsilastirma.push({ sinif: cls.name, oran: 0 }); continue }

        const { data: clsSubs } = await db
          .from('homework_submissions')
          .select('status')
          .in('student_id', ids)
          .limit(2000)

        const subs = (clsSubs ?? []) as { status: string }[]
        const done = subs.filter(s => s.status === 'yapildi').length
        const oran = subs.length > 0 ? Math.round((done / subs.length) * 100) : 0
        sinifKarsilastirma.push({ sinif: cls.name, oran })
      }

      setData({ ortalamaOdev, ortalamaDevamsizlik, enAktif, enPasif, sinifKarsilastirma })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [selectedClass, schoolId, classes])

  useEffect(() => {
    if (selectedClass) fetchData()
  }, [selectedClass, fetchData])

  function handleXlsx() {
    if (!data) return
    setXlsxLoading(true)
    try {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { 'Metrik': 'Ortalama Ödev Tamamlama %', 'Değer': data.ortalamaOdev },
        { 'Metrik': 'Ortalama Devamsızlık (gün)', 'Değer': data.ortalamaDevamsizlik },
      ]), 'Özet')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        data.enAktif.map(s => ({ 'Öğrenci': s.name, 'Tamamlama %': s.tamamlama }))
      ), 'En Aktif')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        data.enPasif.map(s => ({ 'Öğrenci': s.name, 'Tamamlama %': s.tamamlama }))
      ), 'En Pasif')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        data.sinifKarsilastirma.map(s => ({ 'Sınıf': s.sinif, 'Ortalama %': s.oran }))
      ), 'Sınıf Karşılaştırma')
      const date = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `sinif-istatistik-${date}.xlsx`)
    } finally {
      setXlsxLoading(false)
    }
  }

  async function handlePdf() {
    if (!data) return
    setPdfLoading(true)
    try {
      const { createDoc } = await import('@/src/lib/createPdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = await createDoc()
      const sinifAd = classes.find(c => c.id === selectedClass)?.name ?? ''
      const date = new Date().toLocaleDateString('tr-TR')

      doc.setFontSize(16)
      doc.text(`Sınıf İstatistikleri: ${sinifAd}`, 14, 18)
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Oluşturulma: ${date}`, 14, 26)
      doc.setTextColor(0)
      doc.setFontSize(11)
      doc.text(`Ortalama Ödev Tamamlama: %${data.ortalamaOdev}`, 14, 36)
      doc.text(`Ortalama Devamsızlık: ${data.ortalamaDevamsizlik} gün`, 14, 44)

      let y = 54
      autoTable(doc, {
        head: [['En Aktif Öğrenciler', 'Tamamlama %']],
        body: data.enAktif.map(s => [s.name, `%${s.tamamlama}`]),
        startY: y,
        headStyles: { fillColor: [22, 163, 74] },
        margin: { left: 14, right: 14 },
      })
      y = doc.lastAutoTable?.finalY ?? y + 30
      y += 6

      autoTable(doc, {
        head: [['En Pasif Öğrenciler', 'Tamamlama %']],
        body: data.enPasif.map(s => [s.name, `%${s.tamamlama}`]),
        startY: y,
        headStyles: { fillColor: [239, 68, 68] },
        margin: { left: 14, right: 14 },
      })
      y = doc.lastAutoTable?.finalY ?? y + 30
      y += 6

      autoTable(doc, {
        head: [['Sınıf', 'Ortalama %']],
        body: data.sinifKarsilastirma.map(s => [s.sinif, `%${s.oran}`]),
        startY: y,
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      })

      doc.save(`sinif-istatistik-${sinifAd.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtre */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Sınıf</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {loading ? 'Yükleniyor…' : 'Getir'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
          <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-80 bg-gray-100 dark:bg-slate-800 rounded-xl" />
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">%{data.ortalamaOdev}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Ortalama Ödev Tamamlama</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{data.ortalamaDevamsizlik} gün</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Ortalama Devamsızlık</p>
            </div>
          </div>

          {/* En aktif / pasif */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">En Aktif 5 Öğrenci</h3>
              {data.enAktif.length === 0 ? (
                <p className="text-sm text-gray-400">Veri bulunamadı</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.enAktif} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`%${v}`, 'Tamamlama']} />
                    <Bar dataKey="tamamlama" name="Tamamlama %" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">En Pasif 5 Öğrenci</h3>
              {data.enPasif.length === 0 ? (
                <p className="text-sm text-gray-400">Veri bulunamadı</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.enPasif} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`%${v}`, 'Tamamlama']} />
                    <Bar dataKey="tamamlama" name="Tamamlama %" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Sınıf karşılaştırma */}
          {data.sinifKarsilastirma.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Sınıf Karşılaştırma — Ödev Tamamlama Ortalaması</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.sinifKarsilastirma}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sinif" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => [`%${v}`, 'Ortalama']} />
                  <Legend />
                  <Bar dataKey="oran" name="Tamamlama %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

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
            <button
              onClick={handlePdf}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {pdfLoading ? 'Hazırlanıyor…' : 'PDF İndir'}
            </button>
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

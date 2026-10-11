'use client'

import { useState } from 'react'
import { getAylikRapor } from '@/app/actions/karne'
import { buildAylikRaporPdf } from './aylikRaporPdf'
import { raporAyi } from '@/src/domains/dashboard/lib/aylikRapor'
import { format, parseISO, todayLocalISO } from '@/src/shared/date'
import { useToast } from '@/components/Toast'

export default function AylikRaporButton() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const ay = format(parseISO(`${raporAyi(todayLocalISO())}-01`), 'MMMM')

  async function handleClick() {
    setLoading(true)
    try {
      await buildAylikRaporPdf(await getAylikRapor())
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Rapor oluşturulamadı', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Bu ay ile geçen ayın karşılaştırması — kurucuya/bölgeye tek sayfa"
      className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Hazırlanıyor…' : `${ay} raporu (PDF)`}
    </button>
  )
}

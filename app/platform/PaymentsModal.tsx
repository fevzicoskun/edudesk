'use client'

import { useActionState, useEffect, useState } from 'react'
import { recordPayment, listSchoolPayments, type PaymentRow } from './actions'

const tl = (kurus: number) =>
  (kurus / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })

export default function PaymentsModal({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [open, setOpen] = useState(false)
  const [payments, setPayments] = useState<PaymentRow[] | null>(null)
  const [state, formAction, pending] = useActionState(recordPayment, null)

  useEffect(() => {
    if (!open) return
    listSchoolPayments(schoolId).then(r => setPayments(r.payments ?? []))
  }, [open, schoolId, state?.ok])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-400 border border-slate-700 rounded-lg px-3 py-1 hover:text-slate-200 hover:border-slate-500 transition-colors"
      >
        Ödemeler
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">{schoolName} — Ödemeler</h2>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        {payments === null ? (
          <p className="text-slate-500 text-sm">Yükleniyor…</p>
        ) : payments.length === 0 ? (
          <p className="text-slate-500 text-sm">Henüz ödeme kaydı yok.</p>
        ) : (
          <table className="w-full text-sm mb-5">
            <thead>
              <tr className="text-slate-500 text-xs text-left">
                <th className="pb-2 font-medium">Ödeme</th>
                <th className="pb-2 font-medium">Tutar</th>
                <th className="pb-2 font-medium">Dönem</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-t border-slate-800 text-slate-300">
                  <td className="py-2">{p.paid_at}</td>
                  <td className="py-2">{tl(p.amount_kurus)}</td>
                  <td className="py-2 text-slate-400">{p.period_start} → {p.period_end}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={formAction} className="space-y-3 border-t border-slate-800 pt-4">
          <input type="hidden" name="school_id" value={schoolId} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-400">Tutar (TL)
              <input name="amount_tl" type="number" step="0.01" min="1" required
                className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
            </label>
            <label className="block text-xs font-medium text-slate-400">Ödeme tarihi
              <input name="paid_at" type="date" required
                className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
            </label>
            <label className="block text-xs font-medium text-slate-400">Dönem başı
              <input name="period_start" type="date" required
                className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
            </label>
            <label className="block text-xs font-medium text-slate-400">Dönem sonu
              <input name="period_end" type="date" required
                className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-400">Not
            <input name="note" maxLength={300} placeholder="Havale açıklaması vb."
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
          </label>
          {state?.error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{state.error}</p>
          )}
          {state?.ok && <p className="text-emerald-400 text-xs">Ödeme kaydedildi, erişim tarihi güncellendi.</p>}
          <button type="submit" disabled={pending}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {pending ? 'Kaydediliyor…' : 'Ödeme Kaydet'}
          </button>
        </form>
      </div>
    </div>
  )
}

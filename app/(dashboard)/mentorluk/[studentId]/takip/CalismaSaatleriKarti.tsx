'use client'
import { useState, useTransition } from 'react'
import { calismaSaatleriKaydet } from '@/app/actions/mentor-takip'
import { GUNLER } from '@/src/domains/mentor/takip/takipMath'
import { BOS_SAATLER, netSure, sureKisa, type CalismaSaatleri, type GunSaati } from '@/src/domains/mentor/takip/calismaSaatleri'
import type { SekmeProps } from './TakipIstemci'

const kutu = 'rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm'

/** Öğrenciye ait (haftadan bağımsız) çalışma saatleri. Boş başlangıç/bitiş = o gün çalışma yok. */
export default function CalismaSaatleriKarti({ v }: Pick<SekmeProps, 'v'>) {
  const ilk = v.saatler ?? BOS_SAATLER
  const [not, setNot] = useState(ilk.not)
  const [molaAcik, setMolaAcik] = useState(() => ilk.gunler.map(g => !!g?.molaBas))
  const [mesaj, setMesaj] = useState<{ hata: boolean; metin: string } | null>(null)
  const [bekliyor, basla] = useTransition()

  // Satır taslağı: yarım girilmiş gün (yalnız başlangıç) de tutulur; kaydedilecek gün ikisi de doluysa oluşur
  const [taslak, setTaslak] = useState(() => ilk.gunler.map(g => ({ bas: g?.bas ?? '', bit: g?.bit ?? '', molaBas: g?.molaBas ?? '', molaBit: g?.molaBit ?? '' })))
  const gunOf = (t: typeof taslak[0], mola: boolean): GunSaati | null =>
    t.bas && t.bit ? { bas: t.bas, bit: t.bit, ...(mola && t.molaBas && t.molaBit && { molaBas: t.molaBas, molaBit: t.molaBit }) } : null
  const gunler = taslak.map((t, j) => gunOf(t, molaAcik[j]))
  const s: CalismaSaatleri = { gunler, not }
  const yaz = (i: number, p: Partial<typeof taslak[0]>) => setTaslak(x => x.map((t, j) => (j === i ? { ...t, ...p } : t)))
  const haftaIci = (j: number) => j >= 1 && j <= 4
  const haftaIcineUygula = () => {
    setTaslak(x => x.map((t, j) => (haftaIci(j) ? { ...x[0] } : t)))
    setMolaAcik(x => x.map((m, j) => (haftaIci(j) ? x[0] : m)))
  }

  return (
    <section aria-label="Çalışma saatleri">
      <h2 className="text-base font-semibold mb-1">Çalışma saatleri</h2>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Öğrenciye aittir, her hafta geçerlidir. Boş bırakılan gün = çalışma yok.</p>
      <div className="space-y-1">
        {GUNLER.map((gun, i) => (
          <div key={gun} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-8 font-medium">{gun}</span>
            <input type="time" aria-label={`${gun} başlangıç`} className={kutu} value={taslak[i].bas} onChange={e => yaz(i, { bas: e.target.value })} />–
            <input type="time" aria-label={`${gun} bitiş`} className={kutu} value={taslak[i].bit} onChange={e => yaz(i, { bit: e.target.value })} />
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={molaAcik[i]} onChange={e => setMolaAcik(x => x.map((m, j) => (j === i ? e.target.checked : m)))} /> Mola
            </label>
            {molaAcik[i] && <>
              <input type="time" aria-label={`${gun} mola başlangıç`} className={kutu} value={taslak[i].molaBas} onChange={e => yaz(i, { molaBas: e.target.value })} />–
              <input type="time" aria-label={`${gun} mola bitiş`} className={kutu} value={taslak[i].molaBit} onChange={e => yaz(i, { molaBit: e.target.value })} />
            </>}
            <span className="text-gray-500 dark:text-slate-400 tabular-nums">{gunler[i] ? `${gun}: ${sureKisa(netSure(gunler[i]))}` : 'çalışma yok'}</span>
            {i === 0 && <button type="button" className="text-blue-700 dark:text-blue-400 underline text-xs" onClick={haftaIcineUygula}>Hafta içi hepsine uygula</button>}
          </div>
        ))}
      </div>
      <label className="text-sm block mt-2">Not
        <input maxLength={300} placeholder="ör. Salı kurs var, 19.00'dan sonra" className={`${kutu} block w-full max-w-xl`} value={not} onChange={e => setNot(e.target.value)} />
      </label>
      <div className="flex items-center gap-3 mt-2">
        <button type="button" disabled={bekliyor} className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm"
          onClick={() => basla(async () => {
            const r = await calismaSaatleriKaydet(v.ogrenci.id, s)
            setMesaj(r.error ? { hata: true, metin: r.error } : { hata: false, metin: 'Çalışma saatleri kaydedildi.' })
          })}>Kaydet</button>
        {mesaj && <span role={mesaj.hata ? 'alert' : 'status'} className={`text-sm ${mesaj.hata ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{mesaj.metin}</span>}
      </div>
    </section>
  )
}

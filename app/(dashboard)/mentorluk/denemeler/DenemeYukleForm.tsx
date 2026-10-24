'use client'
import { useState, useTransition } from 'react'
import { denemeOnizle, denemeKaydet } from '@/app/actions/deneme'
import { netYaz } from '@/src/domains/mentor/deneme/stoys'
import { gunAy } from '@/src/domains/mentor/lib/bultenMath'
import type { Onizleme } from '@/src/domains/mentor/deneme/DenemeService'

const kutu = 'block mt-1 w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-base md:text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100'
const birincil = 'px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'

/** Dosya + tarih → önizleme (eşleşen, katılmadı + elle eşleştirme, alınmayan satır sayısı) → kaydet. Netler asla elle yazılmaz. */
export default function DenemeYukleForm({ bugun }: { bugun: string }) {
  const [tarih, setTarih] = useState(bugun)
  const [on, setOn] = useState<Onizleme | null>(null)
  const [eslek, setEslek] = useState<Record<string, number>>({}) // katılmayan öğrenci → eşleşmeyen satır sırası
  const [ayni, setAyni] = useState(true) // önerilen sınavla aynı mı
  const [hata, setHata] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [bekliyor, basla] = useTransition()

  const onizle = (fd: FormData) => basla(async () => {
    setHata(''); setMesaj(''); setOn(null); setEslek({})
    const r = await denemeOnizle(fd)
    if ('error' in r) { setHata(r.error); return }
    setOn(r); setAyni(!!r.oneri)
  })

  const kullanilan = new Set(Object.values(eslek))
  const kaydet = () => on && basla(async () => {
    setHata('')
    const elle = Object.entries(eslek).map(([studentId, i]) => ({ studentId, satir: on.eslesme.eslesmeyenSatirlar[i] }))
    const sonuclar = [...on.eslesme.eslesen, ...elle].filter(e => e.satir.dersler.length > 0)
      .map(e => ({ studentId: e.studentId, dersler: e.satir.dersler, toplamNet: e.satir.toplamNet, puan: e.satir.puan }))
    const r = await denemeKaydet({ tur: on.tur, seviye: on.seviye, tarih, sinifId: on.sinifId, sinavId: ayni && on.oneri ? on.oneri.sinavId : undefined, sonuclar })
    if (r.error) { setHata(r.error); return }
    setMesaj(`${r.kaydedilen} öğrencinin sonucu kaydedildi.`); setOn(null); setEslek({})
  })

  const ad = (id: string) => on?.ogrenciAdlari[id] ?? '—'
  return (
    <div className="space-y-4">
      <form action={onizle} className="flex flex-wrap items-end gap-3 border border-gray-200 dark:border-slate-700 rounded-lg p-3">
        <label className="text-sm text-gray-700 dark:text-slate-300 flex-1 min-w-56">Stoys Excel dosyası
          <input type="file" name="file" accept=".xlsx" required className={kutu} />
        </label>
        <label className="text-sm text-gray-700 dark:text-slate-300">Sınav tarihi
          <input type="date" value={tarih} max={bugun} onChange={e => setTarih(e.target.value)} required className={kutu} />
        </label>
        <button className={birincil} disabled={bekliyor}>{bekliyor && !on ? 'Okunuyor…' : 'Önizle'}</button>
      </form>
      {hata && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{hata}</p>}
      {mesaj && <p role="status" className="text-sm text-green-700 dark:text-green-300">{mesaj}</p>}

      {on && (
        <section aria-label="Önizleme" className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-3">
          <h2 className="font-semibold">{on.tur} · {on.sinif}</h2>
          {on.oneri && (
            <fieldset className="text-sm space-y-1">
              <legend className="text-gray-600 dark:text-slate-400">Son iki haftada aynı tür sınav yüklenmiş:</legend>
              <label className="flex items-center gap-2"><input type="radio" name="sinav" checked={ayni} onChange={() => setAyni(true)} />
                {gunAy(on.oneri.tarih)} tarihli {on.tur} ile aynı sınav</label>
              <label className="flex items-center gap-2"><input type="radio" name="sinav" checked={!ayni} onChange={() => setAyni(false)} />
                Yeni sınav ({gunAy(tarih)})</label>
            </fieldset>
          )}
          <table className="w-full text-sm border-collapse">
            <thead><tr className="text-left text-gray-600 dark:text-slate-400"><th className="py-1">Öğrenci</th><th className="py-1">Toplam net</th></tr></thead>
            <tbody>
              {on.eslesme.eslesen.map(e => (
                <tr key={e.studentId} className="border-t border-gray-200 dark:border-slate-700"><td className="py-1">{ad(e.studentId)}</td><td className="py-1">{netYaz(e.satir.toplamNet)}</td></tr>
              ))}
              {on.eslesme.katilmayan.map(id => (
                <tr key={id} className="border-t border-gray-200 dark:border-slate-700">
                  <td className="py-1">{ad(id)}</td>
                  <td className="py-1">
                    {/* Ad yazımı farklıysa dosyadaki eşleşmemiş satırla elle eşleştir; seçilmezse "katılmadı" sayılır */}
                    <select aria-label={`${ad(id)} için dosyadaki satır`} value={eslek[id] ?? ''} className={kutu}
                      onChange={e => setEslek(({ [id]: _, ...k }) => e.target.value === '' ? k : { ...k, [id]: Number(e.target.value) })}>
                      <option value="">Dosyada bulunamadı (katılmadı)</option>
                      {on.eslesme.eslesmeyenSatirlar.map((s, i) => (kullanilan.has(i) && eslek[id] !== i ? null :
                        <option key={i} value={i}>{s.ad} · {netYaz(s.toplamNet)}</option>))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {on.eslesme.eslesmeyenSatirlar.length - kullanilan.size > 0 && (
            <p className="text-sm text-gray-500 dark:text-slate-400">{on.eslesme.eslesmeyenSatirlar.length - kullanilan.size} satır başka öğrencilere ait, alınmadı.</p>
          )}
          <button type="button" onClick={kaydet} disabled={bekliyor} className={birincil}>{bekliyor ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </section>
      )}
    </div>
  )
}

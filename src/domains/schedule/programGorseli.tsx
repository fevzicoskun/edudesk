// src/domains/schedule/programGorseli.tsx
// Ders programı fotoğrafı — next/og (Satori) şablonu, yalnız flexbox. 1080px genişlik (telefon galerisi).
// Ekrandaki tablonun kopyası değil: telefonda dar ekran ölçüsü sıkışık çıkıyordu (kullanıcı 2026-10-19).
import type { Period, Slot } from './scheduleMath'
import { classHex } from './classColor'

const C = { ink: '#1D2B5F', soft: '#5A6485', rule: '#DCE3F0', wash: '#F5F7FC' }
const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']
export const GENISLIK = 1080
const PAY = 60, BASLIK = 190, GUN_SATIRI = 76, SATIR = 116, ALT = 96
// Satori'de flex:1 kısaltması sütunlara genişlik vermiyor (2026-10-19 çizimde görüldü) → sabit genişlik
const SAAT_SUTUNU = 176
const GUN_SUTUNU = Math.floor((GENISLIK - 2 * PAY - SAAT_SUTUNU) / 5)
/** Sınıf adı punto: "11-B" 40px; uzun adlar hücreye (~130px) sığacak kadar küçülür. */
export const sinifPuntosu = (ad: string) => Math.min(40, Math.floor(130 / (0.62 * Math.max(1, ad.length))))

/** Son dolu ders saatinden sonraki boş saatler resme girmez (9 saatlik çizelgede 6 saat ders veren öğretmen). */
export function gorunenSaatler(periods: Period[], slots: Slot[]): Period[] {
  const son = Math.max(0, ...slots.map(s => s.period))
  return periods.filter(p => p.no <= son)
}

export const programGorselYuksekligi = (saatSayisi: number) => PAY + BASLIK + GUN_SATIRI + saatSayisi * SATIR + ALT

export function ProgramGorseli({ ad, brans, okul, periods, slots, sinifAdi }: {
  ad: string
  brans: string
  okul: string
  periods: Period[]
  slots: Slot[]
  sinifAdi: Map<string, string>
}) {
  const hucre = (gun: number, saat: number) => slots.find(s => s.day === gun && s.period === saat)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: `${PAY}px ${PAY}px 0`, background: '#fff', color: C.ink, fontFamily: 'Bricolage' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: BASLIK - 40, paddingBottom: 28, marginBottom: 40, borderBottom: `6px solid ${C.ink}` }}>
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>Ders Programı</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: 440 }}>
          <div style={{ display: 'flex', fontSize: 38, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 440 }}>{ad}</div>
          {brans && <div style={{ display: 'flex', fontSize: 28, color: C.soft }}>{brans}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', height: GUN_SATIRI, alignItems: 'center' }}>
        <div style={{ display: 'flex', width: SAAT_SUTUNU }} />
        {GUNLER.map(g => (
          <div key={g} style={{ display: 'flex', width: GUN_SUTUNU, justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>{g}</div>
        ))}
      </div>

      {periods.map((p, i) => (
        <div key={p.no} style={{ display: 'flex', height: SATIR, alignItems: 'stretch', background: i % 2 ? '#fff' : C.wash, borderRadius: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: SAAT_SUTUNU, paddingLeft: 22 }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{p.no}.</div>
            <div style={{ display: 'flex', fontSize: 23, color: C.soft, marginTop: 6 }}>{p.start}–{p.end}</div>
          </div>
          {GUNLER.map((g, gi) => {
            const s = hucre(gi + 1, p.no)
            const sinif = s ? sinifAdi.get(s.class_id) ?? '' : ''
            const renk = classHex(sinif || (s?.class_id ?? ''))
            return (
              <div key={g} style={{ display: 'flex', width: GUN_SUTUNU, padding: 9 }}>
                {s && (
                  <div style={{ display: 'flex', flexDirection: 'column', width: GUN_SUTUNU - 18, alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: renk.zemin, color: renk.yazi, border: `2px solid ${renk.yazi}33` }}>
                    <div style={{ display: 'flex', fontSize: sinifPuntosu(sinif), fontWeight: 800, lineHeight: 1 }}>{sinif || '—'}</div>
                    {s.subject && (
                      <div style={{ display: 'flex', fontSize: 19, marginTop: 6, maxWidth: GUN_SUTUNU - 34, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.subject}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      <div style={{ display: 'flex', height: ALT, alignItems: 'center', fontSize: 25, color: C.soft }}>{okul}</div>
    </div>
  )
}

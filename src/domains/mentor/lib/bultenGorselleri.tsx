// src/domains/mentor/lib/bultenGorselleri.tsx
// next/og (Satori) şablonları — yalnız flexbox. Ölçüler 1080px genişlik için.
import { addDaysISO } from '@/src/shared/date'
import { haftaEtiketi, gunAy, dersKisa, dersRengi, kisalt } from './bultenMath'
import type { Bulten, BultenSinifi, BultenOgrencisi } from '../services/BultenService'

const C = { ink: '#1D2B5F', soft: '#5A6485', rule: '#DCE3F0', sun: '#FFD23F', wash: '#F5F7FC', ok: '#2E9E6B', eks: '#F2B233', yok: '#D9534F' }
// Yükseklikler 2026-10-09 gerçek çizimden ölçüldü (px, 1080 genişlik). Satori içerik yüksekliğini bilmez; önceden hesaplanır.
const BASLIK = 230, ALT = 105, PAY = 30, BOLUM = 90, EKSIK = 105, TEBRIK = 90, OZET = 116, LEJANT = 60, NOT = 108
/** Bir gün satırı: dolgu 48 + en az etiket yüksekliği (72) ya da ödev satırları (öğretmen adıyla 83, adsız 56). */
const gunSatiri = (n: number, ogretmenli: boolean) => 48 + Math.max(72, n * (ogretmenli ? 83 : 56))

/** gunler: gün başına ödev sayısı (görselde gösterilen günler sırasıyla). */
export function gorselYuksekligi(tur: 'odevler' | 'ozet' | 'ogrenci', s: { gunler?: number[]; eksik?: number; ozet?: number }): number {
  const gunler = s.gunler ?? []
  if (tur === 'odevler') return BASLIK + gunler.reduce((a, n) => a + gunSatiri(n, true), 0) + ALT + PAY
  if (tur === 'ozet') return BASLIK + Math.max(100, (s.ozet ?? 0) * OZET) + LEJANT + NOT + ALT + PAY
  const eksik = s.eksik ?? 0
  return BASLIK + BOLUM * 2 + (eksik ? eksik * EKSIK : TEBRIK) + gunler.reduce((a, n) => a + gunSatiri(n, false), 0) + ALT + PAY
}

/** Büyük sınıf adı punto: "9-A" 156px; uzun adlar (~440px başlık bloğuna) sığacak kadar küçülür. */
export const sinifPuntosu = (ad: string) => Math.min(156, Math.floor(440 / (0.62 * Math.max(1, ad.length))))

const Baslik = ({ sinif, ust, alt }: { sinif: string; ust: string; alt: string[] }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 32, borderBottom: `6px solid ${C.ink}` }}>
    <div style={{ display: 'flex', fontSize: sinifPuntosu(sinif), fontWeight: 800, lineHeight: 0.82, letterSpacing: -sinifPuntosu(sinif) / 40, padding: '0 8px',
      backgroundImage: `linear-gradient(transparent 58%, ${C.sun} 58%)` }}>{sinif}</div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ fontSize: 44, fontWeight: 800 }}>{ust}</div>
      {alt.map(a => <div key={a} style={{ fontSize: 30, color: C.soft }}>{a}</div>)}
    </div>
  </div>
)
const Alt = ({ okul }: { okul: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, fontSize: 25, color: C.soft }}>
    <span>{okul}</span><span>EduDesk</span>
  </div>
)
const Kart = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '60px 60px 44px', background: '#fff', color: C.ink, fontFamily: 'Bricolage' }}>{children}</div>
)
const DersSatiri = ({ subject, title, alt }: { subject: string; title: string; alt?: string }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '6px 0' }}>
    <div style={{ width: 20, height: 20, borderRadius: 10, background: dersRengi(subject), marginTop: 12, marginRight: 20 }} />
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', fontSize: 34 }}>
        <span style={{ fontWeight: 800, color: dersRengi(subject), marginRight: 10 }}>{dersKisa(subject)}</span>
        <span>{kisalt(title, 44)}</span>
      </div>
      {alt ? <div style={{ fontSize: 25, color: C.soft }}>{alt}</div> : null}
    </div>
  </div>
)
const Gunler = ({ sinif, ogretmenli }: { sinif: BultenSinifi; ogretmenli: boolean }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    {sinif.gunler.map(g => (
      <div key={g.gun + g.etiket} style={{ display: 'flex', borderBottom: `2px solid ${C.rule}`, padding: '24px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 208 }}>
          <span style={{ fontSize: 32, fontWeight: 800 }}>{g.etiket}</span>
          {g.etiket !== 'Hafta sonu' ? <span style={{ fontSize: 26, color: C.soft }}>{gunAy(g.gun)}</span> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {g.odevler.length
            ? g.odevler.map(o => <DersSatiri key={o.id} subject={o.subject} title={o.title} alt={ogretmenli ? o.ogretmen : undefined} />)
            : <span style={{ fontSize: 28, color: '#A2A9BF', paddingTop: 4 }}>Kontrol edilecek ödev yok</span>}
        </div>
      </div>
    ))}
  </div>
)

export const OdevlerGorseli = ({ sinif, bulten }: { sinif: BultenSinifi; bulten: Bulten }) => (
  <Kart>
    <Baslik sinif={sinif.class_name} ust="Haftanın ödevleri" alt={[`${haftaEtiketi(bulten.hafta)} · kontrol günlerine göre`]} />
    <Gunler sinif={sinif} ogretmenli />
    <Alt okul={bulten.okulAdi} />
  </Kart>
)

export const OzetGorseli = ({ sinif, bulten }: { sinif: BultenSinifi; bulten: Bulten }) => (
  <Kart>
    <Baslik sinif={sinif.class_name} ust="Geçen haftanın ödevleri" alt={[haftaEtiketi(addDaysISO(bulten.hafta, -7)), bulten.mentorUnvani]} />
    {sinif.ozet.length === 0
      ? <div style={{ fontSize: 30, color: C.soft, padding: '32px 0' }}>Geçen hafta kontrol edilen ödev yok</div>
      : sinif.ozet.map(o => (
        <div key={o.id} style={{ display: 'flex', flexDirection: 'column', padding: '22px 0', borderBottom: `2px solid ${C.rule}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', fontSize: 32 }}>
              <span style={{ fontWeight: 800, color: dersRengi(o.subject), marginRight: 10 }}>{dersKisa(o.subject)}</span>
              <span>{kisalt(o.title, 34)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: 32, fontWeight: 800 }}>{`${o.yapildi}/${o.toplam}`}</span>
              <span style={{ fontSize: 25, color: C.soft, marginLeft: 8 }}>tamamladı</span>
            </div>
          </div>
          <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', background: C.rule, marginTop: 14 }}>
            <div style={{ width: `${(100 * o.yapildi) / o.toplam}%`, background: C.ok }} />
            <div style={{ width: `${(100 * o.eksik) / o.toplam}%`, background: C.eks }} />
            <div style={{ width: `${(100 * o.yapilmadi) / o.toplam}%`, background: C.yok }} />
          </div>
        </div>
      ))}
    <div style={{ display: 'flex', gap: 32, fontSize: 25, color: C.soft, marginTop: 28 }}>
      {([['Yapıldı', C.ok], ['Eksik', C.eks], ['Yapılmadı', C.yok]] as const).map(([t, r]) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: r, marginRight: 10 }} /><span>{t}</span>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', marginTop: 28, background: C.wash, borderLeft: `8px solid ${C.sun}`, padding: '22px 26px', fontSize: 29 }}>
      Öğrencinizin eksik ödevleri size ayrıca, kişisel mesajla iletilecektir.
    </div>
    <Alt okul={bulten.okulAdi} />
  </Kart>
)

export const OgrenciGorseli = ({ ogrenci, sinif, bulten }: { ogrenci: BultenOgrencisi; sinif: BultenSinifi; bulten: Bulten }) => {
  const bolum = (t: string, a: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '36px 0 8px' }}>
      <span style={{ fontSize: 34, fontWeight: 800 }}>{t}</span><span style={{ fontSize: 26, color: C.soft }}>{a}</span>
    </div>
  )
  return (
    <Kart>
      <Baslik sinif={ogrenci.class_name} ust={ogrenci.full_name} alt={['Haftalık ödev bilgilendirmesi']} />
      {bolum('Geçen hafta tamamlanmayanlar', haftaEtiketi(addDaysISO(bulten.hafta, -7)))}
      {ogrenci.eksikler.length === 0
        ? <div style={{ display: 'flex', background: C.wash, borderLeft: `8px solid ${C.ok}`, padding: '22px 26px', fontSize: 29 }}>Kontrol edilen ödevlerin tamamını yaptı. Tebrikler!</div>
        : ogrenci.eksikler.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: `2px solid ${C.rule}` }}>
            <DersSatiri subject={e.subject} title={e.title} alt={`${gunAy(e.due_date)} kontrolü`} />
            <span style={{ fontSize: 25, fontWeight: 600, padding: '4px 18px', borderRadius: 20, marginTop: 8,
              background: e.durum === 'eksik' ? '#FFF1CC' : '#FBE1E0', color: e.durum === 'eksik' ? '#8A5A00' : '#A12A26' }}>{e.durum}</span>
          </div>
        ))}
      {bolum('Bu hafta kontrol edilecek ödevler', haftaEtiketi(bulten.hafta))}
      <Gunler sinif={{ ...sinif, gunler: sinif.gunler.filter(g => g.odevler.length) }} ogretmenli={false} />
      <Alt okul={bulten.okulAdi} />
    </Kart>
  )
}

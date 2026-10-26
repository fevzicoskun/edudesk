// src/domains/mentor/lib/bultenGorselleri.tsx
// next/og (Satori) şablonları — yalnız flexbox. Ölçüler 1080px genişlik için.
import { addDaysISO } from '@/src/shared/date'
import { haftaEtiketi, gunAy, dersKisa, dersRengi } from './bultenMath'
import type { Bulten, BultenSinifi, BultenOgrencisi } from '../services/BultenService'
import { sayiEk } from '@/app/(dashboard)/mentorluk/[studentId]/takip/SonucKagidi'

// Yükseklik içerikten: route height vermez, Satori ölçer. Ödev başlığı kesilmez, alt satıra kayar
// (veliye giden sayfa bilgisi çoğu zaman başlığın sonunda). Tek satır yalnız ad/ünvan gibi kısa alanlarda.
// Satori (Yoga) flexShrink varsayılanı 0'dır — daralabilmesi için açıkça 1 verilir.
const TEK_SATIR = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0 } as const
// Kayan metin genişliği kalan alandan (basis 0 + grow). basis auto'da Satori metni tek satırlık doğal genişlikte ölçüp
// sonra daraltır: yükseklik bir genişliğe, çizim başkasına göre olur → yazı sağa/etiketin altına taşar, boş satır kalır.
const KAYAN = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 } as const
const C = { ink: '#1D2B5F', soft: '#5A6485', rule: '#DCE3F0', sun: '#FFD23F', wash: '#F5F7FC', ok: '#2E9E6B', eks: '#F2B233', yok: '#D9534F' }

/** Büyük sınıf adı punto: "9-A" 156px; uzun adlar (~440px başlık bloğuna) sığacak kadar küçülür. */
export const sinifPuntosu = (ad: string) => Math.min(156, Math.floor(440 / (0.62 * Math.max(1, ad.length))))

const Baslik = ({ sinif, ust, alt }: { sinif: string; ust: string; alt: string[] }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 32, borderBottom: `6px solid ${C.ink}` }}>
    <div style={{ display: 'flex', fontSize: sinifPuntosu(sinif), fontWeight: 800, lineHeight: 0.82, letterSpacing: -sinifPuntosu(sinif) / 40, padding: '0 8px',
      backgroundImage: `linear-gradient(transparent 58%, ${C.sun} 58%)` }}>{sinif}</div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ fontSize: 44, fontWeight: 800, maxWidth: 560, ...TEK_SATIR }}>{ust}</div>
      {alt.map(a => <div key={a} style={{ fontSize: 30, color: C.soft }}>{a}</div>)}
    </div>
  </div>
)
const Alt = ({ okul }: { okul: string }) => (
  <div style={{ display: 'flex', marginTop: 28, fontSize: 25, color: C.soft }}>{okul}</div>
)
const Kart = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '60px 60px 44px', background: '#fff', color: C.ink, fontFamily: 'Bricolage' }}>{children}</div>
)
const DersSatiri = ({ subject, title, alt }: { subject: string; title: string; alt?: string }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '6px 0', flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
    <div style={{ width: 20, height: 20, borderRadius: 10, background: dersRengi(subject), marginTop: 12, marginRight: 20, flexShrink: 0 }} />
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', fontSize: 34, flexShrink: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 800, color: dersRengi(subject), marginRight: 10, flexShrink: 0 }}>{dersKisa(subject)}</span>
        <span style={KAYAN}>{title}</span>
      </div>
      {alt ? <div style={{ fontSize: 25, color: C.soft, ...TEK_SATIR }}>{alt}</div> : null}
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
            <div style={{ display: 'flex', fontSize: 32, flex: 1, minWidth: 0, marginRight: 16 }}>
              <span style={{ fontWeight: 800, color: dersRengi(o.subject), marginRight: 10, flexShrink: 0 }}>{dersKisa(o.subject)}</span>
              <span style={KAYAN}>{o.title}</span>
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

/** girinti: kısa ders adı kadar bölünmez boşluk (route: fontOlcu ile ölçülür). textIndent kullanılmaz: Satori çizer ama satır kırarken saymaz → 1. satır taşar. */
export const OgrenciGorseli = ({ ogrenci, sinif, bulten, girinti }: { ogrenci: BultenOgrencisi; sinif: BultenSinifi; bulten: Bulten; girinti: (ders: string) => string }) => {
  const bolum = (t: string, a: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '36px 0 8px' }}>
      <span style={{ fontSize: 34, fontWeight: 800 }}>{t}</span><span style={{ fontSize: 26, color: C.soft }}>{a}</span>
    </div>
  )
  const g = ogrenci.gecenHafta, eksikVar = ogrenci.eksikler.length > 0
  const tamamlanmadi = g.eksik + g.yapilmadi
  return (
    <Kart>
      <Baslik sinif={ogrenci.class_name} ust={ogrenci.full_name} alt={['Haftalık ödev bilgilendirmesi']} />
      {/* Özet: tamamlanan / kontrol edilen; noktalar yeşil → sarı → kırmızı */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 32, background: '#F1F3F8', borderRadius: 20, padding: '26px 32px' }}>
        {g.toplam > 0 ? <span style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, marginRight: 32, flexShrink: 0 }}>{`${g.yapildi}/${g.toplam}`}</span> : null}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}>
          {g.toplam === 0
            ? <span style={{ fontSize: 30, color: C.soft }}>Geçen hafta kontrol edilen ödev yok.</span>
            : tamamlanmadi === 0
              ? <span style={{ fontSize: 30, fontWeight: 800, color: C.ok }}>Geçen haftanın tüm ödevleri tamamlandı.</span>
              // Satori iç içe span'ı satır içi akıtmaz (üst üste biner): parçalar ayrı kutu, kırılma parça arasında
              : <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: 30, columnGap: 9 }}>
                  <span>{`Geçen hafta ${g.toplam} ödevden`}</span>
                  <div style={{ display: 'flex' }}><span style={{ fontWeight: 800, color: C.ok }}>{`${sayiEk(g.yapildi, 'si')} tamamlandı`}</span><span>,</span></div>
                  <div style={{ display: 'flex' }}><span style={{ fontWeight: 800, color: C.yok }}>{`${sayiEk(tamamlanmadi, 'si')} tamamlanmadı`}</span><span>.</span></div>
                </div>}
          {g.toplam > 0
            ? <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 14 }}>
                {[...Array(g.yapildi).fill(C.ok), ...Array(g.eksik).fill(C.eks), ...Array(g.yapilmadi).fill(C.yok)].map((r, i) => (
                  <div key={i} style={{ width: 20, height: 20, borderRadius: 10, background: r, margin: '0 8px 8px 0' }} />
                ))}
              </div>
            : null}
        </div>
      </div>
      {eksikVar ? bolum('Geçen hafta tamamlanmayanlar', haftaEtiketi(addDaysISO(bulten.hafta, -7))) : null}
      {ogrenci.eksikler.map(e => (
        // Ders adı + ödev tek akan metin görünümü: ders adı sol üstte, ödev metninin 1. satırı ders adı kadar girintili
        // (Satori iç içe span'ı akıtmaz) → 2. satır ders adının altından başlar; en çok 2 satır. Yalnız "eksik" etiketlenir.
        <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 0', borderBottom: `2px solid ${C.rule}` }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: dersRengi(e.subject), marginTop: 13, marginRight: 20, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', position: 'relative', fontSize: 34, lineHeight: 1.25 }}>
              <span style={{ display: 'block', lineClamp: 2, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}>{girinti(dersKisa(e.subject)) + e.title}</span>
              <span style={{ position: 'absolute', left: 0, top: 0, fontWeight: 800, color: dersRengi(e.subject) }}>{dersKisa(e.subject)}</span>
            </div>
            <span style={{ fontSize: 25, color: C.soft }}>{`${gunAy(e.due_date)} kontrolü`}</span>
          </div>
          {e.durum === 'eksik'
            ? <span style={{ fontSize: 25, fontWeight: 600, padding: '4px 18px', borderRadius: 20, marginTop: 8, marginLeft: 16, flexShrink: 0, background: '#FFF1CC', color: '#8A5A00' }}>eksik</span>
            : null}
        </div>
      ))}
      {bolum('Bu hafta kontrol edilecek ödevler', haftaEtiketi(bulten.hafta))}
      <Gunler sinif={{ ...sinif, gunler: sinif.gunler.filter(g => g.odevler.length) }} ogretmenli={false} />
      {eksikVar
        ? <div style={{ display: 'flex', marginTop: 32, background: '#FFF8DC', borderLeft: `8px solid ${C.sun}`, padding: '22px 26px', fontSize: 29 }}>
            Eksik ödevlerin tamamlanması için desteğinizi rica ederiz.
          </div>
        : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 28, fontSize: 25, color: C.soft }}>
        <div style={{ display: 'flex', columnGap: 9 }}>
          <span style={{ fontWeight: 800, color: C.ink }}>{bulten.mentorAdi}</span>
          <span>{`· ${ogrenci.class_name} Mentör Öğretmeni`}</span>
        </div>
        <span>{bulten.okulAdi}</span>
      </div>
    </Kart>
  )
}

// src/domains/mentor/deneme/VeliToplantisiService.ts
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { addDaysISO, todayLocalISO } from '@/src/shared/date'
import { donemBasi } from '@/src/shared/utils'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { TakipRepository } from '../repositories/TakipRepository'
import { DenemeRepository as R } from '../repositories/DenemeRepository'
import { normalizeIcerik, type Icerik, type Seviye } from '../takip/takipMath'
import { denemeGidisi, haftaSatiri, type DenemeSatiri, type HaftaSatiri } from '../lib/veliToplantisi'
import type { DenemeTuru, DersSonucu } from './stoys'

export type VeliToplantisiVerisi = {
  okulAdi: string; mentorAdi: string; tarih: string
  ogrenci: { id: string; ad: string; sinif: string }
  denemeler: Record<DenemeTuru, DenemeSatiri[]>
  odevler: HomeworkRecord[]
  haftalar: HaftaSatiri[]
}

export const VeliToplantisiService = {
  /** Kâğıt verisi: kapı açık + çağıran öğrencinin güncel mentörü değilse null (sayfa notFound). Aralık dönem başı → bugün
   *  (haftalık plan: dönem başı → son BİTMİŞ hafta). */
  async veri(studentId: string): Promise<VeliToplantisiVerisi | null> {
    const ab = await requireAbility()
    if (!(await TakipRepository.acikMi()) || !(await TakipRepository.mentoruMu(ab.userId, ab.schoolId, studentId))) return null
    const o = await TakipRepository.ogrenci(ab.schoolId, studentId)
    if (!o) return null
    const bas = donemBasi(), bugun = todayLocalISO()
    const [sinavlar, sonuclar, profil, profile, haftalar] = await Promise.all([
      R.sinifSinavlari(o.class_id, bas),
      R.ogrenciSonuclari([studentId]),
      HomeworkService.getStudentHomeworkProfile(studentId, o.class_id, { tumOdevler: true, bas }),
      getCurrentProfile(),
      // Yalnız bitmiş haftalar: devam eden hafta yarım sonuçla veliye "Birlikte takip edelim" diyordu (2026-10-24)
      R.donemHaftalari(ab.schoolId, studentId, bas, addDaysISO(bugun, -7)),
    ])
    if ('error' in profil) throw new Error(profil.error)
    return {
      okulAdi: profile?.schools?.name ?? '', mentorAdi: profile?.full_name ?? '', tarih: bugun,
      ogrenci: { id: o.id, ad: o.full_name, sinif: (o.classes as { name: string } | null)?.name ?? '—' },
      denemeler: denemeGidisi(
        sinavlar.map(s => ({ id: s.deneme_sinavlari.id, tur: s.deneme_sinavlari.tur as DenemeTuru, tarih: s.deneme_sinavlari.tarih, siniflar: [s.class_id] })),
        sonuclar.map(s => ({ sinavId: s.sinav_id, dersler: s.dersler as unknown as DersSonucu[], toplamNet: s.toplam_net })),
        o.class_id,
      ),
      odevler: profil.homeworks,
      haftalar: haftalar.map(h => haftaSatiri(h.hafta_basi, normalizeIcerik(h.icerik as unknown as Icerik, h.seviye as Seviye), h.soru_hedefi)),
    }
  },
}

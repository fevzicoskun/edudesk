// src/domains/mentor/services/BultenService.ts
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { MentorService } from './MentorService'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { BultenRepository } from '../repositories/BultenRepository'
import {
  pazartesiMi, ogrenciEksikleri, haftaOdevleri, grupOzeti, veliMesaji, dersKisa,
  type Eksik, type GunOdevleri, type OzetSatiri,
} from '../lib/bultenMath'

export type BultenSinifi = {
  class_id: string; class_name: string
  gunler: (Omit<GunOdevleri, 'odevler'> & { odevler: (GunOdevleri['odevler'][number] & { ogretmen: string })[] })[]
  ozet: OzetSatiri[]
}
export type BultenOgrencisi = { student_id: string; full_name: string; class_id: string; class_name: string; eksikler: Eksik[]; telefon: string | null; mesaj: string }
export type Bulten = { hafta: string; okulAdi: string; mentorAdi: string; mentorUnvani: string; siniflar: BultenSinifi[]; ogrenciler: BultenOgrencisi[] }

export const BultenService = {
  /** Çağıranın mentörlük öğrencileri için haftalık bülten. Yetki yapısal: veri yalnız getMyMentorships'ten. */
  async getBulten(hafta: string): Promise<Bulten> {
    if (!pazartesiMi(hafta)) throw new Error('Geçersiz hafta')
    const ability = await requireAbility()
    const profil = await getCurrentProfile()
    const mentorAdi = profil?.full_name ?? ''
    const mentorUnvani = profil?.subject ? `${dersKisa(profil.subject)} Öğretmeni ${mentorAdi}` : mentorAdi
    const mentorluk = await MentorService.getMyMentorships()
    const bos: Bulten = { hafta, okulAdi: '', mentorAdi, mentorUnvani, siniflar: [], ogrenciler: [] }
    if (mentorluk.length === 0) return bos

    const ids = mentorluk.map(m => m.student_id)
    // bas YOK: o parametre assigned_date'e göre süzer; geçen hafta kontrol edilen eski ödevler kaçardı
    const profiller = await HomeworkService.getMentorHomeworkProfiles(ids)
    if ('error' in profiller) throw new Error(profiller.error)
    const ek = await BultenRepository.ekBilgi(ability.schoolId, ids)

    const sinifIdleri = [...new Set(profiller.ogrenciler.map(o => o.class_id))]
    const siniflar: BultenSinifi[] = sinifIdleri.map(cid => {
      const ogr = profiller.ogrenciler.filter(o => o.class_id === cid)
      return {
        class_id: cid,
        class_name: ogr[0].class_name ?? '—',
        gunler: haftaOdevleri(ogr[0].homeworks, hafta).map(g => ({
          ...g, odevler: g.odevler.map(o => ({ ...o, ogretmen: ek.ogretmenAdlari.get(o.teacher_id) ?? '' })),
        })),
        ozet: grupOzeti(ogr.map(o => o.homeworks), hafta),
      }
    }).sort((a, b) => a.class_name.localeCompare(b.class_name, 'tr', { numeric: true }))

    const ogrenciler = profiller.ogrenciler.map(o => {
      const eksikler = ogrenciEksikleri(o.homeworks, hafta)
      const sinifAdi = o.class_name ?? '—'
      return {
        student_id: o.id, full_name: o.full_name, class_id: o.class_id, class_name: sinifAdi, eksikler,
        telefon: ek.telefonlar.get(o.id) ?? null,
        mesaj: veliMesaji({ ogrenciAdi: o.full_name, sinif: sinifAdi, pazartesi: hafta, eksikler,
          gunler: haftaOdevleri(o.homeworks, hafta), mentorAdi }),
      }
    })
    return { ...bos, okulAdi: ek.okulAdi, siniflar, ogrenciler }
  },
}

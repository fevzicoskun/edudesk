import { describe, it, expect } from 'vitest'
import { ogretmenTakibi, bultenIlerlemesi, mentorsuzSiniflar } from '@/src/domains/dashboard/lib/yoneticiOzeti'

const BUGUN = '2026-10-10'

describe('ogretmenTakibi', () => {
  const ogretmenler = [
    { id: 'a', full_name: 'Ayşe', subject: 'Matematik' },
    { id: 'b', full_name: 'Bora', subject: 'Fizik' },
    { id: 'c', full_name: 'Cem', subject: null },
    { id: 'd', full_name: 'Deniz', subject: 'Kimya' },
  ]
  const odevSatirlari = [
    { ad: 'Ayşe', odev: 10, kontrolEdildi: 10, kontrolOrani: 100, enEskiBekleyen: null },
    { ad: 'Bora', odev: 4, kontrolEdildi: 2, kontrolOrani: 50, enEskiBekleyen: 6 },
    { ad: 'Deniz', odev: 3, kontrolEdildi: 3, kontrolOrani: 100, enEskiBekleyen: null },
  ]
  const kullanim = new Map([
    ['a', { sonGun: '2026-10-09' }],
    ['b', { sonGun: '2026-10-08' }],
    ['c', { sonGun: '2026-10-10' }],
    ['d', { sonGun: '2026-09-01' }],
  ])

  it('ödev verileri adla eşlenir, hiç ödevi olmayan 0 gelir', () => {
    const r = ogretmenTakibi({ ogretmenler, odevSatirlari, kullanim, bugun: BUGUN })
    const cem = r.find(x => x.id === 'c')!
    expect(cem).toMatchObject({ odev: 0, kontrolOrani: null, enEskiBekleyen: null, aktif: true, brans: null })
    expect(r.find(x => x.id === 'b')).toMatchObject({ odev: 4, kontrolOrani: 50, enEskiBekleyen: 6, sonGun: '2026-10-08' })
  })

  it('sorunlular üstte: bekleyen kontrol → pasif → ödevsiz → sorunsuz', () => {
    const r = ogretmenTakibi({ ogretmenler, odevSatirlari, kullanim, bugun: BUGUN })
    expect(r.map(x => x.ad)).toEqual(['Bora', 'Deniz', 'Cem', 'Ayşe'])
    expect(r.find(x => x.id === 'd')!.aktif).toBe(false)
  })
})

describe('bultenIlerlemesi', () => {
  it('mentör başına gönderilen/öğrenci; en geride olan önce', () => {
    const r = bultenIlerlemesi({
      mentorluklar: [
        { student_id: 's1', mentor_id: 'f' }, { student_id: 's2', mentor_id: 'f' },
        { student_id: 's3', mentor_id: 'y' }, { student_id: 's4', mentor_id: 'y' }, { student_id: 's5', mentor_id: 'y' },
      ],
      gonderilenler: ['s1', 's2', 's3', 'baskasi'],
      mentorAdlari: new Map([['f', 'Fevzi'], ['y', 'Yasemin']]),
    })
    expect(r).toEqual([
      { mentorId: 'y', ad: 'Yasemin', gonderilen: 1, toplam: 3 },
      { mentorId: 'f', ad: 'Fevzi', gonderilen: 2, toplam: 2 },
    ])
  })
})

describe('mentorsuzSiniflar', () => {
  it('yalnız mentörsüz öğrencisi olan sınıflar, sınıf adına göre', () => {
    const r = mentorsuzSiniflar({
      ogrenciler: [
        { id: '1', class_id: 'k10' }, { id: '2', class_id: 'k10' },
        { id: '3', class_id: 'k9' }, { id: '4', class_id: 'k9' },
        { id: '5', class_id: 'k11' },
      ],
      mentorlu: new Set(['1', '5']),
      siniflar: new Map([['k9', '9-A'], ['k10', '10-A'], ['k11', '11-A']]),
    })
    expect(r).toEqual([
      { id: 'k9', ad: '9-A', mentorsuz: 2, toplam: 2 },
      { id: 'k10', ad: '10-A', mentorsuz: 1, toplam: 2 },
    ])
  })
})

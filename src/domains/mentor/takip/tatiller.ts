/** Resmî tatil ve arifeler (yarım gün) — plan kâğıdında gün rozeti, rutin tablosunda okul tekrarı düşer (2026-10-24). */
export type Tatil = { tur: 'tatil' | 'yarim'; ad: string }

// Sabit tarihli (her yıl): AA-GG
const SABIT: Record<string, Tatil> = {
  '01-01': { tur: 'tatil', ad: 'Yılbaşı' },
  '04-23': { tur: 'tatil', ad: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  '05-01': { tur: 'tatil', ad: 'Emek ve Dayanışma Günü' },
  '05-19': { tur: 'tatil', ad: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
  '07-15': { tur: 'tatil', ad: 'Demokrasi ve Millî Birlik Günü' },
  '08-30': { tur: 'tatil', ad: 'Zafer Bayramı' },
  '10-28': { tur: 'yarim', ad: 'Cumhuriyet Bayramı arifesi' },
  '10-29': { tur: 'tatil', ad: 'Cumhuriyet Bayramı' },
}

const bayram = (ad: string, arife: string, ...gunler: string[]): [string, Tatil][] =>
  [[arife, { tur: 'yarim', ad: `${ad} arifesi` }], ...gunler.map((g): [string, Tatil] => [g, { tur: 'tatil', ad }])]

// Elle liste: dini bayramlar her yıl kayar → Diyanet takviminden yıl başında ekle (ponytail: kod içi liste, ekran yok)
const ELLE: Record<string, Tatil> = Object.fromEntries([
  ...bayram('Ramazan Bayramı', '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22'),
  ...bayram('Kurban Bayramı', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30'),
  ...bayram('Ramazan Bayramı', '2027-03-08', '2027-03-09', '2027-03-10', '2027-03-11'),
  ...bayram('Kurban Bayramı', '2027-05-15', '2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19'),
])

export const tatilBul = (iso: string): Tatil | null => ELLE[iso] ?? SABIT[iso.slice(5)] ?? null

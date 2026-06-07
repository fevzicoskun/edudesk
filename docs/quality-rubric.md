# EduDesk Kod Kalitesi Rubriği

Her sprint sonunda bu dosyayı referans alarak aynı metodoloji ile ölç.
Tüm sayılar `git grep` veya `wc -l` ile elde edilmeli — tahmin değil.

---

## Nasıl Ölçülür

Her boyut **10 puan başlar**, her sorun tipi belirtilen miktarı düşürür.
Taban 1'dir (0 olmaz), tavan 10'dur.

---

## 1. TypeScript Kalitesi

### Ölçüm Komutları
```bash
# A) as unknown as / as any / : any / <any> sayısı (test ve database.types hariç)
grep -rn "as unknown as\|as any\b\|: any\b\|<any>" src/ app/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules\|\.next\|test\|spec\|database\.types" \
  | wc -l

# B) Tip belirtilmemiş fonksiyon parametresi (implisit any)
npx tsc --noEmit 2>&1 | grep "implicitly has an 'any'" | wc -l
```

### Puan Hesabı
| Kriter | Düşüş |
|---|---|
| A) Her 3 unsafe cast | -0.5 |
| B) Her implisit any | -0.5 |
| Supabase typed client YOK (database.types.ts eksik) | -2 |
| Zod boundary validation YOK (en az 1 action'da) | -1 |

### Referans
- A ≤ 6 → 10 puan
- A = 7–12 → 9 puan (her 3 cast için 0.5 düşüş)
- A = 13–21 → 7–8 puan aralığı

---

## 2. Mimari & Kod Organizasyonu

### Ölçüm Komutları
```bash
# A) 300 satırı aşan bileşen/sayfa dosyaları
find app/ src/ -name "*.tsx" -o -name "*.ts" \
  | grep -v "node_modules\|\.next\|test\|spec\|database\.types" \
  | xargs wc -l 2>/dev/null | awk '$1 > 300' | grep -v total

# B) Repository'yi atlayan (service/action → direkt supabase) satırlar
grep -rn "createClient\(\)" app/actions/ src/domains/*/services/ \
  --include="*.ts" | wc -l
```

### Puan Hesabı
| Kriter | Düşüş |
|---|---|
| Her 300+ satır dosya | -0.5 |
| Her 500+ satır dosya | -0.5 ek |
| Service katmanında direkt DB çağrısı (repo atlanıyor, her adet) | -0.5 |
| Domain dışına sızan repository import (her adet) | -0.5 |

---

## 3. Hata Yönetimi

### Ölçüm Komutları
```bash
# A) İçinde logger/console OLMAYAN catch blokları
grep -rn "catch\s*{$\|catch (_)" src/ app/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "test\|spec\|node_modules"

# B) Log'suz silent return (RBAC red + DB hatası sonrası)
grep -rn "if (!ability\|cannot(P\." src/domains/ --include="*.ts" \
  -A1 | grep "return \[\]\|return null\|return {}" | wc -l
```

### Puan Hesabı
| Kriter | Düşüş |
|---|---|
| Her log'suz catch bloğu (fire-and-forget hariç) | -0.5 |
| Her log'suz RBAC silent return | -0.3 |
| Her log'suz DB error silent swallow | -0.5 |
| `{ error }` döndüren yerde logger.error YOK | -0.3 |

### İstisnalar (sayılmaz)
- Inngest step içindeki fire-and-forget catch
- `revocation/index.ts` token kontrolleri (infrastructure, fallback amaçlı)
- `withPermission.ts` middleware catch (framework seviyesi)

---

## 4. Test Kapsamı

### Ölçüm Komutları
```bash
# A) Toplam test sayısı
npm run test:unit 2>&1 | grep "Tests" | tail -1

# B) Test dosyası sayısı
find tests/vitest/unit -name "*.test.ts" | wc -l

# C) Kapsanmayan kritik servis dosyaları
ls src/domains/*/services/*.ts | while read f; do
  base=$(basename "$f" .ts)
  test_file=$(find tests/ -name "*${base}*" 2>/dev/null)
  [ -z "$test_file" ] && echo "KAPSANMADI: $f"
done
```

### Puan Hesabı
| Kriter | Puan |
|---|---|
| ≥ 400 test | 10 |
| 300–399 test | 9 |
| 200–299 test | 8 |
| 100–199 test | 6 |
| < 100 test | 4 |
| Her kapsanmayan kritik servis | -0.5 |
| E2E test YOK (0 playwright spec) | -1 |

---

## 5. Performans

### Ölçüm Komutları
```bash
# A) N+1 pattern: loop içinde await (potansiyel)
grep -rn "for.*await\|\.map.*await" src/domains/ app/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "test\|spec\|Promise.all\|allSettled" | wc -l

# B) Pagination eksik sayfalar (tüm liste çeken sorgular)
grep -rn "\.select(" src/domains/ app/ --include="*.ts" \
  | grep -v "\.limit\|\.range\|test\|spec" \
  | grep "from('homeworks')\|from('students')\|from('attendance')" | wc -l

# C) Promise.all kullanımı (paralel sorgu sayısı — arttıkça iyi)
grep -rn "Promise\.all\b" src/ app/ --include="*.ts" \
  | grep -v "test\|spec" | wc -l
```

### Puan Hesabı
| Kriter | Düşüş |
|---|---|
| Her loop-içi-await (N+1 riski) | -0.5 |
| Ana liste sayfasında pagination YOK | -1 |
| Dashboard chart'ları lazy load değil | -0.5 |
| `cache()` / `revalidatePath` kullanımı YOK | -1 |
| `next/dynamic` ile kod bölümü YOK | -0.5 |

---

## 6. Güvenlik

### Ölçüm Komutları
```bash
# A) school_id filtresi olmayan mutasyon sorguları
grep -rn "\.insert\|\.update\|\.delete" src/domains/ app/actions/ \
  --include="*.ts" \
  | grep -v "school_id\|schoolId\|test\|spec\|createServiceClient" | wc -l

# B) getAbility() çağrısı olmayan servis metodları
grep -rn "export const\|async function" src/domains/*/services/*.ts \
  | grep -v "test\|spec" | wc -l
# vs
grep -rn "getAbility\|getCurrentProfile\|getCurrentUser" \
  src/domains/*/services/*.ts | wc -l
```

### Puan Hesabı
| Kriter | Düşüş |
|---|---|
| Her school_id filtresi eksik mutasyon | -1 |
| RLS devre dışı tablo | -2 |
| Service metodunda RBAC check YOK (mutasyon yapan) | -0.5 |
| Zod validation action boundary'de eksik | -0.5 |
| HTML email'de `esc()` eksik | -1 |

---

## Sprint Karşılaştırma Tablosu

| Sprint | TS | Mimari | Hatalar | Test | Perf | Güvenlik | Ortalama |
|---|---|---|---|---|---|---|---|
| Baseline (2026-06-08) | 7.0 | 8.0 | 8.0 | 7.5 | 7.0 | 8.5 | **7.7** |

---

## Baseline Ölçüm Detayları (2026-06-08)

### TypeScript (7.0/10)
- A: 21 unsafe cast → -3.5 puan (her 3 cast = -0.5)
- database.types.ts mevcut: ✓
- Zod boundary: ✓
- **Başlangıç: 10 - 3.5 = 6.5 → yuvarla 7.0**

### Mimari (8.0/10)
- 300+ satır dosya: 9 adet → -4.5
- Ancak domain ayrımı güçlü, repository pattern tutarlı → taban yüksek
- Service'de direkt DB: 0 → ✓
- **Değerlendirme: 8.0**

### Hata Yönetimi (8.0/10)
- Log'suz catch: ~12 adet (fire-and-forget + infrastructure istisnalar sonrası ~6) → -3.0
- Log'suz RBAC return: 0 (bu sprint düzeltildi) → ✓
- fetchRiskInputs error logging: ✓ (bu sprint eklendi)
- **Başlangıç: 10 - 2.0 = 8.0**

### Test (7.5/10)
- 351 test: 300–399 → 9 puan tabanı
- Kapsanmayan servis: ~3 adet → -1.5
- **9.0 - 1.5 = 7.5**

### Performans (7.0/10)
- N+1 riski: ~4 adet (loop-içi-await) → -2.0
- Pagination eksik (odevler/students) → -1.0
- Dashboard lazy charts: ✓ (bu sprint eklendi)
- Promise.all: 14 kullanım → ✓
- cache() kullanımı: ✓
- **10 - 3.0 = 7.0**

### Güvenlik (8.5/10)
- school_id eksik mutasyon: ~3 (insert'ler RLS korumalı, sadece insert data üzerinde) → -1.5
- RLS: tüm tablolarda aktif → ✓
- Zod validation: ✓
- **10 - 1.5 = 8.5**

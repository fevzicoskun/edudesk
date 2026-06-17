# Yoklama Durum Seçimini Ödev Deseniyle Hizalama

**Tarih:** 2026-06-17
**Durum:** Onaylandı, uygulamaya hazır

## Problem

Günlük en sık kullanılan iki akış — yoklama girişi ve ödev durum girişi — aynı işi yapar (öğrenciye durum ata, kaydet) ama farklı olgunlukta etkileşim modeli kullanır:

- **Ödev (`app/(dashboard)/odevler/[id]/statusboard/StudentRow.tsx`):** Her durum ayrı buton → istediğin duruma **tek tık**. Seçili olan renkli + ring, diğerleri soluk gri.
- **Yoklama (`YoklamaStudentPanel.tsx`):** Tek **döngüsel** buton (Mevcut→Devamsız→Geç→Özürlü→başa). "Özürlü" = 3 tık; yanlış geçince başa dönmek için tur atılır. Sonraki durum önizlemesi yok.

Yoklama günde defalarca kullanılan en sık akış olmasına rağmen en ilkel etkileşime sahip. İki ekranın farklı modeli kullanıcının kas hafızasını da böler.

## Hedef

Yoklamadaki durum seçimini ödev `StudentRow` desenine hizalamak: **her durumu tek tıkla seçilebilir yapmak.** Bildirim, kilit ve kaydetme mimarisine dokunmadan.

## Kapsam

### Değişen dosyalar (yalnızca 2)
- `app/(dashboard)/yoklama/YoklamaStudentPanel.tsx` — öğrenci satırı düzeni + durum butonları
- `app/(dashboard)/yoklama/YoklamaClient.tsx` — döngüsel `toggle(id)` yerine doğrudan `setStatus(id, status)`

### Dokunulmayanlar (bilinçli)
- `app/actions/yoklama.ts` — `saveYoklama`, `getYoklama` aynen kalır
- Toplu "Kaydet" butonu ve mimarisi (toplu giriş → tek kaydet oturumu)
- Veli bildirimi (kaydedince devamsız/geç → 45 dk sonra e-posta)
- Kilitleme saati mantığı (`lockStatus`, `isLocked`, `YoklamaLockBanner`)
- "Hepsini Mevcut / Devamsız / Özürlü" toplu butonları
- `page.tsx` veri çekimi, devamsızlık badge'leri, `STATUS_LABELS` / `STATUS_COLORS`

## Tasarım

### Etkileşim
**Önce:** Tek döngü butonu → Özürlü = 3 tık, yanlışta tur atma.
**Sonra:** Öğrenci başına 4 ayrı buton (Mevcut · Devamsız · Geç · Özürlü) → istediğin duruma her zaman **tek tık**. Seçili durum renkli + `ring`, diğerleri soluk gri (ödev `StudentRow` deseni).

### Satır düzeni (mobil + masaüstü aynı)
Öğrenci adı/no/devamsızlık badge satırı **üstte**, durum butonları **altında** full-width `grid-cols-4`. (Mobilde isim + 4 buton tek yatay satıra sığmadığı için dikey diziliş.)

```
┌────────────────────────────────────────┐
│ 1. Ahmet Yılmaz   #123        [12 gün]  │
│ ┌──────┬────────┬──────┬────────┐       │
│ │Mevcut│Devamsız│ Geç  │ Özürlü │       │  ← seçili olan renkli+ring
│ └──────┴────────┴──────┴────────┘       │
└────────────────────────────────────────┘
```

- Etiketler responsive: mobilde kısa (`Mevcut` / `Dev.` / `Geç` / `Özür.`), `md` ve üstünde tam (`Mevcut` / `Devamsız` / `Geç` / `Özürlü`). Tailwind `hidden md:inline` / `md:hidden` span çiftiyle.
- `min-h-[44px]` dokunma hedefi korunur.
- Renkler `STATUS_COLORS` sabitinden gelir (zaten tanımlı, yeniden kullanılır).
- Mevcut "öğrenci adı + no + devamsızlık badge + Tooltip" bloğu aynen korunur.

### Davranış
- Butona basınca: `setStatus(id, status)` → `statuses` state güncellenir, `isDirty.current = true`. Kaydetmeye kadar DB'ye gitmez (bugünkü davranışın aynısı).
- `isLocked` ise tüm durum butonları `disabled` (bugünkü gibi).
- `YoklamaClient` içindeki `toggle` fonksiyonu silinir; yerine `setStatus(studentId, status)` gelir ve `YoklamaStudentPanel`'e prop olarak geçer (`toggle` prop'unun yerine).

## Test / Doğrulama

Bu projede React component testi altyapısı yok (vitest `environment: 'node'`, RTL kurulu değil; testler saf fonksiyon/action seviyesinde). Bu değişiklik tamamen sunum/etkileşim katmanı — sildiğimiz `toggle` döngü mantığının yerine gelen `setStatus(id, status)` trivial setter, test edilecek saf mantık içermez. Bu yüzden yeni otomatik test eklenmez (uydurma test borç yaratır).

Doğrulama:
- `npm run build` — TypeScript + derleme temiz geçer (prop imza değişikliği `toggle` → `setStatus` her iki dosyada tutarlı).
- `npx vitest run tests/vitest/unit/yoklama/yoklama-action.test.ts` — mevcut yoklama action testleri hâlâ geçer (bu dosyalara dokunulmadığının kanıtı).
- Manuel: dev sunucuda bir öğrenciyi her duruma tek tıkla geçir, kilit saatinde butonların disabled olduğunu, Kaydet sonrası bildirim toast'ının değişmediğini gör.

## Risk

Düşük. Sıfır yeni soyutlama/bağımlılık; veri akışı, bildirim ve kilit mantığı bit bit aynı. Değişen tek şey kullanıcının durumu nasıl seçtiği. Ödev tarafında aynı desen zaten kanıtlanmış.

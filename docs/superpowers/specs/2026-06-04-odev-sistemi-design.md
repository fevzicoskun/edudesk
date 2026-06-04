# Ödev Sistemi — Kapsamlı İyileştirme Tasarımı

**Tarih:** 2026-06-04  
**Durum:** Onaylandı  

## Hedef

Öğretmenin "bunu kullanmak zorundayım" demesi. Üç odak:
1. Ödev vermek çok kolay (mobil dahil)
2. Kontrol çok kolay (günlük bakış, gecikmiş, tek öğrenci)
3. Aileye mesaj/mail çok rahat (WhatsApp + Resend, manuel + otomatik)

---

## Paket 1 — Hızlı Ödev Drawer

### Amaç
Herhangi bir sayfadan, sayfa değiştirmeden ödev girilebilmesi. Özellikle mobilde hızlı.

### UX Akışı
1. Sağ altta sabit **"+ Ödev"** FAB (Floating Action Button) — tüm dashboard layout'unda görünür
2. Tıklayınca sağdan slide-in drawer açılır (mobilde bottom sheet gibi %90 yükseklik)
3. Drawer içi 3 adım (tek scroll, sayfa geçişi yok):
   - **Sınıf seçimi:** Son 3 kullanılan sınıf önce (favori mantığı — localStorage). Çoklu seçim mümkün.
   - **Şablon veya boş:** Seçili sınıfa ait şablonlar küçük kart olarak listelenir. Tıklayınca başlık/ders/açıklama dolar, sadece tarih girer. Şablon yoksa direkt boş form.
   - **Tarih + gönder:** Native date picker, altında "Oluşturulunca velilere bildir" checkbox (varsayılan: açık). Kaydet → drawer kapanır, router.refresh() ile liste güncellenir.
4. Kayıt sonrası "Ödev oluşturuldu" toast

### Teknik
- Yeni bileşen: `components/homework/QuickAddDrawer.tsx` (client)
- `app/(dashboard)/layout.tsx`'e eklenir — tüm dashboard sayfalarında erişilebilir
- Mevcut `createHomework` server action kullanılır (değişiklik yok)
- Şablonlar için yeni server action: `getHomeworkTemplates(classId)` — HomeworkRepository'den şablonları çeker
- Drawer state: basit `useState` (global state gerekmez)
- Son kullanılan sınıflar: `localStorage`'da `recent_class_ids` anahtarında tutulur (max 3)

---

## Paket 2 — Günlük Cockpit

### Amaç
Anasayfada "bugün ne yapmalısın?" odaklı, actionable özet.

### UI
`/anasayfa` sayfasında, mevcut KPI kartlarının hemen altına eklenir.

**3 satır (boşsa render edilmez):**

| Öncelik | Renk | İçerik | Eylem |
|---------|------|--------|-------|
| Acil | Kırmızı | Son tarihi geçmiş + hiç giriş yapılmamış ödevler | Her biri ödev detayına link |
| Bugün | Amber | `due_date = bugün` olan aktif ödevler | Ödev detayına link |
| Eksik öğrenciler | Mavi | Tüm aktif ödevlerde yapılmadı/eksik toplam öğrenci sayısı | Analitik sayfasına link |

### Teknik
- Yeni server component: `app/(dashboard)/anasayfa/OdevCockpit.tsx`
- `revalidate = 60` — anasayfa revalidate'iyle uyumlu
- Sorgu: `homeworks` tablosundan öğretmenin ödevleri (müdür için okul geneli), `homework_submissions` join
- Yeni DB sorgusu yok, mevcut tablo yapısı yeterli
- Müdür/zümre başkanı: okul geneli görür; öğretmen: sadece kendi ödevleri

---

## Paket 3 — Veli İletişim Merkezi

### Amaç
WhatsApp + e-posta iletişimini tek panelde birleştirmek. Manuel + otomatik bildirimler.

### A) StatusBoard Entegrasyonu (Manuel Gönderim)

Mevcut `VeliWhatsApp.tsx` kaldırılır, yerine StatusBoard içine "Ailelere Ulaş" paneli entegre edilir.

**Panel içeriği:**
- Öğrenci filtresi: "Yapılmadı" / "Eksik" / "Geç" / "Tümü" butonları
- Seçim checkbox'ları (her öğrenci kartında)
- "6 veli seçildi" sayaç
- **WhatsApp butonu:** Seçili velilerin numaralarına mesaj linki (mevcut logic)
- **Mail Gönder butonu:** `sendHomeworkReminder` server action → Resend toplu mail
- Gönderim sonrası toast: "6 mail gönderildi" / hata varsa kaç tane başarısız

**Mail içeriği (Türkçe):**
```
Sayın [veli_ad],

[öğrenci_ad]'ın "[ödev_başlık]" ödevi [son_tarih] tarihine kadar teslim edilmelidir.
Mevcut durum: [durum]

[öğretmen_ad]
[okul_ad]
```

### B) Otomatik Bildirimler (Inngest)

**Trigger 1 — Ödev oluşturulunca:**
- `createHomework` action'ına hook
- Inngest event: `homework/created`
- Function: `src/domains/notifications/functions/homeworkCreatedNotifier.ts`
- İş: O sınıftaki tüm öğrencilerin velilerine (telefon numarası olan) mail gönderir
- Rate limiting: max 50 mail/job

**Trigger 2 — Son tarihten 1 gün önce:**
- Inngest scheduled function (cron: `0 8 * * *` — her sabah 08:00)
- Function: `src/domains/notifications/functions/homeworkDueReminderJob.ts`
- İş: `due_date = yarın` olan ödevlerde `yapilmadi` statüsündeki öğrencilerin velilerine mail
- Mevcut `homeworkReminder.ts` genişletilir veya yeni function

### C) Yeni Server Action

`app/actions/veli-bildirim.ts`:
- `sendHomeworkReminderEmails(homeworkId, studentIds)` — manuel gönderim
- RBAC: sadece o ödevin sahibi öğretmen veya school-scope yönetici çağırabilir
- Resend batch API kullanılır (mevcut Resend entegrasyonu var)

---

## Etkilenen Dosyalar

### Yeni dosyalar
- `components/homework/QuickAddDrawer.tsx`
- `app/(dashboard)/anasayfa/OdevCockpit.tsx`
- `app/actions/veli-bildirim.ts`
- `src/domains/notifications/functions/homeworkCreatedNotifier.ts`
- `src/domains/notifications/functions/homeworkDueReminderJob.ts`

### Değişen dosyalar
- `app/(dashboard)/layout.tsx` — QuickAddDrawer eklenir
- `app/(dashboard)/anasayfa/page.tsx` — OdevCockpit eklenir
- `app/(dashboard)/odevler/[id]/StatusBoard.tsx` — Veli paneli entegre edilir
- `app/(dashboard)/odevler/[id]/page.tsx` — VeliWhatsApp import kaldırılır
- `app/actions/homework.ts` — createHomework'e Inngest event tetikleyici eklenir
- `app/api/inngest/route.ts` — yeni fonksiyonlar register edilir
- `src/domains/homework/repositories/HomeworkRepository.ts` — getTemplatesByClassId eklenir
- `src/domains/homework/services/HomeworkService.ts` — getTemplatesByClassId servisi

### Kaldırılan dosyalar
- `app/(dashboard)/odevler/[id]/VeliWhatsApp.tsx` — StatusBoard'a taşınır

---

## Test Planı

- `QuickAddDrawer`: şablon seçimi → form dolumu, çoklu sınıf seçimi, drawer kapatma
- `OdevCockpit`: boş state (render edilmez), acil/bugün/eksik satırları
- `sendHomeworkReminderEmails`: RBAC guard, Resend mock, başarı/hata dönüşü
- `homeworkCreatedNotifier`: veli_telefon null olan öğrenciler atlanır
- `homeworkDueReminderJob`: sadece yarın biten + yapılmadı olanlar seçilir

---

## Kapsam Dışı

- SMS (Netgsm) — ileriye ertelendi
- AI destekli ödev girişi
- Öğrenci portal bildirimi
- Push notification

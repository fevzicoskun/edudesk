# Landing Page Tasarım Spec — 2026-06-13

## Amaç
`myedudesk.com.tr` için hibrit landing page: hem pazarlama içeriği hem mevcut kullanıcı girişi. Yeni okul müşterileri için WhatsApp iletişim CTA'sı; fiyat gösterilmez.

## Teknik Mimari

- `app/page.tsx` — `redirect('/login')` kaldırılır, `<LandingPage />` render edilir
- `app/_components/landing/` — tüm landing bileşenleri burada
- Dashboard middleware `/(dashboard)` grubuna scope'lu, landing'i etkilemez
- Saf server component — sıfır client JS
- WhatsApp CTA: `<a href="https://wa.me/...">` linki

## Renk Paleti
- Primer: `green-600` / `green-700`
- Aksan: `orange-500`
- Arka plan: `stone-50`
- Metin: `stone-800` / `stone-600`

## Bölümler

### 1. Navbar
- Sol: EduDesk logo (mevcut `EduDeskLogo` bileşeni)
- Sağ: "WhatsApp'tan Bilgi Al" (green outline) + "Giriş Yap →" (green solid)
- Sticky, beyaz arka plan, alt border

### 2. Hero
- Başlık: "Okulunuzun tüm takibini tek ekranda"
- Alt metin: "Yoklama, ödev, veli iletişimi ve zümre toplantıları — hepsi bir arada."
- CTA 1: "WhatsApp'tan Bilgi Al" (orange, büyük)
- CTA 2: "Giriş Yap →" (ghost)
- Arka plan: hafif yeşil gradient (`green-50` → `stone-50`)

### 3. Özellikler (6 kart, 2×3 grid)
| Başlık | Alt metin |
|--------|-----------|
| Yoklama Takibi | Günlük yoklama, devamsızlık trendi, otomatik veli bildirimi |
| Ödev Yönetimi | Teslim takibi, tamamlanma oranı, gecikme uyarısı |
| Veli Portalı | QR ile anında erişim, çocuğunun durumunu anlık gör |
| Analitik Dashboard | Risk analizi, sınıf karşılaştırması, trend grafikleri |
| Zümre Toplantıları | Toplantı notları, karar takibi, müfredat planı |
| Okul Yönetimi | Öğretmen rolleri, okul ayarları, sistem kontrolü |

### 4. Nasıl Çalışır (3 adım, yatay)
1. Okulunuzu 10 dakikada kurun
2. Öğretmenlerinizi davet edin
3. Takibe hemen başlayın

### 5. Kimler İçin (3 kart)
- **Müdür** — Okul geneli görünüm, öğretmen aktivitesi, raporlar
- **Öğretmen** — Yoklama, ödev, not defteri tek ekranda
- **Veli** — Çocuğunuzun durumunu her an, her yerden görün

### 6. Footer
- WhatsApp CTA tekrarı
- Gizlilik Politikası + Kullanım Koşulları linkleri (mevcut sayfalar)
- © 2026 EduDesk

## Kısıtlar
- Fiyat bilgisi gösterilmez
- Animasyon yok (Framer Motion eklenmez)
- Mobil öncelikli responsive tasarım
- Mevcut `EduDeskLogo` bileşeni kullanılır
- WhatsApp numarası: `.env` değişkeni veya sabit kod (NEXT_PUBLIC_WHATSAPP_NUMBER)

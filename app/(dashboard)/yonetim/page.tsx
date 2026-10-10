import { redirect } from 'next/navigation'

// Okul Durumu ana sayfaya katıldı (spec 2026-10-10 yönetici ana sayfası); eski bağlantılar kırılmasın
export default function YonetimPage() {
  redirect('/anasayfa')
}

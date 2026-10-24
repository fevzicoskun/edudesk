import { redirect } from 'next/navigation'

// Profil bilgileri Ayarlar'ın en üstüne taşındı (2026-10-24); eski bağlantılar ve e-postalardaki /profil çalışsın
export default function ProfilPage() {
  redirect('/ayarlar')
}

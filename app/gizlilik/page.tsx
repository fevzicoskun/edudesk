import Link from 'next/link'
import EduDeskLogo from '@/components/EduDeskLogo'

export const metadata = {
  title: 'Gizlilik Politikası & KVKK Aydınlatma Metni — EduDesk',
}

export default function GizlilikPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="mb-10">
          <Link href="/" className="inline-block mb-6">
            <EduDeskLogo size="md" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Gizlilik Politikası & KVKK Aydınlatma Metni
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
            Son güncelleme: Mayıs 2026
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-8 space-y-8 text-sm text-gray-700 dark:text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">1. Veri Sorumlusu</h2>
            <p>
              Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında
              <strong className="text-gray-900 dark:text-slate-100"> EduDesk</strong> (myedudesk.com.tr) tarafından
              hazırlanmıştır. Kişisel verileriniz, veri sorumlusu sıfatıyla EduDesk tarafından işlenmektedir.
            </p>
            <p className="mt-2">İletişim: <a href="mailto:info@myedudesk.com.tr" className="text-blue-600 hover:underline">info@myedudesk.com.tr</a></p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">2. İşlenen Kişisel Veriler</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-800 dark:text-slate-200">Öğretmen & Yöneticiler</p>
                <p>Ad soyad, e-posta adresi, okul bilgisi, kullanıcı rolü, giriş kayıtları.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800 dark:text-slate-200">Öğrenciler</p>
                <p>Ad soyad, öğrenci numarası, sınıf bilgisi, yoklama kayıtları, ödev durumu, not bilgileri.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800 dark:text-slate-200">Veliler</p>
                <p>Ad soyad, telefon numarası, e-posta adresi (isteğe bağlı).</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">3. İşleme Amaçları ve Hukuki Dayanakları</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Okul yönetim hizmetinin sağlanması ve yürütülmesi (sözleşmenin ifası)</li>
              <li>Yoklama, ödev ve not takibinin dijital ortamda yapılması (meşru menfaat)</li>
              <li>Velilerin çocuklarının eğitim sürecinden haberdar edilmesi (açık rıza)</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
              <li>Sistem güvenliğinin sağlanması ve hataların giderilmesi</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">4. Veri Saklama Süresi</h2>
            <p>
              Kişisel verileriniz, hizmet ilişkisi süresince ve hizmet sonrası <strong>2 yıl</strong> boyunca saklanır.
              Yasal yükümlülük gerektiren veriler ilgili mevzuatta öngörülen süreler boyunca tutulur.
              Süre sonunda veriler güvenli şekilde silinir veya anonimleştirilir.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">5. Verilerin Aktarımı</h2>
            <p>
              Kişisel verileriniz üçüncü taraflarla ticari amaçla paylaşılmaz. Veriler yalnızca aşağıdaki
              altyapı sağlayıcılarına aktarılır:
            </p>
            <ul className="list-disc list-inside space-y-1.5 mt-2">
              <li><strong>Supabase Inc.</strong> — Veritabanı ve kimlik doğrulama (AB sunucuları, GDPR uyumlu)</li>
              <li><strong>Vercel Inc.</strong> — Uygulama barındırma (GDPR uyumlu)</li>
              <li><strong>Resend Inc.</strong> — E-posta bildirimleri</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">6. KVKK Kapsamındaki Haklarınız</h2>
            <p>KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc list-inside space-y-1.5 mt-2">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse bilgi talep etme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde/dışında aktarıldığı üçüncü kişileri öğrenme</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
              <li>Silinmesini veya yok edilmesini isteme</li>
              <li>İşlemenin otomatik sistemler aracılığıyla gerçekleşmesi halinde ortaya çıkan aleyhte sonuca itiraz etme</li>
              <li>Kanuna aykırı işlenmesi nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme</li>
            </ul>
            <p className="mt-3">
              Haklarınızı kullanmak için{' '}
              <a href="mailto:info@myedudesk.com.tr" className="text-blue-600 hover:underline">
                info@myedudesk.com.tr
              </a>{' '}
              adresine e-posta gönderebilirsiniz. Talepleriniz en geç 30 gün içinde yanıtlanır.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">7. Çerezler (Cookies)</h2>
            <p>
              EduDesk yalnızca oturum yönetimi için zorunlu çerezler kullanır. Reklam veya izleme
              amaçlı çerez kullanılmamaktadır. Oturum çerezi tarayıcınızı kapattığınızda sona erer.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">8. Değişiklikler</h2>
            <p>
              Bu metin gerektiğinde güncellenebilir. Önemli değişiklikler e-posta ile bildirilir.
              Güncel metne her zaman myedudesk.com.tr/gizlilik adresinden ulaşabilirsiniz.
            </p>
          </section>

        </div>

        <div className="mt-8 text-center">
          <Link href="/kayit" className="text-sm text-blue-600 hover:underline">
            ← Başvuru formuna dön
          </Link>
        </div>

      </div>
    </div>
  )
}

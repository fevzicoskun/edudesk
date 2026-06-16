import Link from 'next/link'
import EduDeskLogo from '@/components/EduDeskLogo'

export const metadata = {
  title: 'Kullanım Koşulları — EduDesk',
}

export default function KullanimKosullariPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="mb-10">
          <Link href="/" className="inline-block mb-6">
            <EduDeskLogo size="md" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Kullanım Koşulları
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
            Son güncelleme: Haziran 2026
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-8 space-y-8 text-sm text-gray-700 dark:text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">1. Hizmet Tanımı</h2>
            <p>
              EduDesk, özel ve resmi okullara yönelik dijital okul yönetim platformudur. Yoklama,
              ödev takibi, not defteri ve veli bilgilendirme başta olmak üzere
              okul iş süreçlerini tek platformda yönetmeyi sağlar.
            </p>
            <p className="mt-2">
              Platforma erişim, EduDesk tarafından yetkilendirilen okul müdürleri ve öğretmenler
              aracılığıyla gerçekleşir.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">2. Kullanıcı Yükümlülükleri</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Hesap bilgilerinizi (şifre, davet kodu) üçüncü kişilerle paylaşmayınız.</li>
              <li>Sisteme yalnızca yetkili olduğunuz veriler girişi yapınız.</li>
              <li>Öğrenci verilerini platforma girişte veli/yasal temsilci bilgisinin alındığından emin olunuz.</li>
              <li>Platformu yalnızca eğitim amaçlı kullanınız; ticari veya yasal dışı amaçlarla kullanmayınız.</li>
              <li>Tespit ettiğiniz güvenlik açıklarını <a href="mailto:info@myedudesk.com.tr" className="text-blue-600 hover:underline">info@myedudesk.com.tr</a> adresine bildirin.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">3. Veri Güvenliği ve Sorumluluk</h2>
            <p>
              EduDesk, kişisel verilerin korunması için endüstri standardı teknik önlemler
              (şifreli bağlantı, erişim denetimi, güvenli altyapı) uygulamaktadır. Ancak
              internet üzerinden iletişimin doğasından kaynaklanan riskler tamamen
              bertaraf edilemez.
            </p>
            <p className="mt-2">
              Okul yönetimi, platforma girilen öğrenci ve veli verilerinin doğruluğundan ve
              KVKK kapsamında gerekli izinlerin alınmasından sorumludur.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">4. Hizmet Sürekliliği</h2>
            <p>
              EduDesk, hizmetin kesintisiz sağlanması için azami özeni gösterir. Bakım, güncelleme
              veya teknik nedenlerle kısa süreli erişim kesintileri yaşanabilir. Planlı bakımlar
              önceden bildirilmeye çalışılır.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">5. Fikri Mülkiyet</h2>
            <p>
              Platform tasarımı, arayüzü ve yazılım kodu EduDesk'e aittir. Kullanıcılar tarafından
              platforma yüklenen içerikler (öğrenci listeleri, ödev metinleri vb.) ilgili okulun
              mülkiyetinde kalır.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">6. Hizmetin Sonlandırılması</h2>
            <p>
              EduDesk, bu koşulların ihlali halinde veya önceden bildirim yaparak hizmeti
              sonlandırma hakkını saklı tutar. Hesap sonlandırılması halinde okul verileri
              talep üzerine dışa aktarılabilir ve ardından güvenli şekilde silinir.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">7. Uygulanacak Hukuk</h2>
            <p>
              Bu koşullar Türk hukukuna tabidir. Uyuşmazlıklarda Türkiye mahkemeleri yetkilidir.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-3">8. İletişim</h2>
            <p>
              Sorularınız için:{' '}
              <a href="mailto:info@myedudesk.com.tr" className="text-blue-600 hover:underline">
                info@myedudesk.com.tr
              </a>
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

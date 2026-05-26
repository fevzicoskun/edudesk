import RegisterForm from './RegisterForm'
import EduDeskLogo from '@/components/EduDeskLogo'
import AppMockup from './AppMockup'

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    title: 'Dijital Yoklama',
    desc: 'Yoklamayı saniyeler içinde al. Devamsız öğrencinin velisi otomatik bilgilendirilsin.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'Ödev & Not Takibi',
    desc: 'Tüm sınıfların ödevleri tek ekranda. Not defteri Excel\'e gerek kalmadan.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Zümre Yönetimi',
    desc: 'Toplantı tutanaklarını dijitalize et. Kağıt yok, arşiv her zaman hazır.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Veli Portalı',
    desc: 'Veliler özel link ile çocuklarının yoklama ve ödevlerini anlık görebilsin.',
  },
]

export default function KayitPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex">

      {/* Sol — pazarlama (masaüstünde görünür) */}
      <div className="hidden lg:flex flex-col justify-center px-12 xl:px-16 py-16 w-[52%] bg-slate-900 dark:bg-slate-950">
        <div className="max-w-md">
          <EduDeskLogo size="lg" white className="mb-8" />

          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
            Öğretmenlik zaten<br />
            yeterince zor.
          </h1>
          <p className="text-slate-400 text-base mb-10 leading-relaxed">
            EduDesk, yoklama, ödev takibi ve zümre işlerini tek yerden yönetmeni sağlar.
            Kağıt, Excel ve WhatsApp grubuna gerek kalmaz.
          </p>

          {/* Özellikler */}
          <div className="space-y-5 mb-10">
            {features.map((f) => (
              <div key={f.title} className="flex gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{f.title}</div>
                  <div className="text-sm text-slate-400 mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Uygulama önizlemesi */}
          <AppMockup />
        </div>
      </div>

      {/* Sağ — form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobilde logo görünür */}
          <div className="mb-8 text-center lg:hidden">
            <EduDeskLogo size="lg" className="justify-center mb-2" />
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Öğretmenlik iş yükünü azaltan okul yönetim sistemi
            </p>
          </div>

          {/* Masaüstünde başlık */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              Bilgi alın
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Formu doldurun, en kısa sürede dönelim.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-6">
            <RegisterForm />
          </div>

          <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-6">
            myedudesk.com.tr · Türk okulları için tasarlandı
          </p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="/gizlilik" target="_blank" className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:underline">
              Gizlilik Politikası
            </a>
            <a href="/kullanim-kosullari" target="_blank" className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:underline">
              Kullanım Koşulları
            </a>
          </div>
        </div>
      </div>

    </div>
  )
}

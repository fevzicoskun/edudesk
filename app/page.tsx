import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/src/shared/auth'
import EduDeskLogo from '@/components/EduDeskLogo'

export const dynamic = 'force-dynamic'

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    title: 'Dijital Yoklama',
    desc: 'Yoklamayı saniyeler içinde al. Devamsız öğrencinin velisi otomatik bilgilendirilsin. Kağıt defteri, WhatsApp mesajı — hepsi tarihe karıştı.',
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'Ödev & Not Takibi',
    desc: 'Tüm sınıfların ödevleri tek ekranda. Not defterini dijitalde tut, Excel\'e ihtiyaç kalmadan rapor al.',
    color: 'bg-emerald-500/10 text-emerald-500',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Zümre Yönetimi',
    desc: 'Toplantı tutanaklarını dijitalize et. Müfredat takibi, ortak sınavlar, zümre kararları — hepsi arşivde, kağıt yok.',
    color: 'bg-violet-500/10 text-violet-500',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Veli Portalı',
    desc: 'Veliler özel link ile çocuklarının yoklama ve ödevlerini anlık görebilsin. Bilgilendirme bildirimleri otomatik gider.',
    color: 'bg-orange-500/10 text-orange-500',
  },
]

const mockupStudents = [
  { name: 'Ahmet Yılmaz', present: true },
  { name: 'Ayşe Kaya', present: true },
  { name: 'Mehmet Demir', present: false },
  { name: 'Zeynep Çelik', present: true },
]

export default async function RootPage() {
  const user = await getCurrentUser()
  if (user) redirect('/anasayfa')

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <EduDeskLogo size="md" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 font-medium transition-colors"
            >
              Giriş Yap
            </Link>
            <Link
              href="/kayit"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Tanıtım İste
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            <div>
              <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                Türk okulları için tasarlandı
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5">
                Öğretmenlik<br />
                zaten yeterince<br />
                <span className="text-blue-400">zor.</span>
              </h1>

              <p className="text-slate-400 text-lg leading-relaxed mb-8">
                Yoklama, ödev takibi, not defteri, zümre yönetimi ve veli
                bildirimleri tek platformda. Kağıt, Excel ve WhatsApp grubuna
                gerek kalmaz.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/kayit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
                >
                  Okulunuz için tanıtım alın →
                </Link>
                <Link
                  href="/login"
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors"
                >
                  Giriş Yap
                </Link>
              </div>
            </div>

            {/* Hero mockup */}
            <div className="hidden lg:block">
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <div className="bg-slate-800 px-3 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                  </div>
                  <div className="flex-1 bg-slate-700 rounded px-2.5 py-1 text-[10px] text-slate-400 ml-1">
                    myedudesk.com.tr/yoklama
                  </div>
                </div>
                <div className="flex bg-gray-50" style={{ height: 240 }}>
                  <div className="w-12 bg-slate-900 flex flex-col items-center py-3 gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600" />
                    <div className="w-7 h-7 rounded-lg bg-slate-700" />
                    <div className="w-7 h-7 rounded-lg bg-slate-700" />
                    <div className="w-7 h-7 rounded-lg bg-slate-700" />
                  </div>
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">Yoklama — 10-A</div>
                        <div className="text-xs text-gray-400">28 öğrenci · Bugün</div>
                      </div>
                      <div className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg">Kaydet</div>
                    </div>
                    <div className="space-y-2">
                      {mockupStudents.map((s) => (
                        <div key={s.name} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${s.present ? 'bg-white' : 'bg-red-50'}`}>
                          <div className={`w-4 h-4 rounded flex items-center justify-center text-white font-bold shrink-0 ${s.present ? 'bg-green-500' : 'bg-red-400'}`} style={{ fontSize: 9 }}>
                            {s.present ? '✓' : '✗'}
                          </div>
                          <span className={s.present ? 'text-gray-700' : 'text-red-600 font-medium'}>{s.name}</span>
                          {!s.present && <span className="ml-auto text-[10px] text-red-400">Devamsız</span>}
                        </div>
                      ))}
                      <div className="bg-white px-3 py-2 rounded-lg flex items-center gap-2.5 opacity-40">
                        <div className="w-4 h-4 rounded bg-gray-200 shrink-0" />
                        <div className="h-2 bg-gray-200 rounded w-24" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Özellikler */}
      <section className="py-20 px-4 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-3">
              Her şey tek yerden
            </h2>
            <p className="text-gray-500 dark:text-slate-400 text-base max-w-xl mx-auto">
              Farklı uygulamalar, kağıtlar, Excel dosyaları — bunları bir kenara bırakın.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-6">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-slate-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Okulunuz için hazır mı?
          </h2>
          <p className="text-slate-400 mb-8">
            Formu doldurun, en kısa sürede dönelim.
          </p>
          <Link
            href="/kayit"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors"
          >
            Tanıtım veya bilgi alın →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <EduDeskLogo size="sm" white />
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/gizlilik" className="hover:text-slate-300 transition-colors">Gizlilik Politikası</Link>
            <Link href="/kullanim-kosullari" className="hover:text-slate-300 transition-colors">Kullanım Koşulları</Link>
            <span>© 2026 EduDesk</span>
          </div>
        </div>
      </footer>

    </div>
  )
}

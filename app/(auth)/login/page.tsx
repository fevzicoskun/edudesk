import LoginForm from './LoginForm'
import EduDeskLogo from '@/components/EduDeskLogo'
import DashboardMockup from './DashboardMockup'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>
}) {
  const { registered } = await searchParams

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex">

      {/* Sol — karşılama (masaüstünde görünür) */}
      <div className="hidden lg:flex flex-col justify-center px-12 xl:px-16 py-16 w-[52%] bg-slate-900 dark:bg-slate-950">
        <div className="max-w-md">
          <EduDeskLogo size="lg" white className="mb-10" />

          <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
            Hoş geldiniz.
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-4">
            Bugünkü yoklama, bekleyen ödevler, zümre notları —
            hepsi sizi bekliyor.
          </p>

          {/* Ayırıcı */}
          <div className="w-10 h-px bg-slate-700 mb-8" />

          {/* Alıntı */}
          <blockquote className="border-l-2 border-blue-600 pl-4 mb-10">
            <p className="text-slate-300 text-sm italic leading-relaxed">
              "Öğretmek, bir mumu yakıp diğerini söndürmemektir."
            </p>
            <footer className="text-slate-500 text-xs mt-2">— Mustafa Kemal Atatürk</footer>
          </blockquote>

          {/* Dashboard önizlemesi */}
          <DashboardMockup />
        </div>
      </div>

      {/* Sağ — form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobilde logo */}
          <div className="mb-8 lg:hidden">
            <EduDeskLogo size="lg" className="mb-2" />
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Giriş Yap</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Hesabınıza erişin
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
            {registered === '1' && (
              <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm rounded-lg px-4 py-3">
                Kayıt başarılı! E-postanızı doğruladıktan sonra giriş yapabilirsiniz.
              </div>
            )}
            <LoginForm />
          </div>

          <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-6">
            Hesabınız yok mu?{' '}
            <a href="/kayit" className="text-blue-600 hover:underline font-medium">
              Bilgi alın
            </a>
          </p>
        </div>
      </div>

    </div>
  )
}

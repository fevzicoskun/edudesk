import LoginForm from './LoginForm'
import EduDeskLogo from '@/components/EduDeskLogo'

export const metadata = { title: 'Giriş Yap' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>
}) {
  const { registered } = await searchParams

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <EduDeskLogo size="lg" className="mb-2" />
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

        <footer className="mt-8 text-center">
          <div className="flex justify-center gap-4">
            <a href="/gizlilik" target="_blank" className="text-xs text-gray-400 dark:text-slate-500 hover:underline">
              Gizlilik Politikası
            </a>
            <a href="/kullanim-kosullari" target="_blank" className="text-xs text-gray-400 dark:text-slate-500 hover:underline">
              Kullanım Koşulları
            </a>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
            © 2026 EduDesk ·{' '}
            <a href="mailto:info@myedudesk.com.tr" className="hover:underline">
              info@myedudesk.com.tr
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

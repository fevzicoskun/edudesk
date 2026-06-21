import RegisterForm from './RegisterForm'
import EduDeskLogo from '@/components/EduDeskLogo'

export const metadata = { title: 'Kayıt Ol' }

export default function KayitPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <EduDeskLogo size="lg" className="justify-center mb-2" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-6">
          <RegisterForm />
        </div>

        <div className="flex justify-center gap-4 mt-4">
          <a href="/gizlilik" target="_blank" className="text-xs text-gray-400 dark:text-slate-500 hover:underline">
            Gizlilik Politikası
          </a>
          <a href="/kullanim-kosullari" target="_blank" className="text-xs text-gray-400 dark:text-slate-500 hover:underline">
            Kullanım Koşulları
          </a>
        </div>
      </div>
    </div>
  )
}

import EduDeskLogo from '@/components/EduDeskLogo'
import NewPasswordForm from './NewPasswordForm'

export default function NewPasswordPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <EduDeskLogo size="lg" />
        </div>

        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yeni Şifre Belirle</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            En az 6 karakterli yeni şifrenizi girin.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
          <NewPasswordForm />
        </div>
      </div>
    </div>
  )
}

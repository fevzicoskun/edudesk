import RegisterForm from './RegisterForm'
import EduDeskLogo from '@/components/EduDeskLogo'

export default function KayitPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <EduDeskLogo size="lg" className="justify-center mb-2" />
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Okulunuz için demo veya bilgi alın</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-6">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}

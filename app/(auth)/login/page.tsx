import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="w-full max-w-md px-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">EduDesk</h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">Hesabınıza giriş yapın</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

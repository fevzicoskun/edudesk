import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">EduDesk</h1>
            <p className="text-gray-500 mt-1 text-sm">Hesabınıza giriş yapın</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

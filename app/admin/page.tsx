import { createServiceClient } from '@/src/infrastructure/supabase/service'
import ProvisionForm from './ProvisionForm'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const db = createServiceClient()
  const { data: schools } = await db
    .from('tenant_metrics')
    .select('school_id, school_name, teacher_count, student_count, status, plan, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">Yeni okul ve müdür hesabı oluştur</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Yeni Okul Ekle</h2>
          <div className="max-w-sm">
            <ProvisionForm />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">
            Okullar
            <span className="ml-2 text-xs font-normal text-gray-400">({schools?.length ?? 0})</span>
          </h2>

          {!schools?.length ? (
            <p className="text-sm text-gray-400">Henüz okul yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Okul</th>
                    <th className="pb-2 font-medium text-center">Öğretmen</th>
                    <th className="pb-2 font-medium text-center">Öğrenci</th>
                    <th className="pb-2 font-medium">Plan</th>
                    <th className="pb-2 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {schools.map((s) => (
                    <tr key={s.school_id} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-800">{s.school_name}</td>
                      <td className="py-2.5 text-center text-gray-600">{s.teacher_count ?? 0}</td>
                      <td className="py-2.5 text-center text-gray-600">{s.student_count ?? 0}</td>
                      <td className="py-2.5 text-gray-600">{s.plan}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.status === 'active' ? 'bg-green-100 text-green-700' :
                          s.status === 'suspended' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

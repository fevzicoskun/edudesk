import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import ExportPanel from './ExportPanel'

export const revalidate = 300

export default async function RaporlarPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Raporlar</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Excel formatında dışa aktarma
        </p>
      </div>
      <ExportPanel />
    </div>
  )
}

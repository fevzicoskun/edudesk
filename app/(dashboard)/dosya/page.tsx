export const revalidate = false

import DosyaChecklist from './DosyaChecklist'
import DosyaPdfButton from './DosyaPdfButton'

export default function DosyaPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Öğretmen Dosyası</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            MEB yönetmeliğine göre dosyanızda bulunması gereken belgeler — işaretler yalnızca bu cihazda saklanır
          </p>
        </div>
        <DosyaPdfButton />
      </div>
      <DosyaChecklist />
    </div>
  )
}

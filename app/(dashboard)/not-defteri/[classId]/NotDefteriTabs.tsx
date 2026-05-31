'use client'

import { useState } from 'react'
import GradeGrid from './GradeGrid'
import KanaatSekmesi from './KanaatSekmesi'
import type { GradeColumn, GradeEntry } from '@/src/domains/grades/types'
import type { KanaatNotu } from '@/src/domains/kanaat/types'

interface Student {
  id:             string
  full_name:      string
  student_number: string | null
}

interface Props {
  classId:         string
  columns:         GradeColumn[]
  entries:         GradeEntry[]
  students:        Student[]
  kanaatKayitlari: KanaatNotu[]
  currentDonem:    string
  canWrite:        boolean
}

type Tab = 'notlar' | 'kanaat'

export default function NotDefteriTabs({
  classId, columns, entries, students,
  kanaatKayitlari, currentDonem, canWrite,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('notlar')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'notlar',  label: 'Not Girişi' },
    { id: 'kanaat',  label: 'Kanaat' },
  ]

  return (
    <div>
      <div className="flex border-b mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'notlar' && (
        <GradeGrid
          classId={classId}
          columns={columns}
          entries={entries}
          students={students}
          canWrite={canWrite}
        />
      )}

      {activeTab === 'kanaat' && (
        <KanaatSekmesi
          classId={classId}
          donem={currentDonem}
          students={students}
          kanaatKayitlari={kanaatKayitlari}
          canWrite={canWrite}
        />
      )}
    </div>
  )
}

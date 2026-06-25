import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { isTeachingRole } from '@/src/shared/types'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import { MeetingService } from '@/src/domains/meetings/services/MeetingService'
import RandevularClient from './RandevularClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Veli Görüşmeleri' }

export default async function RandevularPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')
  if (!isTeachingRole(profile.role)) redirect('/anasayfa')

  const { periods, slots } = await ScheduleService.getMySchedule()
  // Öğretmenin ders verdiği sınıflar = programındaki slot'ların class_id'leri (boşluk hesabı da buna dayanır).
  const classIds = Array.from(new Set(slots.map(s => s.class_id)))
  const [meetings, students] = await Promise.all([
    MeetingService.getMyMeetings(),
    MeetingService.getStudentOptions(classIds),
  ])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <RandevularClient
        periods={periods}
        slots={slots}
        meetings={meetings}
        students={students}
      />
    </div>
  )
}

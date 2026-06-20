import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import { DutyService } from '@/src/domains/schedule/services/DutyService'
import DersProgramiClient from './DersProgramiClient'
import NobetKarti from './NobetKarti'
import NobetCizelgesi from './NobetCizelgesi'

export const dynamic = 'force-dynamic'

export default async function DersProgramiPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')
  if (!(isTeachingRole(profile.role) || isMudurOrAbove(profile.role))) redirect('/anasayfa')

  const isYonetici = isMudurOrAbove(profile.role)

  // Müdür/MY ek olarak okul nöbet çizelgesini görür (RLS müdür/MY'ye izinli).
  const [{ periods, slots, classes }, duty, schoolDuties] = await Promise.all([
    ScheduleService.getMySchedule(),
    DutyService.getMyDuty(),
    isYonetici ? DutyService.listSchoolDuties() : Promise.resolve([]),
  ])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <DersProgramiClient
        initialPeriods={periods}
        initialSlots={slots}
        classes={classes}
        subject={profile.subject ?? ''}
        teacherName={profile.full_name ?? ''}
      />
      <NobetKarti initialDuty={duty} />
      {isYonetici && <NobetCizelgesi rows={schoolDuties} />}
    </div>
  )
}

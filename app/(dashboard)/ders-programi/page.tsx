import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import { DutyService } from '@/src/domains/schedule/services/DutyService'
import DersProgramiClient from './DersProgramiClient'
import NobetKarti from './NobetKarti'

export const dynamic = 'force-dynamic'

export default async function DersProgramiPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')
  if (!(isTeachingRole(profile.role) || isMudurOrAbove(profile.role))) redirect('/anasayfa')

  const [{ periods, slots, classes }, duty] = await Promise.all([
    ScheduleService.getMySchedule(),
    DutyService.getMyDuty(),
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
    </div>
  )
}

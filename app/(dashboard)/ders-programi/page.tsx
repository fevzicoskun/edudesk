import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import DersProgramiClient from './DersProgramiClient'

export const dynamic = 'force-dynamic'

export default async function DersProgramiPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')
  if (!(isTeachingRole(profile.role) || isMudurOrAbove(profile.role))) redirect('/anasayfa')

  const { periods, slots, classes } = await ScheduleService.getMySchedule()

  return (
    <DersProgramiClient
      initialPeriods={periods}
      initialSlots={slots}
      classes={classes}
      subject={profile.subject ?? ''}
    />
  )
}

import { getCurrentProfile } from '@/src/shared/auth'
import { redirect, notFound } from 'next/navigation'
import { createClient }       from '@/src/infrastructure/supabase/server'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'
import GunlukPlanForm from '../yeni/GunlukPlanForm'

export default async function GunlukPlanEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { data: plan } = await InspectionRepository.findDailyPlan(id, profile.id)
  if (!plan) notFound()

  const supabase = await createClient()
  const { data: classesData } = await supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', profile.school_id)
    .order('grade').order('name')
  const classes = (classesData ?? []) as { id: string; name: string; grade: number }[]

  return (
    <GunlukPlanForm
      classes={classes}
      planId={plan.id}
      defaultValues={{
        class_id:         plan.class_id,
        plan_date:        plan.plan_date,
        lesson_hour:      plan.lesson_hour,
        unit:             plan.unit,
        topic:            plan.topic,
        objectives:       plan.objectives,
        methods:          plan.methods,
        materials:        plan.materials,
        intro_text:       plan.intro_text,
        development_text: plan.development_text,
        conclusion_text:  plan.conclusion_text,
      }}
    />
  )
}

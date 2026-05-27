'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod/v4'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'
import { AnnualPlanService }    from '@/src/domains/inspection/services/AnnualPlanService'
import { getAbility }           from '@/src/shared/authorization/server'
import {
  DEFAULT_AGENDA_ITEMS,
  DEFAULT_DECISIONS,
} from '@/src/domains/inspection/types'

// ── Günlük Plan ───────────────────────────────────────────────────────────────

const DailyPlanSchema = z.object({
  class_id:         z.string().uuid(),
  plan_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lesson_hour:      z.coerce.number().int().min(1).max(8),
  unit:             z.string().min(1).max(200),
  topic:            z.string().min(1).max(200),
  objectives:       z.string().transform(v => v ? v.split(',').map(s => s.trim()).filter(Boolean) : []),
  methods:          z.string().transform(v => v ? v.split(',').map(s => s.trim()).filter(Boolean) : []),
  materials:        z.string().transform(v => v ? v.split(',').map(s => s.trim()).filter(Boolean) : []),
  intro_text:       z.string().min(1),
  development_text: z.string().min(1),
  conclusion_text:  z.string().min(1),
})

export async function createDailyPlanAction(_: unknown, formData: FormData) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const parsed = DailyPlanSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const { data, error } = await InspectionRepository.insertDailyPlan({
    ...parsed.data,
    teacher_id: ability.userId,
    school_id:  ability.schoolId,
  })
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/gunluk-plan')
  return { id: data?.id }
}

export async function updateDailyPlanAction(id: string, _: unknown, formData: FormData) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const parsed = DailyPlanSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const { error } = await InspectionRepository.updateDailyPlan(id, ability.userId, parsed.data as never)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam/gunluk-plan')
  return {}
}

export async function deleteDailyPlanAction(id: string) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const { error } = await InspectionRepository.softDeleteDailyPlan(id, ability.userId)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/gunluk-plan')
  return {}
}

// ── Yıllık Plan ───────────────────────────────────────────────────────────────

export async function getOrCreateAnnualPlanAction(grade: number) {
  return AnnualPlanService.getOrCreate(grade, 'Matematik', getCurrentAcademicYear())
}

export async function approveAnnualPlanAction(planId: string) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const supabase = await (await import('@/src/infrastructure/supabase/server')).createClient()
  const { error } = await supabase
    .from('annual_plans')
    .update({ approved_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('teacher_id', ability.userId)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/yillik-plan')
  return {}
}

// ── ŞÖK Raporu ────────────────────────────────────────────────────────────────

const SokBaseSchema = z.object({
  class_id:      z.string().uuid(),
  meeting_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  term:          z.coerce.number().int().pipe(z.union([z.literal(1), z.literal(2)])),
  academic_year: z.string().min(7).max(9),
})

const ParticipantSchema = z.object({
  user_id:    z.string().min(1),
  full_name:  z.string().min(1),
  subject:    z.string().min(1),
})

const AgendaItemSchema = z.object({
  order:      z.number().int().min(0),
  text:       z.string().min(1),
  discussed:  z.boolean(),
  note:       z.string(),
})

const DecisionSchema = z.object({
  order:  z.number().int().min(0),
  text:   z.string().min(1),
  note:   z.string(),
})

const StudentNoteSchema = z.object({
  student_id:   z.string().min(1),
  student_name: z.string().min(1),
  status:       z.enum(['basarili', 'basarisiz', 'riskli']),
  note:         z.string(),
})

const UpdateSokSchema = z.object({
  participants:  z.array(ParticipantSchema).optional(),
  agenda_items:  z.array(AgendaItemSchema).optional(),
  decisions:     z.array(DecisionSchema).optional(),
  student_notes: z.array(StudentNoteSchema).optional(),
})

export async function createSokReportAction(_: unknown, formData: FormData) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const parsed = SokBaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const agendaItems = DEFAULT_AGENDA_ITEMS.map(item => ({
    ...item, discussed: false, note: '',
  }))
  const decisions = DEFAULT_DECISIONS.map(d => ({ ...d, note: '' }))

  // Validate participants with try/catch
  let participants: z.infer<typeof ParticipantSchema>[] = []
  const participantsRaw = formData.get('participants')
  if (participantsRaw) {
    try {
      const parsed = JSON.parse(participantsRaw as string)
      const validated = z.array(ParticipantSchema).safeParse(parsed)
      if (!validated.success) {
        return { error: validated.error.issues[0]?.message ?? 'Geçersiz katılımcı verisi' }
      }
      participants = validated.data
    } catch {
      return { error: 'Katılımcı verisi JSON biçiminde değil' }
    }
  }

  // Validate agenda items with try/catch
  let finalAgenda = agendaItems
  const agendaRaw = formData.get('agenda_items')
  if (agendaRaw) {
    try {
      const parsed = JSON.parse(agendaRaw as string)
      const validated = z.array(AgendaItemSchema).safeParse(parsed)
      if (!validated.success) {
        return { error: validated.error.issues[0]?.message ?? 'Geçersiz gündemi verisi' }
      }
      finalAgenda = validated.data
    } catch {
      return { error: 'Gündemi verisi JSON biçiminde değil' }
    }
  }

  const { data, error } = await InspectionRepository.insertSokReport({
    ...parsed.data,
    teacher_id:    ability.userId,
    school_id:     ability.schoolId,
    participants,
    agenda_items:  finalAgenda,
    decisions,
    student_notes: [],
  })
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/sok')
  return { id: data?.id }
}

export async function updateSokReportAction(id: string, updates: {
  participants?:  unknown[]
  agenda_items?:  unknown[]
  decisions?:     unknown[]
  student_notes?: unknown[]
}) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const validated = UpdateSokSchema.safeParse(updates)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? 'Geçersiz güncelleme verisi' }
  }

  const { error } = await InspectionRepository.updateSokReport(id, ability.userId, validated.data as never)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam/sok')
  return {}
}

// ── Defter Kontrolü ───────────────────────────────────────────────────────────

const NotebookCheckSchema = z.object({
  class_id:   z.string().uuid(),
  check_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:      z.string().max(500).optional().transform(v => v ?? null),
})

export async function createNotebookCheckAction(_: unknown, formData: FormData) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const parsed = NotebookCheckSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const { error } = await InspectionRepository.insertNotebookCheck({
    ...parsed.data,
    teacher_id: ability.userId,
    school_id:  ability.schoolId,
  })
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/defter-kontrolu')
  return {}
}

export async function deleteNotebookCheckAction(id: string) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const { error } = await InspectionRepository.deleteNotebookCheck(id, ability.userId)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/defter-kontrolu')
  return {}
}

// ── Yardımcı ─────────────────────────────────────────────────────────────────
function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 9 ? year : year - 1
  return `${start}-${start + 1}`
}

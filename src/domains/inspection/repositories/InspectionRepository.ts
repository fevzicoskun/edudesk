// src/domains/inspection/repositories/InspectionRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'
import type { DailyPlan, AnnualPlan, SokReport, NotebookCheck } from '../types'

export const InspectionRepository = {
  // ── DailyPlan ──────────────────────────────────────────────────────────────
  async findDailyPlans(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('plan_date', { ascending: false })
      .returns<DailyPlan[]>()
  },

  async findDailyPlan(id: string, teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .select('*')
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .is('deleted_at', null)
      .single<DailyPlan>()
  },

  async insertDailyPlan(data: Omit<DailyPlan, 'id' | 'created_at' | 'deleted_at'>) {
    const supabase = await createClient()
    return supabase.from('daily_plans').insert(data).select().single<DailyPlan>()
  },

  async updateDailyPlan(id: string, teacherId: string, data: Partial<DailyPlan>) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .update(data)
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async softDeleteDailyPlan(id: string, teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async countDailyPlansThisTerm(teacherId: string, schoolId: string, termStart: string) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .gte('plan_date', termStart)
      .is('deleted_at', null)
  },

  // ── AnnualPlan ─────────────────────────────────────────────────────────────
  async findAnnualPlan(teacherId: string, academicYear: string, subject: string) {
    const supabase = await createClient()
    return supabase
      .from('annual_plans')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('academic_year', academicYear)
      .eq('subject', subject)
      .maybeSingle<AnnualPlan>()
  },

  async upsertAnnualPlan(data: Omit<AnnualPlan, 'id' | 'created_at'>) {
    const supabase = await createClient()
    return supabase
      .from('annual_plans')
      .upsert(data, { onConflict: 'teacher_id,academic_year,subject' })
      .select()
      .single<AnnualPlan>()
  },

  // ── SokReport ──────────────────────────────────────────────────────────────
  async findSokReports(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('sok_reports')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('meeting_date', { ascending: false })
      .returns<SokReport[]>()
  },

  async findSokReport(id: string, teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('sok_reports')
      .select('*')
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .is('deleted_at', null)
      .single<SokReport>()
  },

  async insertSokReport(data: Omit<SokReport, 'id' | 'created_at' | 'deleted_at'>) {
    const supabase = await createClient()
    return supabase.from('sok_reports').insert(data).select().single<SokReport>()
  },

  async updateSokReport(id: string, teacherId: string, data: Partial<SokReport>) {
    const supabase = await createClient()
    return supabase
      .from('sok_reports')
      .update(data)
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async countSokReportsThisTerm(teacherId: string, schoolId: string, term: 1 | 2, academicYear: string) {
    const supabase = await createClient()
    return supabase
      .from('sok_reports')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .eq('term', term)
      .eq('academic_year', academicYear)
      .is('deleted_at', null)
  },

  // ── NotebookCheck ──────────────────────────────────────────────────────────
  async findNotebookChecks(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('notebook_checks')
      .select('*, classes(name)')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .order('check_date', { ascending: false })
      .returns<(NotebookCheck & { classes: { name: string } | null })[]>()
  },

  async insertNotebookCheck(data: Omit<NotebookCheck, 'id' | 'created_at'>) {
    const supabase = await createClient()
    return supabase.from('notebook_checks').insert(data).select().single<NotebookCheck>()
  },

  async deleteNotebookCheck(id: string, teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('notebook_checks')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async countNotebookChecksThisTerm(teacherId: string, schoolId: string, termStart: string) {
    const supabase = await createClient()
    return supabase
      .from('notebook_checks')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .gte('check_date', termStart)
  },
}

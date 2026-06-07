'use server'

import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'

export type SearchResult = {
  type: 'page' | 'student' | 'homework'
  id: string
  title: string
  subtitle?: string
  href: string
}

const STATIC_PAGES: SearchResult[] = [
  { type: 'page', id: 'anasayfa', title: 'Anasayfa', subtitle: 'Sayfa', href: '/anasayfa' },
  { type: 'page', id: 'odevler', title: 'Ödevler', subtitle: 'Sayfa', href: '/odevler' },
  { type: 'page', id: 'odevler-yeni', title: 'Yeni Ödev Oluştur', subtitle: 'Ödevler', href: '/odevler/yeni' },
  { type: 'page', id: 'odevler-takvim', title: 'Ödev Takvimi', subtitle: 'Ödevler', href: '/odevler/takvim' },
  { type: 'page', id: 'siniflar', title: 'Sınıflar', subtitle: 'Sayfa', href: '/siniflar' },
  { type: 'page', id: 'yoklama', title: 'Yoklama', subtitle: 'Sayfa', href: '/yoklama' },
  { type: 'page', id: 'profil', title: 'Profil', subtitle: 'Sayfa', href: '/profil' },
  { type: 'page', id: 'ayarlar', title: 'Ayarlar', subtitle: 'Sayfa', href: '/ayarlar' },
]

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile?.school_id || !user) return []

  const isManager = isMudurOrAbove(profile.role)
  const supabase = await createClient()

  let hwQuery = supabase
    .from('homeworks')
    .select('id, title, classes!inner(id, name)')
    .eq('school_id', profile.school_id)
    .eq('is_template', false)
    .ilike('title', `%${q}%`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(6)

  if (!isManager) hwQuery = hwQuery.eq('teacher_id', user.id)

  const [studentsRes, homeworkRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, classes!inner(id, name)')
      .eq('school_id', profile.school_id)
      .ilike('full_name', `%${q}%`)
      .is('deleted_at', null)
      .limit(6),
    hwQuery,
  ])

  const lq = q.toLowerCase()
  const pages = STATIC_PAGES.filter(p => p.title.toLowerCase().includes(lq))

  type StudentRow = { id: string; full_name: string; classes: { id: string; name: string } | { id: string; name: string }[] }
  const students: SearchResult[] = (studentsRes.data ?? []).map((s: StudentRow) => {
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes
    return {
      type: 'student',
      id: s.id,
      title: s.full_name,
      subtitle: cls?.name ?? 'Öğrenci',
      href: `/siniflar/${cls?.id ?? ''}`,
    }
  })

  type HomeworkRow = { id: string; title: string; classes: { id: string; name: string } | { id: string; name: string }[] }
  const homework: SearchResult[] = (homeworkRes.data ?? []).map((h: HomeworkRow) => {
    const cls = Array.isArray(h.classes) ? h.classes[0] : h.classes
    return {
      type: 'homework',
      id: h.id,
      title: h.title,
      subtitle: cls?.name ?? 'Ödev',
      href: `/odevler/${h.id}`,
    }
  })

  return [...pages, ...students, ...homework]
}

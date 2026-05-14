'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(2, 'Okul adı en az 2 karakter olmalı').max(120).trim(),
})

const joinSchema = z.object({
  code: z.string().min(2, 'Geçersiz okul kodu').max(80).trim(),
})

/** Yeni okul oluştur ve profile ata — kurucu otomatik zumre_baskani olur */
export async function setupSchool(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const parsed = createSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (existing?.school_id) redirect('/anasayfa')

  const slug = parsed.data.name
    .toLowerCase()
    .replace(/[çÇ]/g, 'c').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[ıİ]/g, 'i')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    .slice(0, 50) + '-' + Date.now().toString(36)

  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .insert({ name: parsed.data.name, slug })
    .select('id')
    .single()

  if (schoolErr || !school) return { error: schoolErr?.message ?? 'Okul oluşturulamadı' }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, school_id: school.id, role: 'zumre_baskani' }, { onConflict: 'id' })

  if (error) return { error: error.message }
  redirect('/anasayfa')
}

/** Mevcut okula slug/kod ile katıl */
export async function joinSchool(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const parsed = joinSchema.safeParse({ code: formData.get('code') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (existing?.school_id) redirect('/anasayfa')

  // Okulu slug'a göre ara
  const { data: school } = await supabase
    .from('schools')
    .select('id, name')
    .eq('slug', parsed.data.code.toLowerCase().trim())
    .single()

  if (!school) return { error: 'Bu kod ile bir okul bulunamadı. Başkanınızdan doğru kodu alın.' }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, school_id: school.id }, { onConflict: 'id' })

  if (error) return { error: error.message }
  redirect('/anasayfa')
}

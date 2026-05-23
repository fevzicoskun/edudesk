'use server'

import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { revalidatePath } from 'next/cache'

export async function getNotifications() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, homework_id, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(30)
  return data ?? []
}

export async function getUnreadCount() {
  const supabase = await createClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return count ?? 0
}

export async function markAllRead() {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  revalidatePath('/', 'layout')
}

export async function markRead(id: string) {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  revalidatePath('/', 'layout')
}

export async function getNotificationPreferences() {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()])
  if (!user) return null
  const { data } = await supabase
    .from('notification_preferences')
    .select('days_before, email_on')
    .eq('user_id', user.id)
    .single()
  return data ?? { days_before: 1, email_on: true }
}

export async function saveNotificationPreferences(formData: FormData) {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()])
  if (!user) return

  const days_before = Math.min(7, Math.max(1, Number(formData.get('days_before')) || 1))
  const email_on = formData.get('email_on') === 'on'

  await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, days_before, email_on, updated_at: new Date().toISOString() })

  revalidatePath('/ayarlar')
}

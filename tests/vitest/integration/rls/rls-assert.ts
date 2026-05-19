/**
 * RLS test assertion yardımcıları.
 *
 * Tasarım kararı: supabase-js, RLS tarafından engellenen DELETE/UPDATE işlemlerinde
 * hata VERMEZ — sadece 0 satır döndürür. Bu helper'lar bu davranışı normalize eder
 * ve hem hata-bazlı (INSERT) hem de sessiz (DELETE/UPDATE) RLS korumasını doğrular.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { expect } from 'vitest'

/** Belirtilen satırın bu client ile okunabildiğini doğrular. */
export async function assertCanRead(
  client: SupabaseClient,
  table: string,
  id: string,
  label = ''
) {
  const { data, error } = await client.from(table).select('id').eq('id', id)
  const tag = label ? `[${label}] ` : ''
  if (error) throw new Error(`${tag}assertCanRead(${table}): sorgu hatası — ${error.message}`)
  expect(data ?? [], `${tag}${table}/${id} okunabilmeli`).toHaveLength(1)
}

/** Belirtilen satırın bu client ile OKUNAMAYACAĞINI doğrular (RLS filtresi). */
export async function assertCannotRead(
  client: SupabaseClient,
  table: string,
  id: string,
  label = ''
) {
  const { data, error } = await client.from(table).select('id').eq('id', id)
  const tag = label ? `[${label}] ` : ''
  if (error) throw new Error(`${tag}assertCannotRead(${table}): sorgu hatası — ${error.message}`)
  expect(data ?? [], `${tag}${table}/${id} gizli olmalı — 0 satır bekleniyor`).toHaveLength(0)
}

/**
 * INSERT'in RLS WITH CHECK tarafından reddedildiğini doğrular.
 * INSERT politikaları gerçek hata döndürür (DELETE/UPDATE'in aksine).
 */
export async function assertInsertBlocked(
  client: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
  label = ''
) {
  const { error } = await client.from(table).insert(row)
  const tag = label ? `[${label}] ` : ''
  expect(error, `${tag}${table} INSERT engellenmiş olmalı`).not.toBeNull()
}

/** INSERT'in başarılı olduğunu doğrular ve oluşturulan satırın ID'sini döndürür. */
export async function assertInsertAllowed(
  client: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
  label = ''
): Promise<string> {
  const { data, error } = await client.from(table).insert(row).select('id').single()
  const tag = label ? `[${label}] ` : ''
  if (error) throw new Error(`${tag}${table} INSERT başarısız olmamalıydı: ${error.message}`)
  return (data as { id: string }).id
}

/**
 * DELETE'in RLS USING tarafından sessizce engellendiğini doğrular.
 * RLS DELETE politikası yoksa: istemci 0 satır siler, hata vermez.
 * serviceDb ile kayıt hâlâ orada olduğu doğrulanır.
 */
export async function assertDeleteBlocked(
  client: SupabaseClient,
  table: string,
  id: string,
  serviceDb: SupabaseClient,
  label = ''
) {
  const tag = label ? `[${label}] ` : ''
  await client.from(table).delete().eq('id', id)

  // Kayıt hâlâ duruyor mu?
  const { data } = await serviceDb.from(table).select('id').eq('id', id)
  expect(data ?? [], `${tag}${table}/${id} silinmemiş olmalı`).toHaveLength(1)
}

/**
 * UPDATE'in RLS tarafından sessizce engellendiğini doğrular.
 * serviceDb ile field'ın değişmediği doğrulanır.
 */
export async function assertUpdateBlocked(
  client: SupabaseClient,
  table: string,
  id: string,
  field: string,
  newValue: unknown,
  serviceDb: SupabaseClient,
  label = ''
) {
  const tag = label ? `[${label}] ` : ''
  const patch = { [field]: newValue }

  // Güncelleme öncesi değeri al
  const { data: before } = await serviceDb.from(table).select(field).eq('id', id).single()
  const originalValue = (before as unknown as Record<string, unknown>)?.[field]

  await client.from(table).update(patch).eq('id', id)

  // Değer değişmemiş olmalı
  const { data: after } = await serviceDb.from(table).select(field).eq('id', id).single()
  expect(
    (after as unknown as Record<string, unknown>)?.[field],
    `${tag}${table}.${field} değişmemiş olmalı`
  ).toBe(originalValue)
}

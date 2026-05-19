import { z } from 'zod'
import { NextRequest } from 'next/server'

// Proper discriminated union so TypeScript narrows data after checking success
type ParseOk<T>   = { success: true;  data: T;    error: null   }
type ParseFail    = { success: false; data: null; error: string }
type ParseResult<T> = ParseOk<T> | ParseFail

export async function parseBody<T>(
  req:    NextRequest,
  schema: z.ZodSchema<T>,
): Promise<ParseResult<T>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { success: false, data: null, error: 'Geçersiz JSON' }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Geçersiz istek' }
  }
  return { success: true, data: parsed.data, error: null }
}

export function parseSearchParams<T>(
  req:    NextRequest,
  schema: z.ZodSchema<T>,
): ParseResult<T> {
  const raw    = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Geçersiz parametreler' }
  }
  return { success: true, data: parsed.data, error: null }
}

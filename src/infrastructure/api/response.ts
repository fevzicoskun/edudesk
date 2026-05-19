import { NextResponse } from 'next/server'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ApiMeta {
  readonly request_id:  string
  readonly duration_ms: number
  readonly timestamp:   string
}

export interface ApiSuccess<T = unknown> {
  readonly ok:   true
  readonly data: T
  readonly meta: ApiMeta
}

export interface ApiError {
  readonly ok:    false
  readonly error: {
    readonly code:     string
    readonly message:  string
    readonly details?: unknown
  }
  readonly meta: ApiMeta
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

// ─── Meta context (passed through the middleware) ─────────────────────────────

export interface MetaCtx {
  readonly requestId: string
  readonly startedAt: number
}

// ─── Factories ────────────────────────────────────────────────────────────────

function makeMeta(ctx: MetaCtx): ApiMeta {
  return {
    request_id:  ctx.requestId,
    duration_ms: Date.now() - ctx.startedAt,
    timestamp:   new Date().toISOString(),
  }
}

export function apiOk<T>(data: T, ctx: MetaCtx): ApiSuccess<T> {
  return { ok: true, data, meta: makeMeta(ctx) }
}

export function apiErr(
  code:     string,
  message:  string,
  ctx:      MetaCtx,
  details?: unknown,
): ApiError {
  return {
    ok:    false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    meta:  makeMeta(ctx),
  }
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function jsonOk<T>(data: T, ctx: MetaCtx, status = 200) {
  return NextResponse.json(apiOk(data, ctx), { status })
}

export function jsonErr(code: string, message: string, ctx: MetaCtx, status: number, details?: unknown) {
  return NextResponse.json(apiErr(code, message, ctx, details), { status })
}

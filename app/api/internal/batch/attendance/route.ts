import { NextResponse } from 'next/server'

export const POST = () =>
  NextResponse.json({ error: 'Yoklama modülü bu sürümde aktif değil.' }, { status: 501 })

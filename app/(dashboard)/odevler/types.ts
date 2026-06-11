export type FilterParams = {
  sinif?: string
  ders?: string
  ogretmen?: string
  q?: string
  olusturuldu?: string
  hatali?: string
  page?: string
}

export type HW = { id: string; title: string; subject: string; due_date: string | null; class_id: unknown; description: string | null; classes: unknown; teacher?: unknown }

export type StatusCounts = { yapildi: number; eksik: number; yapilmadi: number; gec: number; mazeretli: number }

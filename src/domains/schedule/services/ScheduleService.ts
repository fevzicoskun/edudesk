import { requireAbility } from '@/src/shared/authorization/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { ScheduleRepository } from '../repositories/ScheduleRepository'
import { DEFAULT_PERIODS, validatePeriods, validateSlots, type Period, type Slot } from '../scheduleMath'
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { buildOcrPrompt, parseOcrResult } from '../ocrPrompt'

export const ScheduleService = {
  async getMySchedule(): Promise<{ periods: Period[]; slots: Slot[]; classes: { id: string; name: string }[] }> {
    const ability = await requireAbility()
    const [rowRes, classRes] = await Promise.all([
      ScheduleRepository.getByTeacher(ability.userId, ability.schoolId),
      ScheduleRepository.listSchoolClasses(ability.schoolId),
    ])
    // Okuma hatasını sessizce yutma — boş program/sınıf listesi "veri yok" gibi görünür.
    if (rowRes.error || classRes.error) {
      logger.error(
        { event: 'schedule_read_failed', userId: ability.userId, rowErr: rowRes.error?.message, classErr: classRes.error?.message },
        'Ders programı okuma hatası',
      )
    }
    const row = rowRes.data
    const periods = (row?.periods as Period[] | null)?.length ? (row!.periods as unknown as Period[]) : DEFAULT_PERIODS
    const slots = (row?.slots as Slot[] | null) ?? []
    return {
      periods,
      slots,
      classes: (classRes.data ?? []) as { id: string; name: string }[],
    }
  },

  async saveMySchedule(periods: Period[], slots: Slot[]): Promise<{ error?: string }> {
    const ability = await requireAbility()

    const pErr = validatePeriods(periods)
    if (pErr) return { error: pErr }

    // class_id'leri UI'a güvenmeden okul sınıflarına karşı doğrula (cross-tenant koruması).
    const { data: classes } = await ScheduleRepository.listSchoolClasses(ability.schoolId)
    const validIds = (classes ?? []).map(c => c.id)
    const sErr = validateSlots(slots, periods, validIds)
    if (sErr) return { error: sErr }

    const { error } = await ScheduleRepository.upsert({
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      periods,
      slots,
    })
    if (error) return { error: error.message }
    return {}
  },

  async ocrFromImage(image: { data: Uint8Array; mediaType: string }): Promise<{ slots?: Slot[]; error?: string }> {
    const ability = await requireAbility()
    const { data: classes, error: classErr } = await ScheduleRepository.listSchoolClasses(ability.schoolId)
    if (classErr) {
      logger.error({ event: 'ocr_class_read_failed', userId: ability.userId, err: classErr.message }, 'OCR sınıf listesi okunamadı')
      return { error: 'Sınıf listesi alınamadı' }
    }
    const list = (classes ?? []) as { id: string; name: string }[]
    if (list.length === 0) return { error: 'Okulda kayıtlı sınıf yok' }

    try {
      const { object } = await generateObject({
        model: google('gemini-2.5-flash'),
        schema: z.object({
          cells: z.array(z.object({ day: z.number(), period: z.number(), class: z.string() })),
        }),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: buildOcrPrompt(list.map(c => c.name)) },
              { type: 'image', image: image.data, mediaType: image.mediaType },
            ],
          },
        ],
      })
      const slots = parseOcrResult(object.cells, list)
      return { slots }
    } catch (e) {
      logger.error({ event: 'ocr_inference_failed', userId: ability.userId, err: e instanceof Error ? e.message : String(e) }, 'OCR çıkarımı başarısız')
      return { error: 'Görüntü okunamadı, ızgarayı elle doldurabilirsiniz' }
    }
  },
}

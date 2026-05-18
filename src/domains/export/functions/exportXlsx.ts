import { inngest } from '@/lib/inngest'
import { ExportRepository } from '../repositories/ExportRepository'
import { fetchRows, buildXlsx, uploadToStorage } from '../services/XlsxBuilder'
import type { JobType } from '../types'

type ExportRequestedData = {
  jobId: string
  jobType: JobType
  params: Record<string, string>
  userId: string
  schoolId: string
}

export const exportXlsxFn = inngest.createFunction(
  {
    id: 'export-xlsx',
    triggers: [{ event: 'export/requested' }],
    retries: 3,
    cancelOn: [{ event: 'export/cancelled', match: 'data.jobId' }],
  },
  async ({ event, step, attempt }) => {
    const { jobId, jobType, params, userId, schoolId } =
      event.data as ExportRequestedData

    await step.run('mark-processing', async () => {
      await ExportRepository.markProcessing(jobId, attempt + 1)
    })

    const rows = await step.run('fetch-data', async () => {
      await ExportRepository.updateProgress(jobId, 20, 'Veriler alınıyor…')
      return fetchRows(jobType, params, schoolId)
    })

    const { url, filename } = await step.run('build-and-upload', async () => {
      await ExportRepository.updateProgress(jobId, 60, 'Excel oluşturuluyor…')
      const buffer = buildXlsx(rows, jobType)
      await ExportRepository.updateProgress(jobId, 80, 'Dosya yükleniyor…')
      return uploadToStorage(buffer, userId, jobType)
    })

    await step.run('mark-done', async () => {
      await ExportRepository.markDone(jobId, url, filename)
    })

    return { jobId, url, filename }
  }
)

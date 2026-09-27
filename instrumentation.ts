import type { Instrumentation } from 'next'

// Sunucu tarafı render / route handler / server action hatalarını app_errors'a
// yazar (+ production'da e-posta). Yalnız Node runtime: service client orada çalışır.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { sendCriticalAlert } = await import('@/src/infrastructure/observability/alerts')
  const { sunucuHatasiAlarmi } = await import('@/src/infrastructure/observability/sunucuHatasi')
  await sendCriticalAlert(sunucuHatasiAlarmi(err, request, context))
}

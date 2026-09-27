import type { Instrumentation } from 'next'

// Sunucu tarafı render / route handler / server action hatalarını app_errors'a
// yazar (+ e-posta). Yalnız production + Node runtime: yerel dev/e2e de canlı DB'ye
// bağlı, test gürültüsü Hatalar paneline düşmesin. Kullanıcının sayfadan ayrılması
// (bağlantı koptu) hata sayılmaz.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return
  const { istemciKoptu, sunucuHatasiAlarmi } = await import('@/src/infrastructure/observability/sunucuHatasi')
  if (istemciKoptu(err)) return
  const { sendCriticalAlert } = await import('@/src/infrastructure/observability/alerts')
  await sendCriticalAlert(sunucuHatasiAlarmi(err, request, context))
}

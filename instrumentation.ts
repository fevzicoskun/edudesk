// Sentry instrumentation - temporarily disabled for build fix
// TODO: Re-enable after resolving build issue

// export async function register() {
//   if (process.env.NEXT_RUNTIME === 'nodejs') {
//     await import('./sentry.server.config')
//   }
//   if (process.env.NEXT_RUNTIME === 'edge') {
//     await import('./sentry.edge.config')
//   }
// }

// export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
//   const { captureRequestError } = await import('@sentry/nextjs')
//   captureRequestError(err, request, context)
// }
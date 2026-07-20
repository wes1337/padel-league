import * as Sentry from '@sentry/react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  // Only report from production builds — keeps local dev / HMR errors out of Sentry
  // (and out of your inbox). import.meta.env.PROD is true only in `vite build` output.
  if (!dsn || !import.meta.env.PROD) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
  })
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  // In dev (or with no DSN) just log locally — don't ship it to Sentry.
  if (!import.meta.env.VITE_SENTRY_DSN || !import.meta.env.PROD) {
    console.error('[error]', error, context)
    return
  }
  Sentry.captureException(error, { extra: context })
}

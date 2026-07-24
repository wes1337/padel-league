import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { initSentry, reportError } from './lib/sentry'

initSentry()

// When a new service worker takes control, reload to serve fresh assets
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportError(error, { queryKey: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => reportError(error, { mutationKey: mutation.options.mutationKey }),
  }),
  defaultOptions: {
    queries: {
      // Short stale window so returning to the app (tab focus / navigation) pulls
      // fresh data instead of showing a 10-minute-old snapshot. Cached data still
      // renders instantly first, then refetches in the background. Live screens
      // (session, league home) also subscribe to realtime for sub-second updates.
      staleTime: 20 * 1000,
      gcTime: 30 * 60 * 1000,     // keep unused cache 30 min — navigating back is always instant
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

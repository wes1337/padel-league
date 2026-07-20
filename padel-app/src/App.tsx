import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'

const Landing = lazy(() => import('./pages/Landing'))
const LeagueHome = lazy(() => import('./pages/LeagueHome'))
const SessionPage = lazy(() => import('./pages/SessionPage'))
const SessionRedirect = lazy(() => import('./pages/SessionRedirect'))
const AddMatch = lazy(() => import('./pages/AddMatch'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const CardPreview = lazy(() => import('./pages/CardPreview'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const StartingLineup = lazy(() => import('./pages/StartingLineup'))

// Preload the most-visited page chunks so they're ready before navigation
import('./pages/LeagueHome')
import('./pages/SessionPage')
import('./pages/AddMatch')

function LoadingFallback() {
  return (
    <div className="flex justify-center items-center min-h-screen" aria-busy="true" aria-live="polite">
      <div className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen px-6">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          We couldn't find that page. Check the link, or head back to pick a league.
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/card-preview" element={<CardPreview />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/s/:shortId" element={<SessionRedirect />} />
              <Route path="/l/:leagueId" element={<LeagueHome />} />
              <Route path="/l/:leagueId/lineup" element={<StartingLineup />} />
              <Route path="/l/:leagueId/session/:sessionId/lineup" element={<StartingLineup />} />
              <Route path="/l/:leagueId/session/:sessionId" element={<SessionPage />} />
              <Route path="/l/:leagueId/session/:sessionId/add-match" element={<AddMatch />} />
              <Route path="/l/:leagueId/player/:playerId" element={<PlayerProfile />} />
              <Route path="/l/:leagueId/session/:sessionId/player/:playerId" element={<PlayerProfile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  )
}

import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const Landing = lazy(() => import('./pages/Landing'))
const LeagueHome = lazy(() => import('./pages/LeagueHome'))
const SessionPage = lazy(() => import('./pages/SessionPage'))
const SessionRedirect = lazy(() => import('./pages/SessionRedirect'))
const AddMatch = lazy(() => import('./pages/AddMatch'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const CardPreview = lazy(() => import('./pages/CardPreview'))

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen text-gray-500">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/card-preview" element={<CardPreview />} />
            <Route path="/s/:shortId" element={<SessionRedirect />} />
            <Route path="/l/:leagueId" element={<LeagueHome />} />
            <Route path="/l/:leagueId/session/:sessionId" element={<SessionPage />} />
            <Route path="/l/:leagueId/session/:sessionId/add-match" element={<AddMatch />} />
            <Route path="/l/:leagueId/player/:playerId" element={<PlayerProfile />} />
            <Route path="/l/:leagueId/session/:sessionId/player/:playerId" element={<PlayerProfile />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

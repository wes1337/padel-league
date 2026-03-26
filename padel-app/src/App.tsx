import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import LeagueHome from './pages/LeagueHome'
import SessionPage from './pages/SessionPage'
import SessionRedirect from './pages/SessionRedirect'
import AddMatch from './pages/AddMatch'
import PlayerProfile from './pages/PlayerProfile'
import CardPreview from './pages/CardPreview'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
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
      </div>
    </BrowserRouter>
  )
}

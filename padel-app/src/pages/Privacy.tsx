import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Privacy() {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← Back to home</Link>

        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-1">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Effective date: [fill in before launch]</p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-5 text-sm text-gray-700 leading-relaxed">
          <p>
            Padello ("we", "the app") is a padel league tracker. This policy explains what data we
            collect, why, and your choices.
          </p>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>League data you enter: league name, scoring format, session dates, match scores, and player display names you type in.</li>
              <li>An anonymous device identifier so your device can be recognised between visits as the admin of leagues you create. We do not collect your email, phone number, or real name.</li>
              <li>Crash and error reports: if the app breaks, we may automatically send the error message and a stack trace to our error-tracking provider. These reports are not linked to you personally.</li>
              <li>Local storage: a list of leagues you recently visited, stored only on your device so you can find them again. Clearing your browser data removes this.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">How we use it</h2>
            <p>
              To show you your leagues, sessions, standings, and stats, and to diagnose crashes and
              improve the app. That's it. No advertising. No profiling. No selling data.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Third parties</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Supabase</strong> hosts the database that stores your league data (supabase.com/privacy).</li>
              <li><strong>Sentry</strong> receives crash reports when enabled (sentry.io/privacy).</li>
              <li><strong>Apple / Google Play</strong>, if you installed Padello from a store, receive installation analytics governed by their own policies.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Who can see your data</h2>
            <p>
              Anyone with a league URL can view that league's sessions, players, and scores. This is by
              design — URLs are meant to be shared with league members. Do not enter sensitive
              information.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Player names you enter</h2>
            <p>
              When you add a player to a league, you are typing their display name. Only add names you
              have permission to use. You are responsible for the information you enter about others.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Data retention</h2>
            <p>
              League data is stored until the league creator (or we) delete it. Crash reports are
              retained by our error-tracking provider per their default retention (typically 30–90 days).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Your rights</h2>
            <p className="mb-2">
              You can delete a league you created at any time from within the app, which removes its
              sessions, matches, and player records. To request deletion of data you do not control
              directly, email us at <strong>[your email here]</strong>.
            </p>
            <p className="mb-2">
              <strong>EU / UK:</strong> under GDPR you have the right to access, correct, and erase your
              personal data. Our legal basis is your consent (using the app) and our legitimate interest
              in running the service.
            </p>
            <p>
              <strong>California:</strong> we do not sell personal information.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Children</h2>
            <p>
              Padello is not directed to children under 13 and we do not knowingly collect data from
              them.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Security</h2>
            <p>
              We use reasonable technical measures to protect your data, but no online service is 100%
              secure. Be mindful of what you share in league and player names.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Changes</h2>
            <p>
              We may update this policy. The "Effective date" at the top will change when we do.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Contact</h2>
            <p>
              Questions? Email <strong>[your email here]</strong>.
            </p>
          </section>
        </div>

        <div className="text-center mt-6">
          <Link to="/terms" className="text-sm text-gray-500 hover:text-gray-700">Terms of Service →</Link>
        </div>
      </div>
    </div>
  )
}

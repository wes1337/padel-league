import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Terms() {
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← Back to home</Link>

        <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-1">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Effective date: [fill in before launch]</p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-5 text-sm text-gray-700 leading-relaxed">
          <p>
            By using Padello you agree to these terms. If you don't agree, don't use the app.
          </p>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">What Padello is</h2>
            <p>
              A free tool for tracking padel leagues, sessions, matches, and stats. It's provided
              "as is" — it may have bugs, outages, or data loss. Don't rely on it as your only record.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Eligibility</h2>
            <p>
              You must be at least 13 years old to use Padello. If you are between 13 and the age of
              majority where you live, you must have permission from a parent or guardian.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Your account</h2>
            <p>
              Padello does not require an email or password. When you create a league, your device is
              remembered as the admin via an anonymous identifier and a recovery code. Keep your
              recovery code safe — we cannot recover it for you.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Your content</h2>
            <p className="mb-2">
              You are responsible for the league names, player names, and scores you enter. You confirm
              that you have the right to enter any personal names you type into the app.
            </p>
            <p className="mb-2">Do not enter:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>anything illegal, hateful, harassing, or infringing someone else's rights</li>
              <li>personal information you were not given permission to share</li>
              <li>anything you wouldn't want other league members to see</li>
            </ul>
            <p className="mt-2">
              We may remove content or leagues that violate these terms without notice.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Acceptable use</h2>
            <p>
              Don't try to break, overload, reverse-engineer, or abuse the service. Don't scrape or bulk
              download data. Don't impersonate other users or league members.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">No warranty</h2>
            <p>
              Padello is provided "as is" and "as available", with no warranties of any kind — express or
              implied. We do not guarantee accuracy, uptime, or fitness for a particular purpose. Use it
              for fun, not for anything where errors matter.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Limitation of liability</h2>
            <p>
              To the fullest extent allowed by law, Padello and its operator are not liable for any
              indirect, incidental, or consequential damages, loss of data, or loss of
              rankings/leaderboards. Our total liability to you is limited to the amount you paid us to
              use Padello — which is zero.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Termination</h2>
            <p>
              You may stop using Padello at any time. We may suspend or terminate access if you violate
              these terms or if we discontinue the service.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Changes</h2>
            <p>
              We may update these terms. Continued use after changes means you accept them. The
              "Effective date" will update when we do.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 text-base mb-2">Governing law</h2>
            <p>
              These terms are governed by the laws of <strong>[your country / state]</strong>. Any
              disputes must be brought in the courts of that jurisdiction.
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
          <Link to="/privacy" className="text-sm text-gray-500 hover:text-gray-700">← Privacy Policy</Link>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SessionRedirect() {
  const { shortId } = useParams<{ shortId: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!shortId) return
    supabase
      .from('sessions')
      .select('id, league_id')
      .eq('short_id', shortId)
      .single()
      .then(({ data }) => {
        if (data) {
          navigate(`/l/${data.league_id}/session/${data.id}`, { replace: true })
        } else {
          setError(true)
        }
      })
  }, [shortId, navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 mb-1">Session not found</p>
          <p className="text-sm">This link may have expired or is invalid.</p>
        </div>
      </div>
    )
  }

  return <div className="flex justify-center items-center min-h-screen text-gray-500">Loading...</div>
}

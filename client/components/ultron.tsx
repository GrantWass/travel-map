'use client'
import { useEffect } from 'react'
import { initTracker } from '@ultron-dev/tracker'

export function Ultron() {
  useEffect(() => {
    initTracker({
      apiKey: process.env.NEXT_PUBLIC_ULTRON_API_KEY!,
      debug: process.env.NODE_ENV === 'development',
      // The tracker currently lets rrweb custom-event failures escape its
      // fetch wrapper, which can reject otherwise successful API requests.
      sessionReplay: false
    })
  }, [])
  return null
}

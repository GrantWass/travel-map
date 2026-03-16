// components/ultron.tsx
'use client'

import { useEffect } from 'react'
import { initTracker } from '@ultron-dev/tracker'

export function Ultron() {
  useEffect(() => {
    initTracker({
      apiKey: process.env.NEXT_PUBLIC_ULTRON_API_KEY!,
      endpoint: process.env.NEXT_PUBLIC_ULTRON_ENDPOINT!,
      slowRequestThreshold: 3000, // flag requests slower than 3s
      reportAllVitals: false,     // only report poor/needs-improvement vitals
      debug: process.env.NODE_ENV === 'development', // logs to console in dev
    })
  }, [])

  return null
}

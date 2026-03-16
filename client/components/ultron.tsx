'use client'
import { useEffect } from 'react'
import { initTracker } from '@ultron-dev/tracker'

export function Ultron() {
  useEffect(() => {
    initTracker({
      apiKey: process.env.NEXT_PUBLIC_ULTRON_API_KEY!,
      endpoint: process.env.NEXT_PUBLIC_ULTRON_ENDPOINT!,
      debug: process.env.NODE_ENV === 'development',
    })
  }, [])
  return null
}
# Google Places Setup

How place search works in this app, and how to enable (or disable) Google
Places autocomplete.

## How it works

```
PlacePicker (client)
  └─ GET /api/places?q=...&session_token=...
       ├─ 1. Google Autocomplete (New)   ← if GOOGLE_PLACES_API_KEY is set & healthy
       └─ 2. Nominatim (OpenStreetMap)    ← automatic fallback on ANY failure
  └─ GET /api/places/details?place_id=...   ← only when a suggestion is selected
       └─ Google Place Details (Essentials) → lat/lng
```

Key properties:

- **No key configured** → pure Nominatim, exactly as before. Zero risk.
- **Any Google failure** (quota exhausted, billing error, timeout, outage) is
  silently swallowed and Nominatim serves the request. Users never see an error.
- **Circuit breaker**: the first quota/billing rejection (HTTP 429/403/5xx)
  disables Google until midnight server-time. After that all searches go to
  Nominatim for the rest of the day, so overage charges are structurally
  impossible.
- **Session tokens**: each picker instance generates a UUID session token that
  bundles all autocomplete keystrokes with the final details call. Google bills
  this as one session — keystrokes are free.
- Coordinates are resolved **only when a user actually picks a suggestion**
  (one Essentials-tier details call per selection), never per keystroke.

## Cost profile (2026 pricing)

| Call | SKU | Free tier | Then |
|---|---|---|---|
| Autocomplete keystrokes | Session Usage | Unlimited (in-session) | $0 |
| Selection → coordinates | Place Details Essentials | 10,000/month | ~$5 / 1,000 |

For typical traffic this stays at $0. The old flat $200/month Google credit no
longer exists — free allowances are per-SKU.

## Setup steps

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create (or select) a project.
2. Enable **billing** on the project — a card is required even for free-tier
   usage.
3. **APIs & Services → Library** → enable **"Places API (New)"**.
   Make sure it's the *New* API, not the legacy "Places API".
4. **APIs & Services → Credentials** → **Create credentials → API key**.
5. Recommended: restrict the key via **API restrictions** to
   "Places API (New)" only.
6. Recommended: set a hard daily cap under
   **APIs & Services → Quotas** → "Places API (New) → Autocomplete Requests"
   (e.g. 1,000/day). Combined with the circuit breaker, this makes it
   impossible to exceed free-tier levels.
7. Set the environment variable wherever the Next.js client is deployed:

   ```
   GOOGLE_PLACES_API_KEY=your-key-here
   ```

   - Vercel: Project Settings → Environment Variables
   - **Never prefix with `NEXT_PUBLIC_`** — the key is used server-side only
     and must not reach the browser bundle.
8. Redeploy / restart the client server.

## Verifying it works

1. Search a place in the app — suggestions should appear as usual.
2. Check **Cloud Console → APIs & Services → Metrics**: you should see
   Autocomplete requests logging against your key.
3. Test the fallback: break the key (or disable the API) and redeploy.
   Searches must still work via Nominatim. Note that after a failure the
   circuit breaker may keep Google off until midnight even if you fix the key —
   restart the server to clear it immediately.

## Disabling Google

Remove `GOOGLE_PLACES_API_KEY` from the environment and redeploy. Everything
falls back to Nominatim; no code changes needed.

## Relevant code

| File | Purpose |
|---|---|
| `client/app/api/places/route.ts` | Provider chain: Google autocomplete → Nominatim fallback, circuit breaker |
| `client/app/api/places/details/route.ts` | Resolves a selected place ID to coordinates |
| `client/components/place-picker.tsx` | Session token generation, suggestion selection flow |

/**
 * Best-effort parsing of flight details from a pasted URL, focused on
 * Google Flights links. Google Flights is a JS app with no useful OG tags,
 * so we parse what the URL itself encodes and fall back to generic unfurling.
 */

export interface ParsedFlightLink {
  origin_code?: string;
  destination_code?: string;
  departure_date?: string; // ISO YYYY-MM-DD when found
  airline?: string;
  flight_number?: string;
}

function titleCaseAirline(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Extracts "Flights from SFO to NRT on 2026-09-12" style search queries. */
function parseGoogleFlightsQuery(query: string | null): ParsedFlightLink | null {
  if (!query) return null;
  const decoded = query.trim();
  if (!/^flights?\b/i.test(decoded)) return null;

  const result: ParsedFlightLink = {};
  const routeMatch = /from\s+([A-Za-z]{3})\s+to\s+([A-Za-z]{3})/i.exec(decoded);
  if (routeMatch) {
    result.origin_code = routeMatch[1].toUpperCase();
    result.destination_code = routeMatch[2].toUpperCase();
  }
  const dateMatch = /\b(\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2})\b/.exec(decoded);
  if (dateMatch) {
    result.departure_date = dateMatch[1].split("/")[0];
  }
  return Object.keys(result).length > 0 ? result : null;
}

const AIRLINE_CODE_TO_NAME: Record<string, string> = {
  AA: "American Airlines",
  AC: "Air Canada",
  AF: "Air France",
  BA: "British Airways",
  B6: "JetBlue",
  DL: "Delta",
  EK: "Emirates",
  HA: "Hawaiian Airlines",
  JL: "Japan Airlines",
  KE: "Korean Air",
  KL: "KLM",
  LH: "Lufthansa",
  NK: "Spirit",
  QF: "Qantas",
  SY: "Sun Country",
  TK: "Turkish Airlines",
  UA: "United",
  WN: "Southwest",
  WS: "WestJet",
};

/**
 * Attempts to decode Google Flights' `tfs` base64url parameter. It contains a
 * protobuf where airport codes appear as 3 uppercase letters — extract pairs.
 */
function parseTfsParam(tfs: string): ParsedFlightLink | null {
  let text: string;
  try {
    const base64 = tfs.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    text = binary;
  } catch {
    return null;
  }

  // Airport codes appear as length-prefixed strings in the protobuf; grabbing
  // all 3-letter uppercase runs and taking the first two as route endpoints
  // works for simple one-way/round-trip searches.
  const codes: string[] = [];
  const seen = new Set<string>();
  const re = /[A-Z]{3}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const code = match[0];
    // Filter out common protobuf noise tokens that happen to be 3 caps.
    if (["USD", "EUR", "GBP", "CAD", "JPY", "AUD", "PRO", "GAE", "ENG"].includes(code)) continue;
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
    if (codes.length >= 2) break;
  }

  if (codes.length < 2) return null;
  return { origin_code: codes[0], destination_code: codes[1] };
}

/**
 * Parses any flight-related URL. Returns whatever could be extracted — an
 * empty object means nothing useful was found in the URL itself.
 */
export function parseFlightLink(rawUrl: string): ParsedFlightLink {
  const trimmed = rawUrl.trim();
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return {};
  }

  const host = url.hostname.replace(/^www\./, "");
  const result: ParsedFlightLink = {};

  if (host === "google.com" || host.endsWith(".google.com")) {
    if (url.pathname.startsWith("/travel/flights")) {
      Object.assign(result, parseGoogleFlightsQuery(url.searchParams.get("q")) ?? {});
      if (!result.origin_code) {
        const tfs = url.searchParams.get("tfs");
        if (tfs) Object.assign(result, parseTfsParam(tfs) ?? {});
      }
    }
  } else if (/\.ao|\.air|airlines?|airway|air\./i.test(host)) {
    // e.g. united.com, delta.air, alaskaair.com — use hostname as airline hint
    const name = host.split(".")[0];
    if (name.length > 2) result.airline = titleCaseAirline(name);
  }

  // Flight-number pattern anywhere in the path/query (e.g. UA1234). Carrier
  // must be two letters so dates/times don't produce false positives.
  const NON_CARRIER_WORDS = new Set([
    "ON", "TO", "IN", "AT", "OF", "BY", "AN", "AS", "OR", "IS", "IT", "NO",
    "US", "UK", "EN", "ES", "FR", "DE", "FL", "CA", "NY",
  ]);
  const flightNumberMatch = /\b([A-Z]{2})\s?(\d{3,4})\b/.exec(
    decodeURIComponent(`${url.pathname}${url.search}`).toUpperCase().replace(/[^A-Z0-9]+/g, " "),
  );
  if (
    flightNumberMatch &&
    !NON_CARRIER_WORDS.has(flightNumberMatch[1]) &&
    !/^(19|20)\d{2}$/.test(flightNumberMatch[2]) // bare years aren't flight numbers
  ) {
    const carrier = flightNumberMatch[1].toUpperCase();
    result.flight_number = `${carrier}${flightNumberMatch[2]}`;
    if (!result.airline) result.airline = AIRLINE_CODE_TO_NAME[carrier];
  }

  return result;
}

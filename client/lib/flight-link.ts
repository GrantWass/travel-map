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
  return_date?: string;
  return_flight_numbers?: string;
  price?: string;
  currency?: string;
  outbound_legs?: ParsedFlightLeg[];
  return_legs?: ParsedFlightLeg[];
  notes?: string;
}

export interface ParsedFlightLeg {
  airline_code?: string;
  flight_number?: string;
  origin_code: string;
  destination_code: string;
  departure_date: string;
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

interface TfsSegment {
  origin: string;
  date: string;
  destination: string;
  flight?: string; // e.g. "AA2531"
}

/**
 * Attempts to decode Google Flights' `tfs` base64url parameter. It contains a
 * protobuf where each flight leg appears as length-prefixed ASCII:
 *   0x0a 0x03 ORIGIN, 0x12 0x0a DATE, 0x1a 0x03 DEST, 0x2a 0x02 AIRLINE, number.
 */
function parseTfsParam(tfs: string): ParsedFlightLink | null {
  let text: string;
  try {
    const base64 = tfs.replace(/-/g, "+").replace(/_/g, "/");
    text = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  } catch {
    return null;
  }

  const segments: TfsSegment[] = [];
  // The flight number is length-prefixed, so read it manually — a greedy \d+
  // would swallow the next protobuf tag byte (0x32 = "2") into the number.
  const segRe =
    /\n\x03([A-Z]{3})\x12\n(\d{4}-\d{2}-\d{2})\x1a\x03([A-Z]{3})(?:\*\x02([A-Z]{2}))?/g;
  let match: RegExpExecArray | null;
  while ((match = segRe.exec(text)) !== null) {
    let flight: string | undefined;
    if (match[4]) {
      const pos = segRe.lastIndex;
      if (text[pos] === "2") {
        const len = text.charCodeAt(pos + 1);
        const digits = text.slice(pos + 2, pos + 2 + len);
        if (len >= 1 && len <= 4 && /^\d+$/.test(digits)) {
          flight = `${match[4]}${digits}`;
          segRe.lastIndex = pos + 2 + len;
        }
      }
    }
    segments.push({
      origin: match[1],
      date: match[2],
      destination: match[3],
      ...(flight ? { flight } : {}),
    });
  }

  if (segments.length === 0) return null;

  // Connecting legs depart from the previous leg's arrival airport; reconcile
  // mismatches (the tfs payload sometimes contains a corrupted code).
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i].destination !== segments[i + 1].origin) {
      segments[i].destination = segments[i + 1].origin;
    }
  }

  const first = segments[0];
  let returnStart = -1;
  if (segments.length > 1 && segments.at(-1)?.destination === first.origin) {
    let largestGap = 0;
    for (let index = 1; index < segments.length; index++) {
      const previousDate = Date.parse(`${segments[index - 1].date}T00:00:00Z`);
      const currentDate = Date.parse(`${segments[index].date}T00:00:00Z`);
      const gap = currentDate - previousDate;
      if (gap > largestGap) {
        largestGap = gap;
        returnStart = index;
      }
    }
  }
  const outboundSegments = returnStart > 0 ? segments.slice(0, returnStart) : segments;
  const returnSegments = returnStart > 0 ? segments.slice(returnStart) : [];
  const result: ParsedFlightLink = {
    origin_code: first.origin,
    destination_code: outboundSegments.at(-1)?.destination ?? first.destination,
    departure_date: first.date,
  };
  const outboundFlightNumbers = outboundSegments.map((segment) => segment.flight).filter(Boolean) as string[];
  if (outboundFlightNumbers.length > 0) {
    const carrierMatch = /^([A-Z]{2})/.exec(outboundFlightNumbers[0]);
    result.flight_number = outboundFlightNumbers.join(" / ");
    if (carrierMatch) result.airline = AIRLINE_CODE_TO_NAME[carrierMatch[1]];
  }

  if (returnSegments.length > 0) {
    result.return_date = returnSegments[0].date;
    result.return_flight_numbers = returnSegments.map((segment) => segment.flight).filter(Boolean).join(" / ");
  }
  const toLeg = (segment: TfsSegment): ParsedFlightLeg => ({
    origin_code: segment.origin,
    destination_code: segment.destination,
    departure_date: segment.date,
    ...(segment.flight ? {
      flight_number: segment.flight,
      airline_code: segment.flight.slice(0, 2),
    } : {}),
  });
  result.outbound_legs = outboundSegments.map(toLeg);
  result.return_legs = returnSegments.map(toLeg);

  // Multi-leg itineraries don't fit the single route fields — summarize them.
  if (segments.length > 1) {
    const summarize = (items: TfsSegment[]) => items
      .map((segment) => `${segment.flight ? `${segment.flight} ` : ""}${segment.origin}→${segment.destination} (${segment.date})`)
      .join(" · ");
    result.notes = returnSegments.length > 0
      ? `Outbound: ${summarize(outboundSegments)}\nReturn: ${summarize(returnSegments)}`
      : summarize(outboundSegments);
  }
  return result;
}

function parseGoogleFare(tfu: string): Pick<ParsedFlightLink, "price" | "currency"> | null {
  try {
    const decode = (value: string) => atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4));
    const outer = decode(tfu);
    const embedded = outer.charCodeAt(0) === 0x0a && outer.length > 2
      ? outer.slice(2, 2 + outer.charCodeAt(1))
      : outer.match(/[A-Za-z0-9+/]{40,}={0,2}/)?.[0];
    if (!embedded) return null;
    const bytes = Uint8Array.from(decode(embedded), (character) => character.charCodeAt(0));
    let currencyIndex = -1;
    for (let index = 0; index <= bytes.length - 5; index++) {
      if (bytes[index] === 0x1a && bytes[index + 1] === 0x03
          && bytes[index + 2] >= 65 && bytes[index + 2] <= 90
          && bytes[index + 3] >= 65 && bytes[index + 3] <= 90
          && bytes[index + 4] >= 65 && bytes[index + 4] <= 90) {
        currencyIndex = index + 2;
      }
    }
    if (currencyIndex < 1) return null;
    const currency = String.fromCharCode(...bytes.slice(currencyIndex, currencyIndex + 3));

    let marker = -1;
    for (let index = currencyIndex - 1; index >= Math.max(0, currencyIndex - 16); index--) {
      if (bytes[index] === 0x08) { marker = index; break; }
    }
    if (marker < 0) return null;

    let cents = 0;
    let shift = 0;
    for (let index = marker + 1; index < bytes.length && shift < 35; index++) {
      cents |= (bytes[index] & 0x7f) << shift;
      if ((bytes[index] & 0x80) === 0) break;
      shift += 7;
    }
    if (cents <= 0) return null;
    return {
      price: Number.isInteger(cents / 100) ? String(cents / 100) : (cents / 100).toFixed(2),
      currency,
    };
  } catch {
    return null;
  }
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
      const tfu = url.searchParams.get("tfu");
      if (tfu) Object.assign(result, parseGoogleFare(tfu) ?? {});
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

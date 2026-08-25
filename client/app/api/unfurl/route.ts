import { NextResponse } from "next/server";

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 600_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; TravelaBot/1.0; +link preview fetcher)";

function extractMetaTag(html: string, property: string): string | null {
  // Matches <meta property|name="..." content="..."> in either attribute order.
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1].trim());
    }
  }
  return null;
}

function extractTitleTag(html: string): string | null {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim();

  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "only http(s) urls are supported" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      // Not a fetchable page — return an empty preview rather than an error
      // so the user can still keep their link.
      return NextResponse.json({});
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return NextResponse.json({});
    }

    const reader = response.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      while (html.length < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
      }
      await reader.cancel();
    } else {
      html = (await response.text()).slice(0, MAX_HTML_BYTES);
    }

    const title =
      extractMetaTag(html, "og:title") ??
      extractMetaTag(html, "twitter:title") ??
      extractTitleTag(html);
    const description =
      extractMetaTag(html, "og:description") ??
      extractMetaTag(html, "description") ??
      extractMetaTag(html, "twitter:description");
    const rawImage =
      extractMetaTag(html, "og:image") ?? extractMetaTag(html, "twitter:image");

    let image: string | null = null;
    if (rawImage) {
      try {
        image = new URL(rawImage, parsedUrl.toString()).toString();
      } catch {
        image = null;
      }
    }

    return NextResponse.json(
      {
        title: title || null,
        description: description || null,
        image: image || null,
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({}, { status: 200 });
  } finally {
    clearTimeout(timeoutId);
  }
}

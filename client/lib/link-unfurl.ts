export interface LinkPreview {
  title: string | null;
  description: string | null;
  image: string | null;
}

/**
 * Fetches Open Graph metadata for a URL via the /api/unfurl proxy.
 * Returns null when the page can't be fetched or has no useful metadata.
 */
export async function unfurlLink(rawUrl: string): Promise<LinkPreview | null> {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    new URL(normalized);
  } catch {
    return null;
  }

  try {
    const response = await fetch(`/api/unfurl?url=${encodeURIComponent(normalized)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<LinkPreview>;
    if (!data.title && !data.description && !data.image) return null;
    return {
      title: data.title ?? null,
      description: data.description ?? null,
      image: data.image ?? null,
    };
  } catch {
    return null;
  }
}

/** True when the string looks like a bare URL pasted into a text field. */
export function looksLikeLink(value: string): boolean {
  const trimmed = value.trim();
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+\S*$/i.test(trimmed) && /\./.test(trimmed);
}

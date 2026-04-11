import { resolveFacebookGraphAccessToken } from './facebookAccessToken';

/**
 * Normalize pasted URLs: add https:// when missing (e.g. tiktok.com/... from mobile share),
 * strip invisible RTL / zero-width chars (common in Hebrew UI pastes),
 * and strip trailing punctuation from copy/paste.
 */
export function normalizeImportUrl(raw: string): string {
  let s = raw
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u202A-\u202E\u200E\u200F]/g, '');
  if (!s) return s;
  while (/[.)\]>]+\s*$/.test(s)) {
    s = s.replace(/[.)\]>]+\s*$/, '').trimEnd();
  }
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s.replace(/^\/+/, '')}`;
  }
  return s;
}

export type SocialEmbedMeta = {
  title?: string;
  authorName?: string;
  thumbnailUrl?: string;
  providerHtml?: string;
};

const OEMBED_FETCH_MS = 20_000;

function oembedFetch(url: string) {
  return fetch(url, {
    headers: { 'User-Agent': 'RecipeAI/1.0 (recipe import)' },
    signal: AbortSignal.timeout(OEMBED_FETCH_MS),
  });
}

function isTikTokHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'www.tiktok.com' || h === 'tiktok.com' || h === 'vm.tiktok.com';
}

function isInstagramHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'www.instagram.com' || h === 'instagram.com';
}

export async function fetchTikTokOembed(pageUrl: string): Promise<SocialEmbedMeta | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(pageUrl)}`;
    const res = await oembedFetch(oembedUrl);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      title: typeof data.title === 'string' ? data.title : undefined,
      authorName: typeof data.author_name === 'string' ? data.author_name : undefined,
      thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : undefined,
      providerHtml: typeof data.html === 'string' ? data.html : undefined,
    };
  } catch {
    return null;
  }
}

/** Meta Graph oEmbed; returns 400 without a valid `access_token` for most callers. */
export async function fetchInstagramOembed(pageUrl: string): Promise<SocialEmbedMeta | null> {
  try {
    const token = resolveFacebookGraphAccessToken();
    const base = `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(pageUrl)}`;
    const oembedUrl = token ? `${base}&access_token=${encodeURIComponent(token)}` : base;
    const res = await oembedFetch(oembedUrl);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      title: typeof data.title === 'string' ? data.title : undefined,
      authorName: typeof data.author_name === 'string' ? data.author_name : undefined,
      thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : undefined,
      providerHtml: typeof data.html === 'string' ? data.html : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchSocialEmbedForUrl(normalizedUrl: string): Promise<SocialEmbedMeta | null> {
  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname;
  if (isTikTokHost(host)) {
    return fetchTikTokOembed(normalizedUrl);
  }
  if (isInstagramHost(host)) {
    return fetchInstagramOembed(normalizedUrl);
  }
  return null;
}

/**
 * Build LLM user message from scraped page text + optional oEmbed metadata.
 * When scraping yields nothing, still returns a URL-grounded prompt for web-capable models.
 */
export function buildImportUrlUserContent(
  normalizedUrl: string,
  pageText: string,
  embed: SocialEmbedMeta | null
): string {
  const trimmedPage = pageText.replace(/\s+/g, ' ').trim();
  const parts: string[] = [];

  if (embed?.title) parts.push(`Video/post title: ${embed.title}`);
  if (embed?.authorName) parts.push(`Author: ${embed.authorName}`);
  if (embed?.thumbnailUrl) {
    parts.push(
      `Thumbnail image URL (include as "imageUrl" in JSON if it shows the dish): ${embed.thumbnailUrl}`
    );
  }
  if (embed?.providerHtml) {
    const stripped = embed.providerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (stripped) parts.push(`Embed snippet: ${stripped.slice(0, 2000)}`);
  }
  if (trimmedPage) {
    parts.push(`Page text content:\n${trimmedPage.slice(0, 50000)}`);
  }
  if (parts.length === 0) {
    parts.push(
      `Extract a complete home-cooking recipe matching this social or web page. The HTML could not be scraped for text. Use the URL and reliable sources to infer ingredients and steps.\n\nURL: ${normalizedUrl}`
    );
  } else {
    parts.push(`Source URL: ${normalizedUrl}`);
  }

  return parts.join('\n\n');
}

/** oEmbed title is usually the post caption when Graph returns data. */
export function hasRichOembedCaption(embed: SocialEmbedMeta | null): boolean {
  const t = embed?.title?.trim() ?? '';
  if (t.length < 18) return false;
  if (/^(instagram|photo|video|reels)$/i.test(t)) return false;
  return true;
}

/**
 * HTML fetch of instagram.com often returns the login/marketing shell, not the caption.
 */
export function looksLikeInstagramUnscrapablePage(pageText: string): boolean {
  const t = pageText.replace(/\s+/g, ' ').trim();
  if (t.length < 120) return true;
  const lower = t.slice(0, 8000).toLowerCase();
  const shellMarkers = [
    'log in',
    'sign up',
    'log in to instagram',
    'from meta',
    'privacy policy',
    'terms of use',
    'cookie policy',
    'help center',
  ];
  if (shellMarkers.filter((m) => lower.includes(m)).length >= 3) return true;
  const igHits = (lower.match(/instagram/g) ?? []).length;
  if (igHits > 10 && t.length < 4000) return true;
  return false;
}

/**
 * True when we should not ask the LLM to "fill in" an Instagram recipe (avoids hallucinated Hebrew, etc.).
 */
export function isInstagramUrlImportInsufficient(
  normalizedUrl: string,
  pageText: string,
  embed: SocialEmbedMeta | null
): boolean {
  let host = '';
  try {
    host = new URL(normalizedUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host !== 'www.instagram.com' && host !== 'instagram.com') return false;
  if (hasRichOembedCaption(embed)) return false;
  return looksLikeInstagramUnscrapablePage(pageText);
}

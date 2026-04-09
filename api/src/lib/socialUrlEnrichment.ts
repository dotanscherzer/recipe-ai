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
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'RecipeAI/1.0 (recipe import)' },
    });
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

/** Meta Graph oEmbed; may return 400 without an app token — caller should fall back. */
export async function fetchInstagramOembed(pageUrl: string): Promise<SocialEmbedMeta | null> {
  try {
    const oembedUrl = `https://graph.facebook.com/v12.0/instagram_oembed?url=${encodeURIComponent(pageUrl)}`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'RecipeAI/1.0 (recipe import)' },
    });
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

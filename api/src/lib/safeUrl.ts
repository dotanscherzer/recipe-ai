import { AppError } from '../middleware/errorHandler';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/i,
  /^::1$/i,
];

/**
 * Allow only HTTPS URLs with a host that is not obviously private/link-local.
 * Does not resolve DNS (hostnames could still point to private IPs).
 */
export function assertSafeHttpsUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError(400, 'Invalid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new AppError(400, 'Only HTTPS URLs are allowed');
  }
  const host = parsed.hostname;
  if (!host) {
    throw new AppError(400, 'Invalid URL');
  }
  for (const re of PRIVATE_HOST_PATTERNS) {
    if (re.test(host)) {
      throw new AppError(400, 'URL host is not allowed');
    }
  }
  return parsed;
}

const MAX_FETCH_BYTES = 2_000_000;

export async function fetchTextFromSafeUrl(url: string): Promise<string> {
  assertSafeHttpsUrl(url);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'RecipeAI/1.0 (recipe import)' },
  });
  if (!response.ok) {
    throw new AppError(400, 'Failed to fetch the provided URL');
  }
  const len = response.headers.get('content-length');
  if (len && parseInt(len, 10) > MAX_FETCH_BYTES) {
    throw new AppError(400, 'Response is too large');
  }
  const buf = await response.arrayBuffer();
  if (buf.byteLength > MAX_FETCH_BYTES) {
    throw new AppError(400, 'Response is too large');
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  return text;
}

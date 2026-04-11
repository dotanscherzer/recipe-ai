/** Match API `normalizeImportUrl` — https scheme, strip invisible chars, trim trailing punctuation. */
export function normalizeImportUrl(raw: string): string {
  let s = raw
    .trim()
    .replace(/[\u200B-\u200D\uFEFF\u202A-\u202E\u200E\u200F]/g, '');
  if (!s) return s;
  /** RTL / mobile pastes often prefix `/` before `https://`, which would otherwise become `https://https://...`. */
  s = s.replace(/^\/+/, '');
  while (/[.)\]>]+\s*$/.test(s)) {
    s = s.replace(/[.)\]>]+\s*$/, '').trimEnd();
  }
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  s = s.replace(/^https:\/\/https:\/\//i, 'https://');
  return s;
}

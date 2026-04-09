/** Builds absolute URL to start OAuth on the API (handles relative VITE_API_URL like `/api`). */
export function getOAuthStartUrl(provider: 'google' | 'apple'): string {
  const base = import.meta.env.VITE_API_URL || '/api';
  const path = `/auth/${provider}`;
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return `${base.replace(/\/$/, '')}${path}`;
  }
  const prefix = base.startsWith('/') ? base : `/${base}`;
  return `${window.location.origin}${prefix.replace(/\/$/, '')}${path}`;
}

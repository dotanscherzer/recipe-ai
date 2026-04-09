# OAuth setup (Google & Apple)

The API exposes:

- `GET /auth/providers` — returns `{ google, apple }` booleans (whether each provider is configured).
- `GET /auth/google` — starts Google OAuth (redirect).
- `GET /auth/google/callback` — Google redirect URI (must match Google Cloud Console exactly).
- `GET /auth/apple` — starts Sign in with Apple (redirect).
- `GET /auth/apple/callback` — Apple return URL (must match Apple Developer configuration exactly).
- `POST /auth/oauth/exchange` — body `{ "code": "<one-time code>" }` returns `{ accessToken, refreshToken }` after browser lands on the SPA with `?code=`.

## Environment variables

Set in the API process (e.g. `.env`):

| Variable | Purpose |
|----------|---------|
| `API_URL` | Public base URL of this API **without trailing slash**, e.g. `https://api.example.com` or `http://localhost:3001`. Used to build OAuth `redirect_uri` values. |
| `APP_URL` | Public base URL of the web app **without trailing slash**, e.g. `https://app.example.com` or `http://localhost:5173`. Used to redirect users to `/oauth-callback` after login. |
| `REDIS_URL` | Required for OAuth `state` and one-time exchange codes. |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret. |
| `APPLE_CLIENT_ID` | Apple Services ID (Sign in with Apple). |
| `APPLE_TEAM_ID` | Apple Developer Team ID. |
| `APPLE_KEY_ID` | Key ID for the Sign in with Apple private key. |
| `APPLE_PRIVATE_KEY_PATH` | Absolute or relative path to the `.p8` key file. |

## Redirect URIs to register

Use the same host/port as `API_URL` (not the Vite dev server port unless you proxy the API under that origin).

**Google Cloud Console** (OAuth 2.0 Client → Authorized redirect URIs):

```text
{API_URL}/auth/google/callback
```

Example (local API):

```text
http://localhost:3001/auth/google/callback
```

**Apple Developer** (Services ID → Sign in with Apple → Return URLs):

```text
{API_URL}/auth/apple/callback
```

Example (local API):

```text
http://localhost:3001/auth/apple/callback
```

## Web app (`VITE_API_URL`)

- **Development (Vite):** default `VITE_API_URL=/api` proxies to the API; OAuth start URLs become `http://localhost:5173/api/auth/google` (and Apple similarly). **Google/Apple still redirect the browser to the callback on `API_URL`**, so `API_URL` must match the redirect URI you registered (e.g. `http://localhost:3001`).
- **Production:** set `VITE_API_URL` to the same API origin the browser uses (e.g. `https://your-domain.com/api` if nginx mounts the API at `/api`).

If `API_URL` and the registered redirect URIs differ by even a trailing slash or port, OAuth will fail with `redirect_uri_mismatch` or Apple token errors.

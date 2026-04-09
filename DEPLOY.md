# Production deploy

Pushes to `master` trigger [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which SSHs into your server and runs `git pull` + `docker compose build/up` for `api` and `web`.

## One-time: GitHub repository secrets

In the repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Example |
|--------|---------|
| `DEPLOY_HOST` | Your VPS hostname or IP |
| `DEPLOY_USER` | `root` or deploy user |
| `DEPLOY_SSH_KEY` | Private key (PEM) that can SSH as `DEPLOY_USER`; paste full `-----BEGIN ... OPENSSH PRIVATE KEY-----` block |
| `DEPLOY_PATH` | Absolute path to the clone on the server, e.g. `/opt/recipe-ai` |

## One-time: server

1. Clone this repo and add `.env` (see `api/.env.example` and compose).
2. Ensure `docker` and `docker compose` work.
3. If the repo is **private**, use a deploy key or HTTPS token on the server so `git fetch` works.

After secrets are set, push to `master` or run **Actions → Deploy → Run workflow**.

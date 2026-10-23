# Clicker — Neon Forge

Static clicker on Netlify (Identity + Functions + Netlify Database).

**Production:** https://clicker-neon-forge.netlify.app  
**Site name:** `clicker-neon-forge`

## Recent UX (leaderboard)

- Expanding the leaders panel **pauses** the game (cube, effects, idle drain, clicks). Collapsing resumes; effect timers are shifted so pause time is not lost.
- While paused, a large translucent **pause** mark sits in the center of the screen above the board (`z-index` over HUD).
- Toggle press no longer uses the old strip/row tap animation. From the click point an orange horizontal **shockwave** (semi-transparent) spreads left and right (`lb-blast` in `css/styles.css`, spawned from `js/leaderboard.js`).

## Deploy (agents / humans)

**Never deploy unless the user explicitly asks** (e.g. «деплоить», «deploy»).

### Prerequisites

Root `.env` (not committed) must contain:

```bash
NETLIFY_AUTH_TOKEN=...
NETLIFY_SITE_ID=...
# optional:
NETLIFY_SITE_NAME=clicker-neon-forge
```

### Command

From the project root:

```bash
node scripts/deploy.mjs
# or
npm run deploy
```

What it does:

1. Runs `scripts/check-local.mjs` (smoke check of required files / local HTTP).
2. `npx netlify-cli deploy --prod --dir=.` with token + site id from `.env`.
3. On Netlify build: `npm ci`, applies SQL under `netlify/database/migrations/`, bundles `netlify/functions/` (`score`, `leaderboard`).

Typical duration: ~1.5–3 minutes. Success ends with `Deploy is live!` and the production URL.

### After deploy

- Hard-refresh the site if CSS/JS look stale (`Cache-Control` is short, but browsers may still cache).
- Function logs: Netlify → project → Functions / Observability.

## Local preview (no deploy)

Static files only (auth/score need Netlify Identity + functions):

```bash
npx --yes serve .
# open the printed localhost URL
```

Or open `index.html` via any static server / Live Preview.

Offline single-file build: `npm run build:offline` → `dist/clicker.html`.

### Demo reel (~60s, for Shorts recording)

Auto-plays main effects on test data (score `1337`, leaders `100/23457`). Ends by opening the leaderboard. Open with query flag:

```bash
npm run demo
# open http://localhost:4173/?demo=1
```

Sequence: baseline → ×2 → ×3 → combo → lottery → split twins → 1–6 order → flying photo → shrink → invert → cover photo → number order again → open leaders.

## Layout agents should know

| Path | Role |
|------|------|
| `index.html`, `css/`, `js/` | Frontend (publish root) |
| `js/score-store.js` | Score sync; JWT in **JSON body** (`accessToken`), auto-refresh via `/.netlify/identity/token` |
| `netlify/functions/score.mjs` | GET/SET score (POST only; `op: "get" \| "set"`) |
| `netlify/functions/leaderboard.mjs` | Public top 100 |
| `netlify/database/migrations/` | Applied on each prod deploy |
| `scripts/deploy.mjs` | Only supported deploy path |

## Auth / score gotchas (do not regress)

- Do **not** send huge Google JWTs in `Cookie` or `Authorization` — Netlify can return platform `Internal Error`. Token goes in the request **body**.
- Use `credentials: "omit"` for `/score` fetches.
- Access JWT ~1h; refresh before sync (`ensureFreshAccessToken` in `score-store.js`).
- Do not mid-slice `avatar_url` (old 500-char cut broke Google photo links). Cap only at a high limit or `null`.

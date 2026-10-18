# ParkFlow
## Structure
- `front_end/` – React + Vite UI (own Vercel project)
- `back_end/` – Express API + MySQL schema on Aiven (own Vercel project). See `back_end/README.md`.

## Deploy on Vercel (two projects from one repo)
Push the repo to GitHub, then import it **twice** in Vercel.

### 1. Backend (deploy this first)
- *Root Directory*: `back_end`
- Environment variables: `DATABASE_URL`, `DB_SSL_CA_PEM`, and (after step 2) `CORS_ORIGIN=<frontend URL>`
- Before the first use, run `npm run db:migrate && npm run db:seed` from `back_end/` on your machine against the Aiven DB,
  and allow `0.0.0.0/0` under Aiven *Allowed IP addresses*.
- Check `https://<backend>.vercel.app/api/health` → `{"status":"ok","database":"connected"}`

### 2. Frontend
- *Root Directory*: `front_end` (Vercel auto-detects Vite; `front_end/.npmrc` handles the peer-dependency flag)
- Environment variable: `VITE_API_URL=https://<backend>.vercel.app` (no trailing slash)
- Deploy, then go back to the backend project, set `CORS_ORIGIN=https://<frontend>.vercel.app` and redeploy it.

`VITE_API_URL` is baked in at build time, so changing it requires a frontend redeploy.

# LL Aesthetics OS — Deployment Runbook (Fly.io)

**Audience:** a developer deploying this app once, on Lindsey's behalf.
**Time:** ~20–30 minutes. **Result:** a private, HIPAA-covered web app on Fly.io.

This is a **Next.js 15 + Prisma + PostgreSQL** app. It has email/password auth on
every page. Lindsey's Fly.io org already has the **Compliance Package (BAA)**
active, so everything below must be deployed **into her org** to stay covered.

---

## 0. What you need
- This code folder (unzipped).
- [`flyctl`](https://fly.io/docs/flyctl/install/) installed.
- Access to **Lindsey's Fly.io organization** (the one with the Compliance
  Package), via a **scoped, revocable deploy token** (recommended for a
  contractor — no account login shared): Lindsey creates it in **Fly dashboard →
  Tokens** (an org deploy token) and sends it to you. Use it with:
  ```bash
  export FLY_API_TOKEN="<the token Lindsey sends you>"
  ```
  Then every `fly ...` command runs against her org. **Lindsey revokes this
  token as soon as deployment is verified.**
- Two values to decide with Lindsey:
  - `SEED_ADMIN_EMAIL` — her owner login (default: `laskolindsey@gmail.com`)
  - `SEED_ADMIN_PASSWORD` — a temporary password she'll change on first login.

> Note: `.env` is intentionally **not** included. All secrets are set via
> `fly secrets` (below). Nothing sensitive is committed.

---

## 0.5 (Optional) Add the real logo
Lindsey will send you her logo as a **PNG**. Save it as **`public/logo.png`** in
this project before you deploy. The app auto-detects it and uses it in the header
and on the login screen — no code change needed. If it's absent, a built-in
stand-in logo is used.

## 1. Log in and pick the org
```bash
fly auth login
fly orgs list          # confirm Lindsey's org is listed; note its slug
```
Set a unique app name (Fly app names are global). Suggested: `ll-aesthetics-os`
— if taken, pick another and use it consistently below.

## 2. Create the app (no deploy yet)
```bash
cd <this-folder>
fly launch --no-deploy --copy-config --name ll-aesthetics-os --region dfw --org <her-org-slug>
```
`--copy-config` uses the included `fly.toml` (region dfw / Dallas, health check
at `/api/health`, release command runs migrations + seed). Decline any prompt to
add a database here — we create it explicitly next.

## 3. Create and attach PostgreSQL
```bash
fly postgres create --name ll-aesthetics-db --region dfw --org <her-org-slug> \
  --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1
fly postgres attach ll-aesthetics-db --app ll-aesthetics-os
```
`attach` sets the `DATABASE_URL` secret on the app automatically. **Do this
before the first deploy** — the release step needs it.

## 4. Set the remaining secrets
```bash
fly secrets set --app ll-aesthetics-os \
  SESSION_SECRET="$(openssl rand -base64 32)" \
  SEED_ADMIN_EMAIL="laskolindsey@gmail.com" \
  SEED_ADMIN_PASSWORD="<temp-password-Lindsey-chooses>"
```

**Optional — Mindbody integration** (only when Lindsey has API access; safe to add
later without a code change). The Site ID is entered in-app on **Integrations**;
these two are secrets:
```bash
fly secrets set --app ll-aesthetics-os \
  MINDBODY_API_KEY="<from Mindbody>" \
  MINDBODY_WEBHOOK_SECRET="<the subscription signing key>"
```
Then in the app: **Integrations → enter Site ID → Turn the connection on.** The
webhook URL to give Mindbody is `https://<app-domain>/api/webhooks/mindbody`.

## 5. Deploy
```bash
fly deploy --app ll-aesthetics-os
```
This builds the Docker image (Fly remote builder), then the **release command**
runs `prisma migrate deploy` + the seed. On a fresh DB the seed loads **68 rules
across 24 services**, the vocab settings, and creates the **owner login**. On
later deploys the seed detects existing data and leaves it untouched.

## 6. Verify
```bash
fly open --app ll-aesthetics-os            # opens the site
fly logs --app ll-aesthetics-os            # watch for "Seeded ..." / "Created owner login"
```
- `https://<app>.fly.dev/api/health` should return `{"ok":true}`.
- The site should redirect to **/login**. Sign in with `SEED_ADMIN_EMAIL` +
  the temp password. Then go to **/account** and change the password.

## 7. Hand off
Send Lindsey the URL (`https://ll-aesthetics-os.fly.dev`, or a custom domain if
you set one up) and the temporary password so she can log in and change it.

---

## Notes / troubleshooting
- **Custom domain (optional):** `fly certs add app.llaesthetics.com` then point a
  CNAME at the app. Not required — the `.fly.dev` URL works immediately.
- **Always-warm:** `fly.toml` has `min_machines_running = 0` (auto-stops to save
  money; ~1s cold start). Set it to `1` if Lindsey wants zero cold starts.
- **Out-of-memory during runtime:** bump `[[vm]] memory` in `fly.toml` to
  `1024mb` and redeploy. (Build runs on a separate remote builder, so build
  won't OOM the app VM.)
- **Re-seed from scratch (only if intended — destroys data):** set a one-off
  `FORCE_SEED=1` and redeploy, or run `fly ssh console` → `FORCE_SEED=1 npm run db:seed`.
- **Migrations:** future schema changes ship as new files in `prisma/migrations/`;
  `fly deploy` applies them automatically via the release command.
- **HIPAA / contractor safety:** deploy with the seeded **demo data only** — do
  NOT add real patients. The app + database must live in the org with the
  Compliance Package. After you confirm it works and hand off the URL, Lindsey
  **revokes the deploy token** and adds real patient data herself. That way no
  real PHI is ever exposed to the contractor.

## What's inside (for context)
- `src/app` — pages (dashboard, tasks, workflow, patients, rules, settings, login, account)
- `src/lib` — the follow-up engine, auth (scrypt + jose sessions), server actions
- `src/middleware.ts` — protects every route behind login
- `prisma/` — schema, initial migration, and the config seed
- `Dockerfile`, `fly.toml`, `.dockerignore` — deployment

# One-time setup: automatic deploys

**Goal:** after this is set up once, updates go live **automatically** whenever new
code is pushed to the `main` branch of this GitHub repo — no more manual
`fly deploy`. Lindsey shouldn't need to commission a person for each future update.

**Audience:** the developer doing the current deploy. ~5 minutes, once.

This repo already includes the workflow at `.github/workflows/fly-deploy.yml`.
It runs `flyctl deploy --remote-only` on every push to `main`. The release
command in `fly.toml` (`npm run release`) applies Prisma migrations + the
idempotent seed on each deploy, so schema updates ship automatically and existing
data is preserved.

## Steps

1. **Push this code to the GitHub repo** (if it isn't already there):
   ```bash
   git init            # if needed
   git add -A
   git commit -m "LL Aesthetics OS + auto-deploy workflow"
   git branch -M main
   git remote add origin https://github.com/laskolindsey-png/ll-aesthetics.git
   git push -u origin main
   ```

2. **Create a Fly deploy token** for CI (Lindsey does this, or you with her
   approval): Fly dashboard → **Tokens** → create an **org deploy token**
   (a longer-lived one is fine for CI; it can be rotated anytime).

3. **Add it to GitHub as an Actions secret:** the repo on GitHub →
   **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `FLY_API_TOKEN`
   - Value: the token from step 2

4. **Confirm the app name matches.** The workflow deploys the app named in
   `fly.toml` (`app = "ll-aesthetics-os"`). If the live app uses a different
   name, update that line in `fly.toml` to match before pushing.

5. **Test it:** make any tiny change (or re-push), and watch the repo's
   **Actions** tab — you should see the deploy run and go green. The app updates
   itself.

## After this
- **Future updates deploy themselves** on push to `main`.
- The CI token is separate from any personal deploy token — Lindsey can revoke
  the personal/contractor tokens and leave only this CI secret in place.
- Rotating the CI token later: create a new one, update the `FLY_API_TOKEN`
  secret, revoke the old one.

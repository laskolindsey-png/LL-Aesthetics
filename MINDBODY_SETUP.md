# Mindbody integration — developer setup

**Audience:** the developer wiring up the Mindbody connection.
**Result:** appointments and sales flow into LL Aesthetics OS automatically.

The app side is already built — an owner-only **Integrations** page, a signed
**webhook receiver** at `/api/webhooks/mindbody`, and a same-day communication
de-duplication engine so a multi-service visit never triggers duplicate messages.
This guide covers the Mindbody-side registration and the two secrets to install.

Lindsey has confirmed with Mindbody that her account **includes API access**.
Setup is two parts: (1) you create the app + credentials in the Partner Developer
Portal, (2) Lindsey authorizes it on her site with an activation code.

---

## 1. Create the app (Partner Developer Portal)
1. In the **Mindbody Partner Program / Developer Portal**, create a developer
   account if needed and **register a new app** for LL Aesthetics.
2. Note the **API Key** it issues — this becomes the `MINDBODY_API_KEY` secret.
3. Generate an **activation code / link** for Lindsey's site so she can authorize
   the app (step 2).

## 2. Lindsey authorizes the app on her site
- Lindsey goes to **Mindbody → Settings → API Integrations**, enters the
  **activation code** you generated, and approves. Your app then appears in her
  "who has access to my API" list. (This is her ~2-click part.)
- Grab her **Site ID** — it goes in the app on the Integrations page.

## 3. Subscribe the webhook
Using the **Mindbody Webhooks API**, create subscription(s) pointing at:

```
https://<the-app-domain>/api/webhooks/mindbody
```

Subscribe to the events we use (exact event IDs per Mindbody's current Webhooks
catalog):
- **Appointment** — booked / updated / cancelled (drives follow-ups + visit timeline)
- **Sale** — created (drives the revenue KPIs on the owner dashboard)
- **Client** — created / updated (patient matching)

When you create a subscription, Mindbody returns a **message signature key** —
that becomes the `MINDBODY_WEBHOOK_SECRET` secret. Our receiver validates the
`X-Mindbody-Signature` header as base64 **HMAC-SHA256(rawBody, secret)**. If
Mindbody's header name or encoding differs from that, tell me — it's a one-line
change in `src/lib/mindbody.ts`.

## 4. Install the two secrets
These are **runtime app secrets** (not the GitHub deploy token). Set them on Fly:
```bash
fly secrets set --app ll-aesthetics-os \
  MINDBODY_API_KEY="<from step 1>" \
  MINDBODY_WEBHOOK_SECRET="<message signature key from step 3>"
```
(The Site ID is entered in-app, not as a secret.)

## 5. Turn it on and verify
1. In the app: **Integrations** → enter the **Site ID** → **Save**.
2. Send/trigger a test event (or wait for a real one). It appears in the
   **Recent events** log on the Integrations page, marked **Verified** if the
   signature checks out.
3. Once a real payload is confirmed, flip **"Turn the connection on"** so events
   start creating follow-up workflows. Until then events are safely logged and
   acknowledged — nothing is lost.

## Notes
- **Cost:** Mindbody bills ~$0.002 per **API call**. Webhooks (pushed events) are
  the primary path; the app only makes paid API calls when it needs a specific
  detail, to keep usage low.
- **PHI:** the app is hosted under a HIPAA BAA (Fly.io). Confirm Mindbody's data
  agreement covers API access on Lindsey's account.
- **What NOT to change:** the webhook route, the de-dup engine, and the signature
  check are done and tested — you only need to register the app, subscribe the
  webhook, and install the two secrets.

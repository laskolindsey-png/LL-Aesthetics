# LL Aesthetics OS — Feature Roadmap & Ideas

A running list so no idea gets lost. Nothing here is committed to a timeline —
it's the backlog we pull from as the app is used and we spot what would help.

**How updates work (quick reminder):**
- **Editable in-app, instantly (no developer):** Service Rules & durations,
  Settings, message templates, vocab lists, and all your data (patients, leads,
  plans, peptide orders).
- **New features (this list):** built in code, then pushed live with a redeploy.
  Your existing data is always preserved.

Legend: ⬜ idea · 🔨 building · ✅ shipped

---

## 🚀 When you go live — checklist
_The moment Ryan says it's deployed, walk through these in order:_
1. ⬜ **Sign in** at the URL Ryan gives you (with the temp password).
2. ⬜ **Change your password** — go to Account and set your own.
3. ⬜ **Revoke both Fly deploy tokens** (the "Ryan Deploy" one AND the
   "Organization Token — Expires: Never") once the app is confirmed working.
4. ⬜ **Deploy the queued updates** — Botox Tracker, reactivation, tracker↔record
   link, and any other work finished after the initial deploy.
5. ⬜ **Import your 157 Botox patients** — Botox Tracker → Import → upload the CSV
   → check "Replace everything".
6. ⬜ **Build the QuickerNotes quick-link** — a link from an LLAOS patient out to
   their QuickerNotes chart (navigation only, no data mixing). _Lindsey's request
   to do once live._

---

## Already shipped
- ✅ Follow-up rules engine (patient event + service → scheduled tasks)
- ✅ Master Service Rules loaded, editable in-app (durations included)
- ✅ Staff logins (owner / staff roles)
- ✅ Leads pipeline
- ✅ Treatment Plans (Aura scan → 6–12 month plans, revenue engine)
- ✅ Peptides order page + shipped-date follow-ups (1-week check-in, 30-day refill)
- ✅ Brand colors + real logo
- ✅ Private, HIPAA-covered hosting (Fly.io + BAA)

---

## Lindsey's list
_(paste your ideas here — I'll organize them into the sections below)_

- ✅ **Botox satisfaction tracker (color-coded, ongoing).** SHIPPED. Its own
  dashboard (Happy / Tough / Not Happy / Awaiting + happy rate), one-click color
  setting that logs to an ongoing history, per-patient timeline, filters, and a
  spreadsheet importer. Colors: 🟢 happy · 🟡 tough patient (never happy but
  still coming) · 🔴 not happy · ⚪ awaiting first check.
  _Next: auto-create the results-check reminder when a Botox appointment lands
  (via Mindbody), so new patients aren't manual._
- ✅ **6-month reactivation for lapsed Botox patients.** SHIPPED. Botox cadence
  is ~3 months, so 6+ months unseen = lapsed. New ⏰ Reactivate dashboard tile +
  filter list everyone due; one click (or bulk) creates reactivation reminders
  that land in Today's Tasks. _Next: auto-flag reactivation from Mindbody visit
  dates; optional lighter 3-month "time to rebook" nudge._
- ✅ **Tracker ↔ patient record link (shared visit timeline).** SHIPPED. A Botox
  patient links to their main record; logging a treatment (or a Mindbody visit)
  auto-updates their last-visit and resets the reactivation clock. Rebooking
  stays a workflow-only reminder, reactivation stays tracker-only — the two
  share the timeline without ever double-reminding.
- ℹ️ Note: the **2.5-month rebooking reminder already exists** in the rules for
  Botox (fires 75 days after a treatment). Deliberately NOT duplicated in the
  tracker, per Lindsey — one reminder, one place.
- ⬜ …

---

## Backlog — ideas from our conversations

### System boundaries (decided)
- **QuickerNotes 2** stays the system of record for clinical **notes, forms, and
  consents.** LLAOS does NOT duplicate charting/consents — keeps our PHI
  footprint small and lets the specialist tool own the medical-legal record.
- **Mindbody** is the shared spine (bookings + patient identity). Both LLAOS and
  QuickerNotes hang off it, so they stay connected *through the patient* without
  a direct integration or double documentation.
- ⬜ Optional convenience later: a deep link from an LLAOS patient out to their
  QuickerNotes chart (if QuickerNotes supports a link) — navigation only, no data
  mixing.

### Mindbody integration
- 🔨 **In progress.** Track 1 (access): Lindsey requesting Mindbody API + webhook
  access. Track 2 (build): groundwork underway.
- ✅ **Same-day de-duplication engine.** SHIPPED. One patient, multiple services
  in a day → one of each communication (not one per service). De-dupes against
  existing open tasks and within the batch; merged visits noted on the record.
  Protects manual entry now and Mindbody's per-service events later.
- ✅ **Connection page + webhook receiver.** SHIPPED (groundwork). Owner-only
  Integrations page (Site ID, on/off, setup checklist, event log); secure webhook
  endpoint that verifies signatures, logs every event, and rejects forgeries.
  Secrets live in env, not the DB. Tested with signed + forged events.
- ⬜ Connect Mindbody so completed appointments auto-create workflow records +
  update the visit timeline. _(Turn on processing once real payloads validated.)_
- ⬜ Service-name mapping (Mindbody service → LLAOS rules).
- ⬜ Sales data → light up the revenue KPIs on Insights.
- ⬜ "Review queue" so you approve auto-generated communications before they send.

### Revenue & Treatment Plans
- ⬜ Plan value / projected revenue reporting (per patient, per month)
- ⬜ Membership tracking tied to plans
- ⬜ Nudges when a plan milestone/target date is approaching

### Patients & communication
- ⬜ Message templates that pull in patient name / service / dates automatically
- ⬜ Recall/reactivation list (patients not seen in X months)

### Reporting & dashboard
- ✅ **Owner-only Insights KPI dashboard.** SHIPPED. One readable screen (no more
  hunting through Mindbody reports): Revenue, Patients & Retention, Operations,
  Growth & Marketing. Live tiles compute now; financial/visit tiles are defined
  and tagged "Mindbody," lighting up when connected. Gated to owner role.
  _Needs Mindbody for: revenue, average ticket, revenue/patient, rebooking %,
  visit frequency, no-show rate, provider & room utilization, membership count,
  new-vs-returning. Optional later: trend charts over time; add ad-spend input
  for cost-per-acquisition._
- ⬜ Staff productivity / task-completion view

### Licensing (future — the big vision)
- ⬜ Multi-location / multi-tenant polish so the system can be licensed to other
  medspas (foundation already built into the data model)

---

_Last updated by our working sessions. Add anytime — this file grows with the app._

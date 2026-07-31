# Mindbody "Smart Conditions" — build requirements

Captured from Lindsey's operational decisions. These are the conditions that make
the follow-up engine trustworthy. All depend on Mindbody appointment history +
client membership status, so build them **with the Mindbody data-mapping** (not
piecemeal). Until Mindbody is live, rules fire on their baseline assumptions.

## 1. Booking-aware suppression
A follow-up should not nag a patient who has already booked.
- **Conversion follow-ups** (Consultation, Tour / Walk-In, Aura Photos, Lead):
  fire only while the patient has **not** booked an appointment since the
  triggering event. If they book, **auto-cancel** the remaining open follow-ups
  in that sequence.
- **Rebooking reminders** (e.g. Botox 2.5-Month, laser rebooks): suppress if a
  future appointment for that service is already on the books.
- **Reactivation** (6/9-month): suppress if a future appointment is already booked.

## 2. Membership-aware routing
Mindbody exposes membership status on the client profile (e.g. "Active · LL Luxe
Membership", contract dates, auto-renew). Use it to choose the follow-up track:
- **Active LL Luxe member** → member track
- **Not a member** → non-member track (e.g. Membership Invitation, Reactivation)
This resolves same-named services (a "Facial" booking picks member vs non-member
by the patient's status, not by a separate service name).
- Membership data should also **sync into the Memberships tab** (no manual entry).

## 3. First-visit-only aftercare
Post-Care Instructions = **same day**. Send only to **first-time** patients for a
service, EXCEPT the more serious procedures, which send **every time**:
- **No aftercare:** XERF
- **First-time only (same day):** Botox, BBL Hero, Complexion Renewal, Dermal
  Filler, Forever Clear, Laser Hair Removal, PRX
- **Every time (same day):** HALO, PRF EZ Gel, PRF Hair Restoration
- Also: **add a same-day Post-Care step to Botox** (currently has none) — first-time only.
"First time" = patient has no prior Mindbody appointment for that service.

## 4. Tox tracker date auto-fill
For existing Tox Tracker patients, auto-match to their Mindbody record (phone +
name) and fill `lastVisitDate` from their **last Botox appointment** (all tox is
booked as "Botox" in Mindbody regardless of product). Drives the reactivation
clock. A few unmatched names may need a manual link.

## 5. No retroactive task flooding (forward-only, with a configurable cutoff)
When the integration goes live, follow-up **tasks generate from a configurable
cutoff date forward** — never a blind retroactive sweep of all history.
- **Agreed default: a ~2-week lookback + forward.** (Chosen so the owner can test
  accuracy against recent appointments immediately, rather than waiting for
  brand-new bookings.)
- **For backfilled appointments inside the cutoff window, only create follow-up
  steps whose due date is still upcoming.** Skip steps that would already be past
  (e.g. a same-day aftercare from 10 days ago) so the list isn't cluttered with
  stale "overdue" tasks. The timely steps (an upcoming 2-week check, a rebooking
  reminder) are what matter for testing.
- Historical data may **backfill patient records + last-visit dates** (which
  powers the reactivation clock and tox date auto-fill), but backfill creates
  data, never tasks. Reactivation tasks for lapsed patients are created only when
  the owner triggers the bulk "create reactivation tasks" action — never
  automatically.

## 6. Dedup-safe mapping
When creating patients/tasks from Mindbody events: match existing patients by
name + phone (update, don't duplicate); never create a follow-up task that
already exists.

## Service notes
- **All neuromodulator appointments are booked as "Botox" in Mindbody** regardless
  of product (she uses Jeuveau ~95%). One "Botox" service rule covers all tox.
  Follow-up message wording avoids naming a brand (says "your treatment / results").
- **BBL Hero and Complexion Renewal are the same treatment** (BBL Hero = larger
  areas → higher price). Aftercare and follow-up rules should be **identical**.

## Parked (future)
- **Referral tracking** — track who referred whom, reward status. (Refer-a-Friend
  reminders were removed from all membership rules pending this.)

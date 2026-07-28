# TOOL — LL Aesthetics Operating System

**TOOL** (Treatment Operations & Optimization Logic) is the software version of
the LL Aesthetics workflow system. It turns each patient event into an
automatically scheduled sequence of follow-ups, so the practice runs from
clearly defined workflows instead of memory.

This repository is **Phase 1**: the rules engine, the daily task queue, the
patient workflow database, and the owner dashboard — all running locally on your
machine, replacing the spreadsheet.

---

## What it does today

- **Owner Dashboard** — active workflows, due today, overdue, completed this
  month, workload by service, and patients needing attention.
- **Today's Tasks** — the daily work queue; complete each follow-up and record
  the outcome.
- **Patient Workflow** — record a new treatment/event and the engine schedules
  every follow-up automatically (from your 43 seeded rules).
- **Patients** — per-patient history and follow-up timeline.
- **Service Rules** — view and pause/enable every rule that drives the engine.
- **Settings** — the dropdown vocabularies, seeded from your workbook.

## Tech stack

| Layer      | Choice                                   |
| ---------- | ---------------------------------------- |
| Web app    | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling    | Tailwind CSS (your Style Guide palette)  |
| Database   | Prisma ORM → SQLite locally (Postgres-ready) |

Built **multi-tenant from day one** (every row carries a `tenantId`) so it can
later be licensed to other medspas without a rewrite.

---

## Running it locally

You need [Node.js](https://nodejs.org) 18+ installed. Then, from this folder:

```bash
npm install       # install dependencies
npm run setup     # create the database + load your rules & settings
npm run dev       # start the app
```

Open **http://localhost:3000**.

### Useful commands

```bash
npm run dev        # run the app in development
npm run build      # production build
npm run db:studio  # open Prisma Studio to browse the database
npm run db:reset   # wipe and reseed the config + demo data
```

---

## How the engine works

1. You record an event on **Patient Workflow** (e.g. "Treatment Completed" +
   "Botox" on a date).
2. The engine looks up matching rows in **Service Rules** and creates one task
   per step, with each due date = event date + the rule's delay.
3. Those tasks appear on **Today's Tasks** as they come due.
4. Completing a task records the outcome; when a record's steps are all done,
   it's marked complete and rolls into the dashboard's metrics.

The rules live in the database (seeded from `prisma/seed.ts`) — change a delay or
priority there and the whole system follows.

---

## Data & privacy notes

- **No real patient data is committed to this repository.** The seed loads only
  configuration (rules, vocabularies, message-template names) plus two clearly
  fake demo patients. Real patients you add live only in your local
  `prisma/dev.db`, which is git-ignored.
- Because this is a medical context, **HIPAA** governs how patient data is
  handled. Phase 1 runs entirely on your local machine. Before this is hosted
  online or connected to Mindbody, we'll put the proper safeguards and vendor
  agreements (BAAs) in place.

## Moving to PostgreSQL later

1. In `prisma/schema.prisma`, change the datasource `provider` from `"sqlite"`
   to `"postgresql"`.
2. Set `DATABASE_URL` in `.env` to your Postgres connection string.
3. Run `npm run db:push && npm run db:seed`.

---

## Roadmap

- **Phase 1 (this repo)** — rules engine, task queue, dashboard, local app. ✅
- **Phase 2** — automated SMS/email messaging, the Message Library, and
  Claude-drafted messages in your voice; in-app editing of rules & settings.
- **Phase 3** — Mindbody integration (events flow in automatically) and hosted,
  HIPAA-ready deployment.
- **Phase 4** — multi-tenant licensing for other medspas (onboarding, billing).

_TOOL™ — built for LL Aesthetics._

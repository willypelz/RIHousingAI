# RIHousingAI — Zoning, Approvals & Funding Navigator for Rhode Island Housing

An AI-powered platform covering the full residential development journey in Rhode Island, across all 39 municipalities:

1. **What can be built here?** — zoning district lookup links (RI Zoning Atlas, RIGIS, all 39 town ordinances), dimensional rules to check, and the 2024–2026 state housing reforms
2. **What does it take to get approved?** — approval pathway, source-cited checklists, workflow with timeline/calendar, document management, AI completeness checks, review coordination
3. **How does it get funded?** — RI affordable-housing funding programs with source links and a capital-stack gap calculator

> RIHousingAI navigates official sources; it does **not** make zoning determinations, predict approval outcomes, estimate funding awards, or invent fees/deadlines — everything cites official sources, and users are directed to confirm with the responsible authority.

## Stack

- **Frontend:** Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS (`client/`)
- **Backend:** Node.js + Express + TypeScript (`server/`)
- **Database:** PostgreSQL
- **AI:** Anthropic API (optional) behind a provider abstraction with a deterministic rule-based fallback

## Features

1. **Project registration** — full applicant/representative details, units, construction type, utility services
2. **Approval pathway identification** — applicability-rule engine determines which approvals apply (never assumes all do); unknown facts yield *conditional* results with confirm-with-authority notes
3. **Source-cited checklists** — every item cites an official source with verification date; fee items link to the fee schedule authority (amounts are never invented)
4. **Completeness checker** — rule-based + optional AI pass over extracted PDF text; every finding includes evidence; never claims official completeness
5. **Workflow dashboard** — stages with explicit dependencies, parallel tracks, auto-activation when dependencies complete; due dates require a cited source
6. **AI assistant** — RAG over official sources with citations and explicit uncertainty handling
7. **Document management** — uploads, versioning, SHA-256 hashes, auto-categorization, secure download
8. **Source management** — authority, URL, version, verification dates, change history (staff/admin editable)
9. **Progress & delays** — elapsed time, waiting-on tracking, bottleneck hints; nothing is called "overdue" without a verified deadline
10. **Roles & access control** — developer, architect/engineer, contractor, consultant, municipal staff, admin; project membership gates access; full audit log

## Hosting

- **Frontend:** Firebase Hosting (free Spark) — https://rihousingai-25382.web.app
- **Backend API:** Vercel serverless (free Hobby, 60s function limit) — Express wrapped in `server/api/index.ts`
- **Database:** Firestore (free Spark, always on)
- **Uploads:** stored as chunked Firestore documents (10MB max per file) since serverless disks are ephemeral

## Setup

Prereqs: Node 18+, PostgreSQL running locally.

```bash
createdb rihousingai

# Server
cd server
npm install
cp .env.example .env          # set JWT_SECRET; optionally ANTHROPIC_API_KEY
npm run migrate
npm run seed                  # Cumberland agencies, sources, approval types
npm run dev                   # API on http://localhost:4000

# Client (second terminal)
cd client
npm install
npm run dev                   # UI on http://localhost:5173 (proxies /api)
```

To enable the AI features (assistant answers, AI completeness pass, AI response drafts), set `ANTHROPIC_API_KEY` in `server/.env`. Without it, the platform still works: checklists are template-generated from official sources, completeness checks run rule-based, and the assistant returns relevant cited sources.

## Tests

```bash
cd server && npm test
```

Covers the applicability engine, pathway generation, source-backed checklists, stage dependency enforcement, verified-due-date guardrails, RBAC project access, RAI task creation, and completeness findings with evidence.

## Walkthrough (acceptance scenario)

1. Register an account and sign in.
2. **Register Project** — e.g. a 10-unit multi-family new construction in Cumberland. The approval pathway is generated automatically.
3. **Workflow tab** — see all applicable approvals (planning, building, fire, sewer, water, conditional stormwater, E-911, inspections/CO) with stages, responsible authorities, and dependencies. OWTS shows as *not applicable* for public-sewer projects.
4. **Checklist tab** — source-cited submission checklist; check items off.
5. **Documents tab** — upload PDFs (linked to checklist items), versioned.
6. **Completeness Check tab** — run a check; findings show evidence (missing docs, signatures, unit-count inconsistencies).
7. **Reviews & Decisions tab** — record agency comments/RAIs (creates tasks + notifications), draft responses (optionally AI-assisted, always marked draft), record official decisions and track conditions and inspections.
8. **Status report** — download a self-contained HTML report.
9. **Official Sources** — browse the verified source directory with contacts, URLs, verification dates, and change history.

## Data integrity guardrails

- Seeded source data is curated from official websites and marked with a `last_verified_at` date; the UI always instructs users to re-verify with the authority.
- Published processing estimates are stored and displayed distinctly from actual project timelines.
- Decisions are only ever *recorded* as issued by authorities; the platform makes no approval determinations.

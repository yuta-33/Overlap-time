# overlap-time

When2meet-like scheduling MVP for Japanese users.

## Implemented in this scaffold
- Event creation page (`/`)
- Event participation page (`/events/{eventId}`)
- Drag/sweep availability painting (`1 = available`, `0 = unavailable`)
- Overlay heatmap by participant count
- Supabase Realtime subscription (availabilities change -> overlay auto refresh)
- API routes for events, participants, availability, overlay
- Supabase SQL schema draft (`supabase/schema.sql`)

## Current storage mode
- Storage is selected automatically:
- If `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, APIs use **Supabase** (`src/lib/repository.ts`).
- If env is missing, it falls back to **in-memory store** (`src/lib/store.ts`).
- In-memory mode resets data on server restart.

## Setup
1. Install dependencies
   - `npm install`
2. Run dev server
   - `npm run dev`
3. Open
   - [http://localhost:3000](http://localhost:3000)

## Environment variables
Copy `.env.example` to `.env.local` and fill values as needed.
- Required for Supabase mode:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client realtime subscription)
  - `SUPABASE_SERVICE_ROLE_KEY`

## Supabase SQL apply order
1. Run `/Users/sasayuta/Documents/Overlap-time/supabase/schema.sql`
2. Run `/Users/sasayuta/Documents/Overlap-time/supabase/rls.sql`

RLS policies in `rls.sql` assume event-scoped access by request header:
- `x-event-id`: required for event/participant/availability read scope
- `x-edit-token`: required when writing availability directly with anon/authenticated role

## API endpoints
- `POST /api/events`
- `GET /api/events/:id`
- `POST /api/events/:id/participants`
- `PUT /api/events/:id/participants/:pid/availability`
- `GET /api/events/:id/overlay`

## Deployment (Vercel)
- Basic config file: `/Users/sasayuta/Documents/Overlap-time/vercel.json`
- Detailed runbook: `/Users/sasayuta/Documents/Overlap-time/docs/vercel-deploy-runbook.md`
- Security headers are configured in `/Users/sasayuta/Documents/Overlap-time/next.config.mjs`
- Current status: Vercel env vars are not set yet, so persistence is unstable until Supabase keys are added.

## Hosting fallback
- Unified fallback runbook: `/Users/sasayuta/Documents/Overlap-time/docs/hosting-fallback-runbook.md`
- Netlify config: `/Users/sasayuta/Documents/Overlap-time/netlify.toml`
- Render config: `/Users/sasayuta/Documents/Overlap-time/render.yaml`
- Self-host (CloudHost/Sakura) container config: `/Users/sasayuta/Documents/Overlap-time/Dockerfile`

## Next work items
1. Add participant list sync via realtime (currently overlay-focused).
2. Improve RLS strategy to remove header assumptions for direct anon DB access.
3. Add monitoring/alerting baseline (Vercel + Supabase).

# Backlog Board

A tiny shared Kanban board: Proposed → In Progress → In Review → Shipped.
Add items, claim them, drag (or use the status dropdown) between columns,
attach a PR/doc link so everyone can see what's been pushed, and attach a
screenshot of the issue (click to upload, or just paste one from your
clipboard — most screenshot tools copy straight to it).

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no extra setup, data is stored in
`data/db.json` on disk — fine for trying it out solo, but it won't be
shared between people once deployed (serverless functions don't share a
filesystem). For a real shared team board, connect Supabase (below).

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, "Add New Project" → import that repo. Framework preset
   (Next.js) is auto-detected — no config needed.
3. **Add shared storage** so everyone's edits sync:
   - Create a project at [supabase.com](https://supabase.com) (free tier).
   - Open its **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql)
     from this repo — creates the one `items` table the app needs.
   - Either connect Supabase to this project via the **Vercel Marketplace**
     integration (Storage → Marketplace → Supabase), or just copy two values
     from Supabase's **Project Settings → API** into Vercel's Project
     Settings → Environment Variables:
     - `SUPABASE_URL` — the Project URL
     - `SUPABASE_SERVICE_ROLE_KEY` — the `service_role` secret key (**not**
       the `anon` key — the app writes to the database directly, so it
       needs the privileged key; if you used the Vercel Marketplace
       integration, it only sets the anon key for you, so add this one
       yourself)
   - Redeploy after adding the env vars. The Storage bucket for screenshots
     is created automatically the first time someone attaches one — no
     extra setup.

   > The service role key bypasses all database access rules, so treat it
   > like a password: only ever set it as a server-side env var (as above),
   > never commit it, and never put it behind `NEXT_PUBLIC_`.
4. (Optional) **Add a passphrase gate**: in Project Settings → Environment
   Variables, add `BACKLOG_PASSWORD` with any value you like, then
   redeploy. Anyone opening the board will be asked for that passphrase
   once (stored in a cookie for 30 days). Leave it unset to skip the gate
   entirely.
5. Share the `*.vercel.app` URL (or your custom domain) with your team.

That's it — no accounts to create for your team, no per-user logins,
just one shared link.

## How it's organized

- `app/page.js` — the board UI (client-side React).
- `app/api/items/route.js` + `app/api/items/[id]/route.js` — CRUD API.
- `app/api/items/[id]/image/route.js` — serves an item's screenshot.
- `lib/store.js` — storage layer; uses Supabase (Postgres + Storage) when
  configured, else a local JSON file/folder for dev. Screenshots are stored
  separately from the items table (Supabase Storage / a local file) so the
  board stays fast regardless of how many tickets have images.
- `supabase/schema.sql` — the one table the app needs; run once per project.
- `lib/image.js` — resizes/compresses a screenshot in the browser before
  upload.
- `proxy.js` + `app/login/page.js` — optional passphrase gate.

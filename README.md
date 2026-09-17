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
filesystem). For a real shared team board, connect Vercel KV (below).

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, "Add New Project" → import that repo. Framework preset
   (Next.js) is auto-detected — no config needed.
3. **Add shared storage** so everyone's edits sync: in the Vercel project,
   go to **Storage → Marketplace Database Providers → Redis** (Upstash
   has a free tier), create one, and connect it to this project. Vercel
   will automatically add the right env vars — redeploy after connecting
   it.
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
- `lib/store.js` — storage layer; uses Upstash Redis when configured, else
  a local JSON file/folder for dev. Screenshots are stored per-item
  (separately from the list) so the board stays fast regardless of how
  many tickets have images.
- `lib/image.js` — resizes/compresses a screenshot in the browser before
  upload.
- `proxy.js` + `app/login/page.js` — optional passphrase gate.

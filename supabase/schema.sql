-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- before deploying. The app connects with the service role key, which
-- bypasses Row Level Security, so RLS does not need to be configured.

create extension if not exists pgcrypto;

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  assignee text not null default 'Unassigned',
  priority text not null default 'medium',
  link text not null default '',
  status text not null default 'proposed',
  has_screenshot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_status_idx on items (status);

-- The "screenshots" Storage bucket is created automatically the first time
-- someone attaches a screenshot, so no manual bucket setup is needed.

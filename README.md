# ChiefOS

Personal command center for the Paoli anesthesia department.

Per PRD v0.3 (`ChiefOS-PRD-v0.3.md`). This is Phase 1 scaffolding — tickets
1–6 of Appendix B.

## Layout

```
ChiefOS/
  ChiefOS-PRD-v0.3.md      Product requirements (source of truth)
  app/                     Next.js 14 application
    src/
      app/                 App Router routes
      components/          UI primitives + composites
      lib/                 supabase clients, utils
    supabase/
      config.toml          Supabase CLI config
      migrations/          SQL migrations
    public/                Static assets (icons, sw.js)
```

## Local dev

```sh
cd app
cp .env.local.example .env.local       # fill in Supabase keys
npm install
npm run dev
```

Open <http://localhost:3000>.

## Status (tickets 1–6 done)

- [x] 1. Next.js 14 + TS + Tailwind + App Router
- [x] 2. shadcn/ui base (Button, Input, Label, Card)
- [x] 3. Supabase CLI + first migration (`user_layout` with RLS)
- [x] 4. Auth — email/password + magic link + protected routes
- [x] 5. TOTP 2FA enrollment at `/settings/security`
- [x] 6. PWA manifest + service worker + offline page

## What's blocked on you

1. Create the hosted Supabase project at <https://app.supabase.com>, then
   paste `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` into `app/.env.local`.
2. Run `npx supabase link --project-ref <ref>` and
   `npx supabase db push` to apply the migration.
3. (Phase-1-late) generate real PNG icons from `app/public/icons/icon.svg`
   — see `app/public/icons/README.md`.

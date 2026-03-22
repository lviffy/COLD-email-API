# Cold Email Personalizer API

REST API for generating personalized cold email opening lines from a LinkedIn URL or company name.

## Stack

- Next.js App Router + TypeScript
- Supabase (API key auth, usage limits, request logs, dashboard auth)
- Google Gemini 3.1 Flash Lite (line generation)
- Vercel deployment target

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Set values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=https://your-api.vercel.app
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
PLAYGROUND_API_KEY=api_live_playground_internal_key
```

4. Start dev server:

```bash
npm run dev
```

## Main endpoint

### `POST /api/v1/personalize`

Headers:

- `Content-Type: application/json`
- `x-api-key: YOUR_API_KEY`

Body:

```json
{
  "company": "Notion",
  "role": "Head of Sales"
}
```

Or:

```json
{
  "linkedinUrl": "https://www.linkedin.com/in/johndoe"
}
```

Success response:

```json
{
  "prospect": {
    "name": "John Doe",
    "role": "Head of Sales",
    "company": "Notion"
  },
  "lines": [
    {
      "tone": "curious",
      "text": "Saw your recent momentum and was curious what your biggest sales priority is right now."
    },
    {
      "tone": "direct",
      "text": "Noticed your team is scaling, so I wanted to share a direct thought based on your current focus."
    },
    {
      "tone": "compliment",
      "text": "Your positioning and execution stand out, especially for the stage your team is in."
    }
  ],
  "usage": {
    "requests_used": 42,
    "requests_limit": 1000
  }
}
```

Error codes:

- `MISSING_INPUT` (`400`)
- `INVALID_URL` (`400`)
- `INVALID_API_KEY` (`401`)
- `LIMIT_EXCEEDED` (`402`)
- `NO_DATA_FOUND` (`422`)
- `GENERATION_FAILED` (`500`)

## Supabase schema

SQL migration files are included in [supabase/migrations/0001_init_api_schema.sql](supabase/migrations/0001_init_api_schema.sql).

You can apply this in one of two ways:

1. Supabase SQL Editor: paste and run the migration SQL.
2. Supabase CLI: link project, then run migration commands.

Optional dev seed is in [supabase/seed.sql](supabase/seed.sql).

### `api_keys`

- `id uuid primary key`
- `key text unique not null`
- `user_id uuid references auth.users(id)`
- `created_at timestamptz default now()`
- `requests_used int4 not null default 0`
- `requests_limit int4 not null default 1000`
- `is_active bool not null default true`

### `usage_logs`

- `id uuid primary key`
- `api_key_id uuid references api_keys(id)`
- `endpoint text not null`
- `resource_id text`
- `status_code int2 not null`
- `created_at timestamptz default now()`

## Notes

- Proxy enforces `x-api-key` header presence on all `/api/v1/*` routes.
- The route handler enforces monthly limits using `usage_logs`, increments usage, and logs request status.
- Supabase Auth powers `/signup` and `/login` with redirect to `/dashboard` on success.
- On first dashboard load, the app auto-generates a key in format `ce_live_<nanoid>` and stores it in `api_keys` with `user_id`.
- Dashboard shows remaining requests for the current month and includes a contact button for limit increases.
- Landing page playground calls `/api/playground/personalize` and uses a restricted internal key server-side.

## New routes

- `/signup`
- `/login`
- `/dashboard`
- `/auth/callback`

## OAuth redirect setup

For Google OAuth with Supabase, add these app redirect URLs in Supabase Auth URL configuration:

- `https://your-template-app.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback` (local dev)

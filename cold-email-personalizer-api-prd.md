# Product Requirements Document
## Cold Email Personalizer API

**Version:** 1.0
**Stack:** Next.js · TypeScript · Vercel · Supabase · Google Gemini
**Status:** Draft

---

## 1. Overview

A REST API that takes a prospect's LinkedIn URL or company name and returns 2–3 ready-to-use personalized opening lines for a cold email. Built for sales teams, SDRs, and outreach tools that need personalization at scale without manual research.

---

## 2. Problem Statement

Cold emails with generic openers get ignored. Good personalization requires researching each prospect manually — reading their LinkedIn, recent posts, company news, and role. That does not scale. Sales teams either send bad emails or hire VAs to do research. There is no clean API that takes a prospect input and returns a personalized, human-sounding opener instantly.

---

## 3. Goals

- Accept a LinkedIn profile URL or company name as input
- Scrape or look up publicly available context about the prospect or company
- Use Google Gemini 3.1 Flash Lite to generate 2–3 distinct personalized opening lines in different tones
- Authenticate users via Supabase Auth (email/password)
- Auto-generate an API key on first login, shown in the dashboard
- Rate-limit usage per key and log all requests
- Ship a live playground on the landing page so visitors can try it before signing up

---

## 4. Non-Goals

- No LinkedIn OAuth or authenticated LinkedIn scraping (v1 uses public data only)
- No CRM integrations (Salesforce, HubSpot) in v1
- No bulk / batch endpoint in v1
- No storing or caching of prospect data beyond the request lifecycle

---

## 5. API Endpoint

### `POST /api/v1/personalize`

**Request Headers**

| Header | Required | Description |
|---|---|---|
| `x-api-key` | ✅ | Your API key |
| `Content-Type` | ✅ | `application/json` |

**Request Body — Option A: LinkedIn URL**

```json
{
  "linkedinUrl": "https://www.linkedin.com/in/johndoe"
}
```

**Request Body — Option B: Company name**

```json
{
  "company": "Notion",
  "role": "Head of Sales"
}
```

**Success Response `200`**

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
      "text": "Saw that Notion just rolled out AI features across all plans — curious how that's changing the way your sales team demos the product."
    },
    {
      "tone": "direct",
      "text": "Noticed you moved into the Head of Sales role at Notion about 6 months ago — congrats. I work with a few sales leaders going through the same scaling phase."
    },
    {
      "tone": "compliment",
      "text": "Your post on pipeline reviews last month resonated — most teams I talk to still treat them as a reporting exercise rather than a coaching one."
    }
  ],
  "usage": {
    "requests_used": 42,
    "requests_limit": 1000
  }
}
```

**Error Responses**

| Status | Code | Reason |
|---|---|---|
| `400` | `MISSING_INPUT` | Neither `linkedinUrl` nor `company` provided |
| `400` | `INVALID_URL` | LinkedIn URL could not be parsed |
| `401` | `INVALID_API_KEY` | Key not found or inactive |
| `402` | `LIMIT_EXCEEDED` | Monthly request limit reached |
| `422` | `NO_DATA_FOUND` | Could not find enough public context to personalize |
| `500` | `GENERATION_FAILED` | Gemini API or scraping error |

---

## 6. File Structure

```
/
├── app/
│   ├── page.tsx                        # Landing page with live playground at top
│   ├── login/
│   │   └── page.tsx                    # Supabase email/password login
│   ├── signup/
│   │   └── page.tsx                    # Supabase email/password sign-up
│   ├── dashboard/
│   │   └── page.tsx                    # Shows API key, usage stats, docs
│   └── api/
│       └── v1/
│           └── personalize/
│               └── route.ts            # Main API handler
├── lib/
│   ├── supabase.ts                     # Supabase client (server + browser)
│   ├── generate-api-key.ts             # nanoid key generator, inserts to DB
│   ├── validate-key.ts                 # Auth middleware: checks key, increments usage
│   ├── scrape-context.ts               # Fetches public LinkedIn / company info
│   └── generate-lines.ts              # Calls Gemini API with context, returns lines
├── middleware.ts                       # Edge middleware for /api/v1/* key validation
├── .env.local                          # Secrets — never committed
└── README.md
```

---

## 7. Auth Flow

### Sign-up `/signup`
- Email + password fields
- On submit: call `supabase.auth.signUp()`
- On success: redirect to `/dashboard`
- On first dashboard load: check if a key exists for this `user_id` in `api_keys`. If not, auto-generate one and insert it.

### Login `/login`
- Email + password fields
- On submit: call `supabase.auth.signInWithPassword()`
- On success: redirect to `/dashboard`

### Dashboard `/dashboard`
- Protected route — redirect to `/login` if no active session
- Display the user's API key in a masked input with a copy button
- Show `requests_used / requests_limit` as a progress bar
- Link to API docs section

### Session handling
- Use `@supabase/ssr` for cookie-based session management
- Middleware checks session on all `/dashboard` routes and redirects unauthenticated users

---

## 8. Database Schema

### Table: `api_keys`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, auto-generated |
| `key` | `text` | Unique key, format `ce_live_<nanoid>` |
| `user_id` | `uuid` | Foreign key → `auth.users.id` |
| `created_at` | `timestamptz` | Default `now()` |
| `requests_used` | `int4` | Incremented on each successful request |
| `requests_limit` | `int4` | Default `1000` |
| `is_active` | `bool` | Default `true`; set false to revoke |

### Table: `usage_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, auto-generated |
| `api_key_id` | `uuid` | Foreign key → `api_keys.id` |
| `endpoint` | `text` | e.g. `/api/v1/personalize` |
| `input_type` | `text` | `linkedin_url` or `company_name` |
| `status_code` | `int2` | HTTP status returned |
| `created_at` | `timestamptz` | Default `now()` |

### Row Level Security

- Public role: no access
- Service role: full read/write
- Authenticated users: can only read their own row in `api_keys` (for dashboard display)

---

## 9. Middleware Logic

On every request to `/api/v1/*`:

1. Extract `x-api-key` from request headers
2. Query `api_keys` for a matching row where `is_active = true`
3. If not found → return `401 INVALID_API_KEY`
4. If `requests_used >= requests_limit` → return `402 LIMIT_EXCEEDED`
5. Increment `requests_used` by 1
6. Insert a row into `usage_logs`
7. Attach the `api_key_id` to the request context and continue

---

## 10. Personalization Logic

### Step 1 — Parse input
- If `linkedinUrl` is provided, extract the handle and fetch the public profile page
- If `company` is provided, fetch the company's public website and news via a web search

### Step 2 — Scrape context
In `scrape-context.ts`:
- Fetch the public LinkedIn page or company website with a headless request
- Extract: person name, role, company, recent activity, company news, headcount signals
- If no usable data is found → return `422 NO_DATA_FOUND`

### Step 3 — Generate lines
In `generate-lines.ts`, call Google Gemini (`gemini-3.1-flash-lite`) with a structured prompt:

```
You are an expert cold email copywriter. 
Given the following context about a prospect, write exactly 3 opening lines 
for a cold email. Each line must:
- Be 1–2 sentences max
- Reference something specific from the context
- Not mention the sender's product or pitch
- Sound human, not AI-generated

Return a JSON array with fields: tone (curious | direct | compliment) and text.

Context:
{{scraped_context}}
```

### Step 4 — Return response
Format the Gemini output into the API response shape and return.

---

## 11. Landing Page (`/`)

Layout order from top to bottom:

1. **Hero** — headline + one-line description + Sign Up CTA button
2. **Live Playground** — paste a LinkedIn URL or company name, hit "Generate", see real JSON output inline. Uses a server-side restricted key, no sign-in needed.
3. **Code example** — copy-paste `curl` snippet
4. **Tones explained** — show the 3 line types with examples
5. **Pricing** — Free: 1,000 requests/month. Pro (coming soon): unlimited.
6. **Footer** — link to docs, GitHub, sign-up

---

## 12. Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — server only, never expose |
| `GEMINI_API_KEY` | Google Gemini API key for generation |
| `PLAYGROUND_API_KEY` | Internal restricted key used by the landing page playground |

---

## 13. Deployment

1. Push to GitHub
2. Import into Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy — live at `your-project.vercel.app`

---

## 14. Out of Scope for v1

- LinkedIn OAuth or authenticated scraping
- CRM integrations
- Bulk / batch endpoint
- Custom tone configuration
- Email sequence generation (just openers in v1)

---

## 15. Success Metrics

| Metric | Target |
|---|---|
| p95 response time | < 3000ms |
| Uptime | > 99.5% |
| Error rate (5xx) | < 2% |
| Signed-up users in first month | 100+ |
| Paid conversion from free tier | > 5% |

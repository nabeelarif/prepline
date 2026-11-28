# Supabase setup

Road to Goals stores all plans in Supabase and needs sign-in. Nothing is saved in the browser except the auth session and the theme. Without the two variables below, the app shows "Backend not configured".

## What you need to supply

| Value                    | Where to find it                     | Safe in the front end?                                    |
| ------------------------ | ------------------------------------ | --------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Project Settings → API → Project URL | Yes                                                       |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → `anon` key  | Yes. It is public; Row Level Security protects data.      |
| `service_role` key       | Project Settings → API               | **Never.** Do not put it in this app, `.env` or the repo. |
| Database password        | Project creation                     | **Secret.** Only for `supabase link` / `db push`.         |

## 1. Create the schema

Open Dashboard → SQL Editor, paste the contents of `supabase/schema.sql` and run it once on the new project. (Once production exists, further changes go in `supabase/migrations/` as new ordered `.sql` files.)

`schema.sql` creates `profiles`, `goals`, `plan_settings` (the owner's start date, deadline and daily hours), `phases`, `resources`, `resource_progress` (the owner's progress) and the sharing tables `plan_shares`, `plan_copies`, `plan_favorites` and `plan_reports` (every row has a `user_id`, plus a `position` for order where order matters), Row Level Security policies that limit each table to its owner, and the RPC functions for atomic writes (reorder, save a whole plan, append plans, delete all data, delete account). Deleting a plan deletes its phases and resources. Deleting a phase keeps its resources, with no phase. Deleting a user deletes all their data.

Optional, with the local stack running (`supabase start`, needs Docker): `supabase test db` runs the pgTAP tests in `supabase/tests/`, which check isolation between users and atomicity.

### Sharing and moderation

Plans can be shared by link or listed publicly in Explore. Other people read plans only through the functions `get_shared_plan`, `list_public_plans`, `list_popular_tags` and `similar_plans`, which return plan content and never progress, dates or daily hours. Signed-in users star plans with `set_plan_favorite` and read their own stars with `list_my_favorites`; the readers return `favorite_count` and, for the caller, `favorited`. A project created before favorites existed needs `supabase/migrations/20261119000000_plan_favorites.sql` run once. Owners read how many people starred their own plans with `my_favorite_counts`; an existing project needs `supabase/migrations/20261127000000_my_favorite_counts.sql` run once, before the app that calls it is deployed. It also updates `set_plan_sharing` to answer with the same counts. The `anon` role still has no table access. Because the schema changed in place (no migrations yet), a project created from an older `schema.sql` must be recreated or have the new tables and functions applied by hand. For a project that already has the earlier `list_public_plans(text, text, integer, integer)`, run `drop function public.list_public_plans(text, text, integer, integer);` before applying the new five-argument version, and add the `source_slug` and `source_name` columns to `goals` (copy any existing values over from `plan_settings`, then drop them there). A copy's origin is plan content: once the copy is shared, the same functions return it as `source`.

To take a plan down (for example after a report), run in the SQL Editor:

```sql
-- Reports, newest first
select r.created_at, r.slug, r.reason from public.plan_reports r order by r.created_at desc;
-- Hide a plan (reversible: set hidden = false)
update public.plan_shares set hidden = true where slug = 'THE-SLUG';
```

Hidden plans stop appearing in Explore and their link stops working. The owner still sees them as shared, with a notice.

## 2. Authentication settings (Dashboard → Authentication)

- **Sign In / Providers → Email:** enabled, **Confirm email: on**, minimum password length 8. Confirmation matters for account linking: Supabase links identities that share a _verified_ email, so an unconfirmed sign-up must never count.
- **Providers → Google:** create an OAuth client in Google Cloud Console (type Web). Set the authorized redirect URI to `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`. Paste the client id and secret into Supabase.
- **Providers → X / Twitter (OAuth 2.0):** create a project and app in the X Developer Portal with the same callback URL, then paste the client id and secret into Supabase.
- **Sign In / Providers → Allow manual linking: on.** This lets a signed-in user add Google, X or a password to the same account (Account in the top bar).
- **Anonymous sign-ins: off.**
- **URL Configuration:**
  - Site URL: `https://roadtogoals.com`
  - Redirect URLs: `https://roadtogoals.com/`, `https://nabeelarif.github.io/prepline/` (dev), `http://localhost:5173/`, `http://localhost:4173/`

`supabase/config.toml` holds the same settings for the local stack.

## 3. Local development

```bash
cp .env.example .env     # then fill in the URL and anon key
npm run dev              # http://localhost:5173/
```

## 4. Deployment

The dev and production builds both need `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. They end up in the public JavaScript, which is expected. For dev, they are GitHub Actions repository variables (see [Deployment](../README.md#deployment) in the README). Production is built by Cloudflare, which needs them in its own build settings.

## 5. Link auto-fill (Edge Function)

Pasting a link in Add Resource fills the title and length through the `enrich-url` function (`supabase/functions/enrich-url`). The browser cannot fetch other sites itself (CORS). It works without any setup beyond deploying; without the function the form simply keeps what you typed.

```bash
supabase functions deploy enrich-url
supabase secrets set YOUTUBE_API_KEY=...   # optional
```

- `YOUTUBE_API_KEY` (YouTube Data API v3, free quota) adds the video length. Without it YouTube links still get a title (from oEmbed) but not a length.
- Vimeo links use Vimeo's oEmbed (title and length). Other links use the page's Open Graph / `<title>` tags and an estimated reading time.
- Only signed-in users can call it. It refuses non-http(s) links, other ports, and addresses that are local or private (SSRF guard), limits each fetch to 5 s and 512 KB, and re-checks every redirect (a host that changes its DNS answer between the check and the fetch is not caught).
- Locally: `supabase functions serve enrich-url`.

## Tests

- `npm test` and `npm run test:e2e` use an in-memory backend and need no project.
- To run the repository contract against a real project (use a throwaway one: it deletes data), create two email/password users and run:

```bash
SUPABASE_TEST_URL=... SUPABASE_TEST_ANON_KEY=... \
SUPABASE_TEST_EMAIL_A=... SUPABASE_TEST_PASSWORD_A=... \
SUPABASE_TEST_EMAIL_B=... SUPABASE_TEST_PASSWORD_B=... \
npx vitest run src/backend/supabase/live.test.ts
```

## Replacing Supabase later

Implement `AppRepository` (`src/repositories/types.ts`) and `AuthService` (`src/auth/types.ts`) in a new `src/backend/<name>/` folder, run `describeRepositoryContract` against it, and return it from `createBackend` in `src/backend/index.ts`. The UI, store and domain code do not change. The SQL in `supabase/` is specific to Supabase.

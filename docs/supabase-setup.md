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

`schema.sql` creates `profiles`, `goals`, `phases` and `resources` (every row has a `user_id`, plus a `position` for order), Row Level Security policies that limit each table to its owner, and the RPC functions for atomic writes (reorder, save a whole plan, restore, delete all). Deleting a plan deletes its phases and resources. Deleting a phase keeps its resources, with no phase. Deleting a user deletes all their data.

Optional, with the local stack running (`supabase start`, needs Docker): `supabase test db` runs the pgTAP tests in `supabase/tests/`, which check isolation between users and atomicity.

## 2. Authentication settings (Dashboard → Authentication)

- **Sign In / Providers → Email:** enabled, **Confirm email: on**, minimum password length 8. Confirmation matters for account linking: Supabase links identities that share a _verified_ email, so an unconfirmed sign-up must never count.
- **Providers → Google:** create an OAuth client in Google Cloud Console (type Web). Set the authorized redirect URI to `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`. Paste the client id and secret into Supabase.
- **Providers → X / Twitter (OAuth 2.0):** create a project and app in the X Developer Portal with the same callback URL, then paste the client id and secret into Supabase.
- **Sign In / Providers → Allow manual linking: on.** This lets a signed-in user add Google, X or a password to the same account (Account in the sidebar).
- **Anonymous sign-ins: off.**
- **URL Configuration:**
  - Site URL: `https://roadtogoals.com`
  - Redirect URLs: `https://roadtogoals.com/`, `http://localhost:5173/`, `http://localhost:4173/`

`supabase/config.toml` holds the same settings for the local stack.

## 3. Local development

```bash
cp .env.example .env     # then fill in the URL and anon key
npm run dev              # http://localhost:5173/
```

## 4. Deployment (GitHub Pages)

In the repository: Settings → Secrets and variables → Actions → **Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `deploy.yml` passes them to the build. They end up in the public JavaScript, which is expected.

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

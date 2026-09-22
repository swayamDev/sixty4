# Production Deployment Runbook - Sixty4 → chess.swayam.space

Follow this in order, top to bottom. Don't skip ahead - later steps (Vercel env
vars, Google OAuth redirect URI) depend on values you only get from earlier
steps (Clerk production keys, Convex production URL).

Anywhere this doc says "copy the exact value Clerk/Vercel shows you," that's
deliberate: Clerk's DNS targets and Vercel's CNAME target are specific to
your instance/project and can change over time, so a value written into this
doc could go stale. Always take it live from the dashboard at the time you do
this.

---

## 0. Prerequisites

- [ ] Node.js **24+** locally (`node --version`). The `eve` dev dependency
      requires it; you cannot run `pnpm dev` on Node 22 or lower.
- [ ] pnpm 11+ (`npm install -g pnpm`)
- [ ] Accounts, all free to create: [Clerk](https://clerk.com),
      [Convex](https://convex.dev), [Vercel](https://vercel.com)
- [ ] Access to the DNS zone for `swayam.space` in your **Hostinger** hPanel
- [ ] The repo cloned locally, or this zip extracted

---

## 1. Install dependencies

```bash
pnpm install
```

## 2. Create your local env file

```bash
cp .env.example .env.local
```

Leave everything blank for now except `NEXT_PUBLIC_SITE_URL` - set it to
`http://localhost:3000` for local dev (you'll change it for production later
in step 8).

## 3. Connect Convex (dev deployment) and get local Clerk dev keys

```bash
npx convex dev
```

- First run: it'll ask you to log in and either create a new Convex project
  or link an existing one. Say yes to creating a new project - call it
  something recognizable, e.g. `sixty4`.
- This writes `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and
  `NEXT_PUBLIC_CONVEX_SITE_URL` into `.env.local` for you. Leave this process
  running in a terminal tab - it watches `convex/` and pushes changes live.

In a **separate** terminal, go to your Clerk dashboard, create a new
application (development instance is fine to start), and copy its keys into
`.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

In the Clerk Dashboard, under **Configure → JWT templates**, create a
template named exactly `convex` with audience `convex`, and make sure it
includes a `nickname` claim (Sixty4 reads the player's display name from
it). Then require a username at sign-up under **Configure → User & authentication → Email, phone, username**.

Set the JWT issuer domain on your Convex **dev** deployment (this is a Convex
env var, not something you put in `.env.local`):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-dev-instance>.clerk.accounts.dev
```

(Find `<your-dev-instance>` on the Clerk Dashboard's **API Keys** page - it's
part of your publishable key's domain, also shown directly on that page.)

## 4. Run the app locally and sanity-check it

```bash
pnpm dev
```

Open `http://localhost:3000`. Sign up, start an AI game, make a move. If
that works, the local wiring is correct and you're ready to verify the
codebase itself before touching anything production.

## 5. Run lint, typecheck, and the test suite

Run these one at a time, in this order, and don't proceed to step 6 unless
all three are clean:

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

If you want to see what's covered before deploying, coverage is optional but
useful here:

```bash
pnpm test:coverage
```

(`pnpm e2e` needs a browser installed once - `npx playwright install --with-deps chromium`
- and, for the signed-in flow specifically, a Clerk test user; see
`TESTING.md`. Not required to proceed, but worth running against your
deployed preview once you have one, later in this doc.)

## 6. Confirm the production build compiles

```bash
pnpm build
```

This will actually fetch Google Fonts and run the real production build.
If it fails here, fix it before you touch Vercel - a broken build behaves
identically whether it's run locally or on Vercel's infrastructure.

---

## 7. Set up the Clerk **production** instance

Development and production are two separate Clerk instances with separate
keys, separate OAuth credentials, and separate rate limits. Everything in
this section is new setup, not editing what you already have.

### 7.1 Create the production instance

1. In the Clerk Dashboard, use the environment switcher (top of the sidebar)
   and choose **Create production instance**.
2. When asked, choose to **clone your development instance's configuration**
   - this carries over your sign-in options and the `convex` JWT template so
   you don't redo them by hand.
3. When prompted for your production domain, enter `chess.swayam.space`
   (your actual app domain - Clerk derives its own subdomains, like
   `clerk.chess.swayam.space`, from this).

### 7.2 Add Clerk's DNS records at Hostinger

1. In the Clerk Dashboard (now switched to your production instance), go to
   **Configure → Domains**.
2. You'll see a table of required **CNAME** records - typically one each for
   the Frontend API, Account Portal, and email (plus two DKIM records for
   email). Keep this tab open.
3. Log in to **Hostinger hPanel** → your domain → **DNS / Nameservers** →
   **DNS Zone Editor** (or **Manage DNS records**, wording varies slightly by
   Hostinger's current UI).
4. For each row Clerk showed you, add a CNAME record in Hostinger with the
   exact **Name** and **Value/Target** Clerk gave you - copy-paste, don't
   retype. Leave TTL at the default.
5. Go back to the Clerk Dashboard's Domains page and wait. Each record flips
   to **Verified** once Hostinger's DNS propagates - this can take anywhere
   from a few minutes to a few hours. Don't move on until every row shows
   Verified.

### 7.3 Configure production sign-in options

Still on the production instance:

- **Configure → Email, phone, username**: confirm username is required (it
  should have carried over from dev in step 7.1, but check).
- **Configure → SSO connections → Google**: if you're using Google sign-in,
  you now need production-only credentials - Clerk's shared dev credentials
  don't work in production. Follow the separate Google Cloud Console steps
  (create an OAuth client, set Authorized JavaScript origins to
  `https://chess.swayam.space`, and paste Clerk's exact **Redirect URI** -
  shown in this same Google connection panel - into Google's Authorized
  redirect URIs). Then paste the resulting Client ID and Client Secret back
  into this Clerk panel and turn on **Use custom credentials**. Keep the
  OAuth consent screen's publishing status **In production**, not Testing.
- **Configure → JWT templates**: confirm the `convex` template carried over.
  If it didn't clone across, recreate it exactly as in step 3.
- **Configure → Restrictions**: if you want to gate sign-ups (allowlist,
  blocklist, disposable-email blocking), set that here - optional.
- **Configure → Billing** (if you're using Clerk Billing for Sixty4 Pro,
  per `docs/KNOWN_ISSUES.md` §8.5): recreate your Pro plan here. Billing
  plans do **not** carry over from the dev clone - verify the plan name,
  price, and any features/entitlements before going live.

### 7.4 Get your production API keys

**Configure → API Keys** on the production instance. Copy:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

Keep this tab open - you'll paste these into Vercel in step 9.

---

## 8. Deploy Convex to production

```bash
npx convex deploy
```

- First run against a new production target: it will ask to confirm creating
  a **production** deployment for your existing Convex project (separate
  from the dev deployment you've been using).
- Note the production deployment's URL it prints (something like
  `https://<name>.convex.cloud`) - you'll need it in step 9.

Set the Clerk issuer domain on the **production** Convex deployment - this
is the production equivalent of what you did in step 3, and it's easy to
accidentally set on the wrong deployment, so double-check you're targeting
prod:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://clerk.chess.swayam.space --prod
```

(Use whatever Clerk actually shows as your Frontend API domain on the
Domains page from step 7.2 - it's usually `clerk.<your-domain>`, but confirm
rather than assume.)

Do **not** set `ALLOW_DEV_SEED` on production - leaving it unset keeps
`convex/seedPlayers.ts`/`seedProfile.ts` disabled, which is what you want.

---

## 9. Set up the Vercel project

### 9.1 Link and deploy

```bash
npx vercel link
```

Follow the prompts to create a new Vercel project (or link an existing one).

### 9.2 Set every environment variable

In the Vercel Dashboard → your project → **Settings → Environment Variables**,
add each of these for the **Production** environment. This list matches
`.env.example` exactly - go through it top to bottom:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | from step 7.4 (`pk_live_...`) |
| `CLERK_SECRET_KEY` | from step 7.4 (`sk_live_...`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/play` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/play` |
| `CONVEX_DEPLOYMENT` | from step 8 (production deployment name) |
| `NEXT_PUBLIC_CONVEX_URL` | from step 8 (production `.convex.cloud` URL) |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | from step 8 (Convex prints this alongside the URL above) |
| `NEXT_PUBLIC_SITE_URL` | `https://chess.swayam.space` |
| `EVE_SERVER_SECRET` | generate a new random secret (e.g. `openssl rand -hex 32`) |
| `VERCEL_OIDC_TOKEN` | leave unset - Vercel injects this automatically at runtime for AI Gateway auth; do not set it by hand |

Do not set `AI_GATEWAY_API_KEY`, `E2E_CLERK_USER_EMAIL`, `E2E_CLERK_USER_PASSWORD`,
or `E2E_BASE_URL` in Vercel - none of those belong in the deployed app's
environment; the E2E ones are for your local/CI test runs only.

### 9.3 Deploy

```bash
npx vercel --prod
```

Wait for it to finish and open the `*.vercel.app` URL it gives you -
confirm the app loads (even before your custom domain is attached) before
moving to DNS.

---

## 10. Point chess.swayam.space at Vercel

### 10.1 Add the domain in Vercel

In the Vercel Dashboard → your project → **Settings → Domains**, click **Add**,
enter `chess.swayam.space`, and click **Add**. Vercel will show you the exact
DNS record it needs - for a subdomain, this is almost always a **CNAME**
record. Copy the **Name** and **Value** it shows you exactly (the target
hostname can change over time, so take the live value from this screen, not
from memory or an old guide).

### 10.2 Add that record at Hostinger

Back in **Hostinger hPanel → DNS / Nameservers → DNS Zone Editor**:

1. Add a new **CNAME** record.
2. **Name**: `chess` (just the subdomain label - Hostinger appends
   `.swayam.space` itself; if your zone editor asks for the full name
   instead, use `chess.swayam.space`).
3. **Value/Target**: exactly what Vercel showed you in 10.1.
4. Save, then go back to Vercel's Domains page and wait for it to show
   **Valid Configuration**. Vercel auto-provisions an SSL certificate once
   the record verifies - no separate action needed.

### 10.3 Confirm Clerk's production domain matches

Clerk's production instance was created against `chess.swayam.space` in
step 7.1, so once this resolves, Clerk and Vercel are pointed at the same
domain and sessions/cookies will work correctly. If you ever change the app's
domain later, you must update it in **both** places - Clerk's "change domain"
flow (which reissues your publishable key) and Vercel's domain settings - or
sign-in will break.

---

## 11. Post-deploy verification

Work through this list against `https://chess.swayam.space`, not
`localhost` and not the raw `*.vercel.app` URL:

- [ ] The homepage loads over HTTPS with a valid certificate (padlock, no
      warnings).
- [ ] `https://chess.swayam.space/robots.txt` and `.../sitemap.xml` both
      return real content, not a 404.
- [ ] `https://chess.swayam.space/opengraph-image` returns a PNG (check the
      `content-type` header, or just open it in a browser).
- [ ] Sign up with a real email, confirm the verification email arrives
      (this exercises Clerk's production email DNS records from step 7.2 -
      if it doesn't arrive, that's the first place to check).
- [ ] Start an AI game and make a move.
- [ ] Join the matchmaking queue from two different browsers/accounts and
      confirm you get paired.
- [ ] If you configured Clerk Billing, subscribe to Pro with a real card (or
      Clerk's test-mode card if your billing gateway is still in test mode)
      and confirm the tutor unlocks.
- [ ] Optionally, run the public e2e smoke tests against the live site
      instead of localhost:
      ```bash
      E2E_BASE_URL=https://chess.swayam.space pnpm e2e e2e/public.spec.ts
      ```

If everything above passes, the deployment is live and correctly wired.

---

## Rollback / redeploying later

- **Code changes**: `npx vercel --prod` again (or push to your connected Git
  branch, if you set up Git integration in step 9.1) redeploys the app.
  Deploy Convex first if `convex/` changed (`npx convex deploy`) - the app
  will otherwise call functions that don't exist yet on the new deployment.
- **Rolling back a bad deploy**: Vercel Dashboard → Deployments → find the
  last good one → **Promote to Production**. This only rolls back the
  Next.js app, not Convex - if the bad deploy included a breaking Convex
  schema change, you'll need to fix that forward rather than roll back.

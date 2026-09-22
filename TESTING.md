# Testing

Sixty4 has three layers of tests. Two of them (unit and integration) need
nothing beyond `pnpm install` - no real Clerk or Convex account, no network.
The third (authenticated e2e) needs real credentials and is skipped
automatically without them.

| Layer | Tool | Needs a real backend? | Command |
| --- | --- | --- | --- |
| Unit | Vitest | No | `pnpm test` |
| Integration | Vitest + [convex-test](https://docs.convex.dev/testing/convex-test) | No (in-memory simulated Convex) | `pnpm test` |
| E2E | Playwright | Partially (see below) | `pnpm e2e` |

## Unit tests

Pure functions with no I/O: chess rules (`src/lib/chess.ts`), Elo math
(`src/lib/elo.ts`), the AI difficulty/persona table (`src/lib/difficulty.ts`),
candidate-move selection (`src/lib/engine/candidates.ts`), and the
participation/permission helpers in `convex/lib/games.ts`.

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
pnpm test:coverage # with a coverage report (coverage/index.html)
```

No setup required - `pnpm install` is enough.

## Integration tests

These call the real Convex function handlers (`convex/games.ts`,
`convex/queue.ts`, `convex/players.ts`) through
[`convex-test`](https://www.npmjs.com/package/convex-test), which runs your
schema and functions against an in-memory simulated backend. **This is not a
mock** - it's the actual mutation/query code, actual index queries, actual
scheduler (see the note below), running in-process. There is no real Convex
deployment involved and no network calls, so these run in the same
`pnpm test` command and the same CI job as the unit tests above, with no
extra setup.

Covered: player provisioning and idempotency (`players.test.ts`), the
matchmaking queue including rating-window pairing (`queue.test.ts`), and game
creation, move legality, turn enforcement in both online and local modes,
promotion, resignation, draw offers, and a full scholar's-mate game that
verifies both players' Elo ratings actually update (`games.test.ts`).

**Scheduler note:** `queue.join` schedules `internal.queue.pair` to run via
`ctx.scheduler.runAfter(0, ...)`. convex-test does not run scheduled
functions automatically. Tests that depend on pairing having happened call
`t.mutation(internal.queue.pair, {})` directly instead of waiting on the
scheduler - this is why you'll see that line after every `queue.join` pair in
`queue.test.ts` and `games.test.ts`. If you add a test that relies on some
other scheduled function, you'll need the same pattern (or
`convexTest`'s `finishInProgressScheduledFunctions()`, if the timing genuinely
matters for what you're testing).

## E2E tests (Playwright)

```bash
pnpm e2e      # headless, once
pnpm e2e:ui   # Playwright's interactive UI mode
```

`pnpm e2e` starts `pnpm dev` for you automatically and runs against it
(`playwright.config.ts`'s `webServer`), unless `E2E_BASE_URL` is set, in which
case it targets that URL instead (a deployed preview, for example) and
doesn't start a local server.

The first time, install a browser:

```bash
npx playwright install --with-deps chromium
```

### `e2e/public.spec.ts` - no credentials needed

Landing page, `/pro`, `/leaderboard`, the sign-in/sign-up pages rendering,
protected routes redirecting a signed-out visitor, and the SEO routes
(`robots.txt`, `sitemap.xml`, the OG image). Runs with nothing but
`pnpm install` and a working `pnpm dev`.

### `e2e/auth.spec.ts` - needs a real Clerk test user

The one flow that requires being signed in: start an AI game and make the
opening move. This test is **skipped automatically** unless both of these are
set:

```bash
E2E_CLERK_USER_EMAIL=you+clerk_test@example.com
E2E_CLERK_USER_PASSWORD=...
```

on top of the usual `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`
in `.env.local`. Create the test user in your Clerk dashboard (a real
account on your Clerk instance - Clerk's testing helpers sign in through the
actual UI, they don't fake the session). Clerk's [`+clerk_test`
email convention](https://clerk.com/docs/testing/e2e/test-emails-and-phones)
is the easiest way to get a user that never sends real emails.

## What's covered, and what's deliberately left out

**Covered well:** the chess rule engine, the Elo rating math (both copies,
plus a test that fails if they drift apart), the AI difficulty/persona
selection logic, and the core game lifecycle end-to-end at the function
level (create → move → resign/draw/checkmate → rating update) for both
online and local modes.

**Left out, on purpose:**

- **The `/api/ai/*` and `/api/tutor` routes** (`src/app/api/ai/hint`,
  `.../move`, `src/app/api/tutor`) aren't unit- or integration-tested here.
  They call a live language model through the Vercel AI Gateway; a
  meaningful test would need either a real Gateway credential (making the
  test slow, flaky, and rate-limited) or mocking the AI SDK deeply enough
  that the test would mostly be asserting the mock, not the route. The
  security-critical part of that surface - that a caller can't act as a
  role they don't hold - is exactly what `game-guard.ts` is for, and that
  logic already runs (indirectly) through every `games.test.ts` mutation
  call, since it's the same identity/role resolution path.
- **The 3D board renderer, camera, and animation code**
  (`src/lib/camera.ts`, `src/lib/piece-tracker.ts`,
  `src/components/board3d/**`) has no automated tests. This is visual,
  WebGL-dependent behavior; the meaningful way to check it is by eye, not by
  assertion. `src/app/dev/board3d` (the existing dev harness) is the right
  tool for that, not a new test file.
- **`e2e/auth.spec.ts` is written but has not been run.** I don't have
  Playwright browser access in this sandbox (`cdn.playwright.dev` isn't on
  the allowed network list here) or a real Clerk test account to sign in
  with. The selectors are pinned to the UI contract the source comments in
  `ai-setup.tsx` and `game-action-bar.tsx` already document (persona
  buttons named `Play {name}`, board squares as `data-square="e2"`, the
  view toggle labelled by the mode you'd switch *to*), but until this runs
  against a real deployment once, treat it as reviewed, not verified.
- **Stockfish itself** (the chess engine binary) isn't tested - it's a
  third-party WASM engine, not code in this repo.
- **Convex crons** (`convex/crons.ts`) and the presence-sweeping internal
  mutations (`sweepAbandoned`, `gcPresence` in `convex/games.ts`) aren't
  covered. They're maintenance jobs whose correctness matters far less than
  the game logic above, and time-based sweep behavior is fiddly to test
  meaningfully without fake timers doing most of the work for you rather
  than the assertions.

## CI

Run unit + integration tests, then typecheck and lint, on every push:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
```

`pnpm e2e` needs a browser install step and, for the full suite including
`auth.spec.ts`, the `E2E_CLERK_USER_EMAIL`/`E2E_CLERK_USER_PASSWORD` secrets
above. `e2e/public.spec.ts` alone needs neither and is safe to run in any CI
job that can `pnpm dev`.

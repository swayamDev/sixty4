# Sixty4

Sixty4 is a real-time 3D chess club: play a rated opponent online, challenge one of five AI
personalities, or share one device with a friend, all from a physically lit board you can walk
around. Switch to a flat 2D board any time, sit in one of five rooms, and if you're on Sixty4 Pro,
ask an AI tutor to explain the position and watch it draw its explanation directly on your board.

**Live at:** [https://chess.swayam.space](https://chess.swayam.space)

## What it does

- **Play online** through a rating-based matchmaking queue that widens its search range the
  longer you wait.
- **Play the AI** at one of five strengths, each with its own opponent persona: Pip (Beginner),
  Marco (Casual), Ada (Intermediate), Viktor (Advanced), and Kasparova (Grandmaster). Moves are
  chosen by Stockfish running in the browser; a language model picks among Stockfish's top
  candidates and narrates the move in that persona's voice.
- **Play pass-and-play** on one device, with a board that turns between moves.
- **Switch between a 3D and a 2D board** at any point in a game, choose from five rooms (Study,
  Space, Park, Neon Arcade, Minimal White), and adjust the camera.
- **Watch live games**, review previous moves, and export any game as PGN.
- **Track three ratings** overall, versus human opponents, and versus the AI, on an Elo system
  with full rating history.
- **Chat privately** with your opponent during an online game.
- **Ask the Pro tutor** to explain the position on your board. It reasons over the live position,
  runs its own Stockfish analysis as a tool call, and annotates the board with arrows and
  highlights rather than just replying in text.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, React Compiler) |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Base UI |
| 3D rendering | Three.js, React Three Fiber, drei, postprocessing (N8AO, bloom, SMAA) |
| Chess rules | chess.js |
| Chess engine | Stockfish 18 (WASM, NNUE) in a Web Worker, with an automatic Stockfish 11 fallback for browsers without WASM SIMD |
| Backend / data | Convex (reactive queries, mutations, scheduled functions, file storage) |
| Auth & billing | Clerk (accounts, sessions, subscriptions) |
| AI orchestration | Vercel AI SDK, Vercel Eve (agent runtime), AI Gateway |
| State | Zustand |
| Language | TypeScript, strict mode |

## Architecture at a glance

Three systems each own one job, and nothing else is allowed to do that job:

- **chess.js enforces the rules.** Legality, check, checkmate, and draw conditions all come from
  chess.js, on the server.
- **Stockfish calculates.** It runs client-side in a Web Worker and produces ranked candidate
  moves; it never talks to the language model directly.
- **The language model chooses or explains.** For an AI opponent, it picks among Stockfish's
  candidates and writes commentary in the opponent's persona. For the tutor, it reasons over the
  position, calls Stockfish itself as a tool, and emits schema-validated drawing instructions
  for the board overlay.

Convex is the single source of truth for game state: every move, from either board renderer, is
validated server-side before it is written, so the client can never desync the two renderers or
mutate a game it doesn't have write access to. `src/app/api/ai/_lib/game-guard.ts` re-derives the
caller's identity and their role in the game from Clerk and Convex on every AI request, so the
client only ever supplies a game id, never a position or a difficulty.

Two board renderers, `board2d/` and `board3d/`, share one `GameView` contract from
`src/lib/types.ts`, so either can render any game state without knowing how the other works.

For a full breakdown of the data model, request flow, and each feature's implementation, see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). For platform-level issues, accepted trade-offs, and
why certain workarounds exist, see [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md).

## Getting started

### Prerequisites

- Node.js 24+
- pnpm 11+
- A [Clerk](https://clerk.com) account
- A [Convex](https://convex.dev) account
- A [Vercel](https://vercel.com) account (for AI Gateway access; also used for deployment)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the Clerk keys from your Clerk dashboard (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`). The Convex variables (`CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL`) are written automatically the first time you run `npx convex dev`,
so you can leave them blank for now. See `.env.example` for the full list and what each variable
is for.

### 3. Connect Convex and Clerk

```bash
npx convex dev
```

This provisions (or connects to) your Convex deployment and writes the Convex environment
variables into `.env.local`. Then, on the Convex deployment itself (not in `.env.local`):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-frontend-api-domain>
```

In your Clerk dashboard, create a JWT template named `convex` with audience `convex` and a
`nickname` claim (Sixty4 reads the display name from it), and require a username at sign-up.

### 4. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. AI opponent and tutor

The AI opponent and the Pro tutor call a language model through the Vercel AI Gateway. Locally,
`vercel env pull` writes a `VERCEL_OIDC_TOKEN` that authenticates those calls; alternatively, set
`AI_GATEWAY_API_KEY` directly. Without a valid credential, the AI opponent falls back to a raw
Stockfish move and the tutor route returns a "temporarily unavailable" response rather than
failing the game.

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generate Next's route types, then run `tsc --noEmit` |
| `pnpm convex` | Start the Convex dev deployment |
| `pnpm copy:stockfish` | Refresh the committed Stockfish binaries under `public/stockfish/` from the installed engine packages (maintenance only; not needed for a normal setup) |
| `pnpm test` | Run unit + integration tests (Vitest) |
| `pnpm test:coverage` | Same, with a coverage report |
| `pnpm e2e` | Run end-to-end tests (Playwright) |

See [`TESTING.md`](TESTING.md) for what each test layer covers and what setup e2e needs.

## Project structure

```
src/app/            Next.js routes (App Router)
src/components/      UI, organized by feature area (board2d, board3d, game, landing, tutor, ...)
src/hooks/           Client-side hooks (game controller, AI turns, chat, shortcuts, ...)
src/lib/             Chess rules glue, the Stockfish engine client, the tutor pipeline, stores
agent/               Vercel Eve agent definition for the AI opponent
convex/              Schema, queries, mutations, and server-side game logic
public/models/       Chess piece 3D models
public/hdri/          Environment lighting maps
public/backdrops/    Room background imagery
public/stockfish/    Committed Stockfish WASM builds (sf18, sf11)
docs/                 Architecture reference and known platform issues
```

## Deployment

Sixty4 deploys to Vercel, with Convex and Clerk as separate managed services.

1. Deploy Convex functions: `npx convex deploy`.
2. Set `CLERK_JWT_ISSUER_DOMAIN` on the **production** Convex deployment, pointing at your Clerk
   **production** instance (a Clerk development instance is fine for local work, but has message
   and rate limits that make it unsuitable for real users).
3. Set the production Clerk keys, Convex URLs, and `EVE_SERVER_SECRET` as environment variables
   on your Vercel project.
4. Deploy the Next.js app to Vercel. `next.config.ts` wraps the app in `withEve`, which mounts the
   AI opponent's agent runtime as a Vercel Build Output service alongside the Next.js app, so no
   separate deployment step is needed for it.
5. Point your custom domain (this deployment uses `chess.swayam.space`) at the Vercel project,
   and add the same domain to your Clerk production instance's allowed origins.

Deploy Convex before Vercel whenever `convex/` has changed; the app will otherwise call functions
that don't exist yet on the new deployment.

## Author

Sixty4 was built by Swayam Swarup Panda. Play it live at
[https://chess.swayam.space](https://chess.swayam.space).

## Third-party assets and licenses

This project's own source is not otherwise licensed for reuse; all rights are reserved unless a
license is added. The following bundled third-party assets keep their original licenses and
required attributions regardless:

- **Chess piece models** by Jarlan Perez, via [Poly Pizza](https://poly.pizza), licensed
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Attribution is shown in-app under
  Settings, and full details are in [`public/models/ATTRIBUTION.md`](public/models/ATTRIBUTION.md).
- **HDRI environments and backdrops** from [Poly Haven](https://polyhaven.com), licensed CC0. Details in
  [`public/backdrops/ATTRIBUTION.md`](public/backdrops/ATTRIBUTION.md).
- **Stockfish 18 and Stockfish 11**, licensed GPL v3. License files ship alongside the engine binaries in
  `public/stockfish/`.

If you remove or replace any of these assets, remove the corresponding attribution; if you keep
them, keep the attribution intact, it's a condition of the license, not a suggestion.

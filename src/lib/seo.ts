// src/lib/seo.ts
// Single source of truth for site-wide SEO values, so the name, base URL, and
// default description can't drift between layout.tsx, sitemap.ts, robots.ts,
// and the OG image generator.

/**
 * Falls back to the production domain when NEXT_PUBLIC_SITE_URL isn't set
 * (e.g. a local `pnpm build`). Set NEXT_PUBLIC_SITE_URL in preview/staging
 * deployments so their metadata and sitemap point at themselves, not prod.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chess.swayam.space";

export const SITE_NAME = "Sixty4";

export const SITE_DESCRIPTION =
  "Online 3D chess with real-time matchmaking, five AI opponents and custom rooms.";

/** Routes search engines should never crawl: they redirect to /sign-in for a
 *  signed-out visitor (so there is nothing there to index) or exist only for
 *  internal development/QA. */
export const DISALLOWED_ROUTES = ["/play", "/game", "/profile", "/settings", "/dev"];

// src/app/sitemap.ts
// Only the routes a signed-out visitor can actually reach. /play, /game/[id],
// /profile/[username], and /settings all sit behind auth.protect() in
// (protected)/layout.tsx, so an anonymous crawler gets redirected to /sign-in
// before it ever sees them - listing them here would just be noise (and
// profile URLs are per-user besides, not a fixed set this file could enumerate).
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pro`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${SITE_URL}/sign-in`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/sign-up`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}

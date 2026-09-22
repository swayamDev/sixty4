// src/app/robots.ts
import type { MetadataRoute } from "next";
import { DISALLOWED_ROUTES, SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: DISALLOWED_ROUTES,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

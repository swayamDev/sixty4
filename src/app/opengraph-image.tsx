// src/app/opengraph-image.tsx
// Default og:image for every route that doesn't define its own. Twitter's
// crawler falls back to og:image when no twitter:image is present, so this
// covers both without a duplicate twitter-image route.
import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} - ${SITE_DESCRIPTION}`;

// Dark theme's --bg/--fg/--accent from globals.css, inlined: ImageResponse
// renders in an isolated environment that can't read the app's CSS.
const BG = "#151916";
const FG = "#f0f2e9";
const ACCENT = "#bcccad";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: BG,
          color: FG,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              backgroundColor: ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 700,
              color: BG,
            }}
          >
            64
          </div>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>
        <div style={{ marginTop: 32, fontSize: 32, color: ACCENT, maxWidth: 900, lineHeight: 1.4 }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size },
  );
}

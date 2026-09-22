import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { PlayerSync } from "@/components/providers/player-sync";
import { SiteHeader } from "@/components/nav/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/**
 * Display face (UI_REDESIGN §1.2) - headlines only. `wght` is the default axis and
 * must not be listed; `opsz`/`SOFT`/`WONK` are the extra ones the `.font-display`
 * utility in globals.css pins with `font-variation-settings`.
 */
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
  },
};

/**
 * Organization + WebSite JSON-LD (schema.org), rendered on every page since
 * it describes the site itself rather than any one page's content. Kept to
 * fields we can state as fact from this repo: no invented review counts,
 * ratings, or pricing.
 */
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

/**
 * The Clerk card headings name the CLERK APPLICATION, which is not this product's name.
 * Overriding them here is the only way to say "Sixty4" on the auth screens without a
 * dashboard change - and the copy voice of UI_REDESIGN §2 applies to them like anything
 * else: sentence case, plain verbs, no exclamation marks.
 */
const CLERK_COPY = {
  signIn: {
    start: {
      title: "Sign in to Sixty4",
      subtitle: "Welcome back. Pick up where you left off.",
    },
  },
  signUp: {
    start: {
      title: "Join Sixty4",
      subtitle: "Free, and it runs in your browser.",
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          // Static, repo-authored JSON; not user input, so no injection risk.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Provider order is mandatory: Clerk must wrap Convex so
            ConvexProviderWithClerk can read the Clerk context. */}
        <ClerkProvider afterSignOutUrl="/" localization={CLERK_COPY}>
          <ConvexClientProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
              <TooltipProvider>
                <PlayerSync />
                <SiteHeader />
                <main className="flex-1">{children}</main>
                <Toaster position="top-center" richColors />
              </TooltipProvider>
            </ThemeProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

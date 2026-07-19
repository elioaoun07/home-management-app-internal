// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    if (isServer) {
      // Prevent the Azure Speech SDK (browser-only) from being analyzed server-side.
      // It's loaded via dynamic import() in client components only.
      const externals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [...externals, "microsoft-cognitiveservices-speech-sdk"];
    }
    return config;
  },

  async rewrites() {
    // Serve the generated read-only PM Command Center (public/pm.html, built by
    // `pnpm pm:public` / prebuild) at a clean /pm URL. A rewrite (not redirect)
    // keeps the browser URL as /pm so the pm.webmanifest scope "/pm" matches and
    // the installed PWA launches correctly.
    return [{ source: "/pm", destination: "/pm.html" }];
  },

  async headers() {
    // Security headers applied to all routes
    // Note: Adjust CSP connect-src/script-src to include any third-party domains you intentionally use.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // blob: is required by onnxruntime-web (used by @imgly/background-removal
    // for on-device garment cutouts): it wraps the fetched WASM binary in a
    // blob: URL and then fetch()es that URL to feed the streaming compiler —
    // that fetch is governed by connect-src, not script-src. Without it the
    // failure is a generic "TypeError: Failed to fetch" with no indication
    // it's a CSP block; only the browser's own CSP violation console log
    // (separate from the thrown error) names connect-src as the culprit.
    const connectSrc = ["'self'", "https:", "wss:", "blob:"];
    // blob: + 'wasm-unsafe-eval' are required by the same WASM backend: its
    // dynamic import() of the blob: glue module is governed by script-src
    // (not worker-src) — without these it fails with "no available backend
    // found" instead.
    const scriptSrc = ["'self'", "'unsafe-inline'", "blob:", "'wasm-unsafe-eval'"];
    const styleSrc = ["'self'", "'unsafe-inline'", "https:"];
    const mediaSrc = ["'self'", "blob:", "data:"];

    if (supabaseUrl) {
      try {
        const u = new URL(supabaseUrl);
        // Allow calling your Supabase project's origin for REST, auth, realtime, and storage
        connectSrc.push(u.origin);
        mediaSrc.push(u.origin);
      } catch {
        // ignore parse errors
      }
    }

    const ContentSecurityPolicy = [
      "default-src 'self'",
      `script-src ${scriptSrc.join(" ")}`,
      `style-src ${styleSrc.join(" ")}`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src ${connectSrc.join(" ")}`,
      `media-src ${mediaSrc.join(" ")}`,
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Allow service workers and workers
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; ");

    const securityHeaders = [
      { key: "Content-Security-Policy", value: ContentSecurityPolicy },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "Permissions-Policy", value: "interest-cohort=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      // "credentialless" (not "require-corp") enables crossOriginIsolated —
      // required for SharedArrayBuffer, which the on-device garment cutout
      // WASM (@imgly/background-removal) needs unconditionally — without
      // blocking cross-origin resources that lack CORP headers (Supabase
      // Storage images, Google Fonts). No popup+window.opener flow exists in
      // this app (Google Calendar OAuth is a redirect, not a popup), so COOP:
      // same-origin above is safe too.
      { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
      { key: "Cross-Origin-Resource-Policy", value: "same-site" },
    ];

    return [
      {
        // Immutable cache for fingerprinted JS/CSS chunks — browser won't even check the server
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
    ],
  },
};

export default nextConfig;

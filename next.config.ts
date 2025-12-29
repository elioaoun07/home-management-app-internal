// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Security headers applied to all routes
    // Note: Adjust CSP connect-src/script-src to include any third-party domains you intentionally use.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const connectSrc = ["'self'", "https:", "wss:"];
    const scriptSrc = ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"];
    const styleSrc = ["'self'", "'unsafe-inline'", "https:"];

    if (supabaseUrl) {
      try {
        const u = new URL(supabaseUrl);
        // Allow calling your Supabase project's origin for REST, auth, and realtime
        connectSrc.push(u.origin);
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
      { key: "Cross-Origin-Resource-Policy", value: "same-site" },
    ];

    return [
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
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;

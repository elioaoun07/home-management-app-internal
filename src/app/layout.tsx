import ConditionalHeader from "@/components/layouts/ConditionalHeader";
import MobileNav from "@/components/layouts/MobileNav";
import { Toaster } from "@/components/ui/sonner";
import { supabaseServerRSC } from "@/lib/supabase/server";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Budget Manager • Smart Expense Tracking",
  description:
    "Track expenses, manage budgets, and gain insights into your spending habits",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Budget Manager",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#6366f1",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch user data in server component
  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName = user
    ? ((user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email ??
      "User")
    : "Guest";

  const userEmail = user?.email ?? "";
  const avatarUrl = user
    ? ((user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined))
    : undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Early theme apply to avoid flash of incorrect theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var stored = localStorage.getItem('hm-theme');
                  var theme = stored || 'system';
                  var d = document.documentElement;
                  if (theme === 'system') {
                    var m = window.matchMedia('(prefers-color-scheme: dark)');
                    if (m.matches) d.classList.add('dark');
                    else d.classList.remove('dark');
                  } else if (theme === 'dark') {
                    d.classList.add('dark');
                  } else {
                    d.classList.remove('dark');
                  }
                  
                  // Apply color theme (blue or pink)
                  var colorTheme = localStorage.getItem('color-theme') || 'blue';
                  document.body.setAttribute('data-theme', colorTheme);
                } catch(e) {}
              })();
            `,
          }}
        />
        <Providers>
          {/* Conditional header - hidden on expense page */}
          {user && (
            <ConditionalHeader
              userName={userName}
              userEmail={userEmail}
              avatarUrl={avatarUrl}
            />
          )}
          {children}
          <MobileNav />
          <Toaster
            richColors
            closeButton
            position="top-center"
            toastOptions={{
              style: {
                background: "hsl(var(--header-bg))",
                border: "1px solid hsl(var(--header-border))",
                color: "hsl(var(--foreground))",
              },
              className: "neo-card",
              actionButtonStyle: {
                background: "hsl(var(--nav-text-primary))",
                color: "hsl(var(--background))",
                border: "none",
                fontWeight: "600",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}

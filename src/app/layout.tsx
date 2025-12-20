import AIChatAssistant from "@/components/ai/AIChatAssistant";
import { EagerDataPrefetch } from "@/components/EagerDataPrefetch";
import { ErrorLogger } from "@/components/ErrorLogger";
import SplitBillHandler from "@/components/expense/SplitBillHandler";
import ConditionalHeader from "@/components/layouts/ConditionalHeader";
import GuestHeader from "@/components/layouts/GuestHeader";
import MobileNav from "@/components/layouts/MobileNav";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { Toaster } from "@/components/ui/sonner";
import { SplitBillProvider } from "@/contexts/SplitBillContext";
import { UserProvider } from "@/contexts/UserContext";
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
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        {/* Google Fonts - Handwriting for Notes */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Handlee&display=swap"
          rel="stylesheet"
        />
        {/* Critical early CSS to prevent ANY flash of wrong theme color */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var colorTheme = localStorage.getItem('color-theme') || 'blue';
                  var bgColor = colorTheme === 'pink' ? '#1a0a14' : '#0a1628';
                  
                  // Create and inject critical CSS immediately with highest specificity
                  var style = document.createElement('style');
                  style.id = 'critical-theme-css';
                  style.innerHTML = 'html,html body,body{background-color:' + bgColor + '!important;background:' + bgColor + '!important;}';
                  document.head.appendChild(style);
                  
                  // Set data-theme attribute on html element
                  document.documentElement.setAttribute('data-theme', colorTheme);
                  document.documentElement.style.backgroundColor = bgColor;
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="overflow-x-hidden">
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
                  
                  // Apply color theme (blue or pink) - reinforce the data-theme attribute
                  var colorTheme = localStorage.getItem('color-theme') || 'blue';
                  document.documentElement.setAttribute('data-theme', colorTheme);
                  
                  // Set body background immediately based on theme to prevent flash
                  document.body.style.backgroundColor = colorTheme === 'pink' ? '#1a0a14' : '#0a1628';
                } catch(e) {}
              })();
            `,
          }}
        />
        <Providers>
          <UserProvider
            userData={
              user ? { name: userName, email: userEmail, avatarUrl } : null
            }
          >
            <SplitBillProvider>
              {/* Eager prefetch critical data immediately on app load */}
              {user && <EagerDataPrefetch />}
              <ServiceWorkerRegistration />
              <ErrorLogger />
              {/* Conditional header - show user menu when logged in, login button when logged out */}
              {user ? (
                <ConditionalHeader
                  userName={userName}
                  userEmail={userEmail}
                  avatarUrl={avatarUrl}
                />
              ) : (
                <GuestHeader />
              )}
              {children}
              <MobileNav />
              {user && <AIChatAssistant />}
              {user && <SplitBillHandler />}
              <Toaster
                richColors
                closeButton
                position="top-center"
                toastOptions={{
                  style: {
                    background: "hsl(var(--header-bg))",
                    border: "1px solid hsl(var(--header-border))",
                    color: "hsl(var(--foreground))",
                    backdropFilter: "blur(12px)",
                  },
                  className: "neo-card shadow-2xl",
                  actionButtonStyle: {
                    background: "hsl(var(--nav-text-primary))",
                    color: "hsl(var(--background))",
                    border: "none",
                    fontWeight: "600",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  },
                  duration: 3000,
                }}
              />
            </SplitBillProvider>
          </UserProvider>
        </Providers>
      </body>
    </html>
  );
}

import {
  ArrowRightIcon,
  BarChart3Icon,
  ClockIcon,
  ShieldIcon,
  ZapIcon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { supabaseServerRSC } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  // Check if user is already logged in
  const supabase = await supabaseServerRSC();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If already authenticated, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Hero Section */}
      <div className="relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/60 mb-4 ring-8 ring-primary/10 shadow-2xl shadow-primary/20">
              <BarChart3Icon className="w-10 h-10 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.7)]" />
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              Manage Your Finances
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                Simple & Smart
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Track expenses, manage budgets, and gain insights into your
              spending habits with our intuitive home management app.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                asChild
                size="lg"
                className="h-12 px-8 text-base group shadow-lg hover:shadow-xl"
              >
                <Link href="/signup">
                  Get Started Free
                  <ArrowRightIcon className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1 drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base shadow-sm hover:shadow-md"
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Everything you need to manage your money
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Powerful features designed to make expense tracking effortless
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Feature 1 */}
          <div className="group p-6 rounded-2xl bg-[#0f1d2e]/80 backdrop-blur-sm shadow-[0_0_0_1px_rgba(6,182,212,0.2)_inset] hover:bg-[#0f1d2e] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4)_inset,0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300 hover:-translate-y-2 shimmer transform-3d">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-lg shadow-primary/10 glow-pulse-primary">
              <ZapIcon className="w-6 h-6 text-primary drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Quick Entry</h3>
            <p className="text-muted-foreground leading-relaxed">
              Add expenses in seconds with voice commands or quick templates
            </p>
          </div>

          {/* Feature 2 */}
          <div
            className="group p-6 rounded-2xl bg-[#0f1d2e]/80 backdrop-blur-sm shadow-[0_0_0_1px_rgba(6,182,212,0.2)_inset] hover:bg-[#0f1d2e] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4)_inset,0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300 hover:-translate-y-2 shimmer transform-3d"
            style={{ animationDelay: "100ms" }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-lg shadow-primary/10 glow-pulse-primary">
              <BarChart3Icon className="w-6 h-6 text-primary drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Analytics</h3>
            <p className="text-muted-foreground leading-relaxed">
              Visualize spending patterns and make informed financial decisions
            </p>
          </div>

          {/* Feature 3 */}
          <div
            className="group p-6 rounded-2xl bg-[#0f1d2e]/80 backdrop-blur-sm shadow-[0_0_0_1px_rgba(6,182,212,0.2)_inset] hover:bg-[#0f1d2e] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4)_inset,0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300 hover:-translate-y-2 shimmer transform-3d"
            style={{ animationDelay: "200ms" }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-lg shadow-primary/10 glow-pulse-primary">
              <ClockIcon className="w-6 h-6 text-primary drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-time Sync</h3>
            <p className="text-muted-foreground leading-relaxed">
              Access your data anywhere, anytime with instant synchronization
            </p>
          </div>

          {/* Feature 4 */}
          <div
            className="group p-6 rounded-2xl bg-[#0f1d2e]/80 backdrop-blur-sm shadow-[0_0_0_1px_rgba(6,182,212,0.2)_inset] hover:bg-[#0f1d2e] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4)_inset,0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300 hover:-translate-y-2 shimmer transform-3d"
            style={{ animationDelay: "300ms" }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-lg shadow-primary/10 glow-pulse-primary">
              <ShieldIcon className="w-6 h-6 text-primary drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
            <p className="text-muted-foreground leading-relaxed">
              Your financial data is encrypted and protected with industry
              standards
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-[#0f1d2e] via-[#1a2942] to-[#0a1628] shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset,0_0_40px_rgba(59,130,246,0.4)] p-12 text-center backdrop-blur-sm shimmer glow-pulse-primary transform-3d hover:scale-[1.02] transition-all duration-500">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to take control of your finances?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of users who are already managing their expenses
            smarter
          </p>
          <Button
            asChild
            size="lg"
            className="h-12 px-8 text-base group shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all spring-bounce"
          >
            <Link href="/signup">
              Start Free Today
              <ArrowRightIcon className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1 drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

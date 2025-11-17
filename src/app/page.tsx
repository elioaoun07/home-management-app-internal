import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Clock, Shield, Zap } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-4 ring-8 ring-primary/5">
              <BarChart3 className="w-10 h-10 text-primary" />
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              Manage Your Finances
              <br />
              <span className="bg-clip-text text-transparent bg-linear-to-r from-primary to-primary/60">
                Simple & Smart
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Track expenses, manage budgets, and gain insights into your
              spending habits with our intuitive home management app.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button asChild size="lg" className="h-12 px-8 text-base group">
                <Link href="/signup">
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Everything you need to manage your money
          </h2>
          <p className="text-muted-foreground text-lg">
            Powerful features designed to make expense tracking effortless
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Feature 1 */}
          <div className="group p-6 rounded-2xl border border-border bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Quick Entry</h3>
            <p className="text-muted-foreground">
              Add expenses in seconds with voice commands or quick templates
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group p-6 rounded-2xl border border-border bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Analytics</h3>
            <p className="text-muted-foreground">
              Visualize spending patterns and make informed financial decisions
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group p-6 rounded-2xl border border-border bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-time Sync</h3>
            <p className="text-muted-foreground">
              Access your data anywhere, anytime with instant synchronization
            </p>
          </div>

          {/* Feature 4 */}
          <div className="group p-6 rounded-2xl border border-border bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
            <p className="text-muted-foreground">
              Your financial data is encrypted and protected with industry
              standards
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="rounded-3xl bg-primary/5 border border-primary/10 p-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Ready to take control of your finances?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of users who are already managing their expenses
            smarter
          </p>
          <Button asChild size="lg" className="h-12 px-8 text-base group">
            <Link href="/signup">
              Start Free Today
              <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

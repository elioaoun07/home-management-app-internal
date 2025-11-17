"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadCredentials, saveCredentials } from "@/lib/auth/credentials";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

// Page component: wraps the part that reads search params in <Suspense>
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-background to-muted/20">
          <div className="w-full max-w-md p-8 rounded-2xl bg-card/50 backdrop-blur-sm animate-pulse" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

// Inner component: actually uses useSearchParams (now inside Suspense)
function LoginContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  // Load saved credentials on mount
  useEffect(() => {
    const saved = loadCredentials();
    if (saved) {
      setUsername(saved.username);
      setRememberMe(saved.rememberMe);
    }
  }, []);

  useEffect(() => {
    if (!errorParam) return;
    const message =
      errorParam === "missing"
        ? "Please enter email and password."
        : errorParam === "invalid"
          ? "Invalid email or password."
          : "Something went wrong. Please try again.";
    toast.error(message);
  }, [errorParam]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    if (!username.trim() || !password) {
      e.preventDefault();
      toast.error("Please enter username and password");
      return;
    }

    // Save credentials if "Remember Me" is checked
    saveCredentials(username, rememberMe);
    setIsLoading(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 ring-8 ring-primary/5">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-8 shadow-2xl border-border/50 backdrop-blur-sm bg-card/95">
          {errorParam && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
                <span>
                  {errorParam === "missing" &&
                    "Please enter email and password."}
                  {errorParam === "invalid" && "Invalid email or password."}
                  {errorParam === "internal" &&
                    "Something went wrong. Please try again."}
                </span>
              </div>
            </div>
          )}

          <form
            onSubmit={submit}
            action="/api/auth/login"
            method="post"
            className="space-y-5"
          >
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-10 h-11 transition-all focus:ring-2 focus:ring-primary/20"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 h-11 transition-all focus:ring-2 focus:ring-primary/20"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) =>
                    setRememberMe(checked as boolean)
                  }
                  disabled={isLoading}
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer select-none"
                >
                  Remember me
                </Label>
              </div>
              <Button asChild variant="link" size="sm" className="px-0 h-auto">
                <Link href="/reset-password">Forgot password?</Link>
              </Button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium group"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </Button>
          </form>
        </Card>

        {/* Sign Up Link */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Button
              asChild
              variant="link"
              className="px-1 h-auto text-sm font-medium"
            >
              <Link href="/signup">Sign up for free</Link>
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadCredentials, saveCredentials } from "@/lib/auth/credentials";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useRef, useState } from "react";
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
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savedUsername, setSavedUsername] = useState("");

  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  // Load saved credentials on mount
  useEffect(() => {
    const saved = loadCredentials();
    if (saved) {
      setSavedUsername(saved.username);
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
          : errorParam === "not_confirmed"
            ? "Please confirm your email address. Check your inbox for a confirmation link."
            : "Something went wrong. Please try again.";
    toast.error(message);
    setIsLoading(false);
  }, [errorParam]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const email = formData.get("username") as string;
    const pass = formData.get("password") as string;

    if (!email?.trim() || !pass) {
      toast.error("Please enter email and password");
      return;
    }

    setIsLoading(true);
    saveCredentials(email, rememberMe);

    // Submit form directly to the API route
    e.currentTarget.action = "/api/auth/login";
    e.currentTarget.method = "POST";
    e.currentTarget.submit();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 ring-8 ring-primary/5">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
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
                  {errorParam === "not_confirmed" &&
                    "Please confirm your email address. Check your inbox for a confirmation link."}
                  {errorParam === "internal" &&
                    "Something went wrong. Please try again."}
                </span>
              </div>
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
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
                  defaultValue={savedUsername}
                  placeholder="you@example.com"
                  className="pl-10 h-11 transition-all focus:ring-2 focus:ring-primary/20"
                  disabled={isLoading}
                  required
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
                  placeholder="Enter your password"
                  className="pl-10 h-11 transition-all focus:ring-2 focus:ring-primary/20"
                  disabled={isLoading}
                  required
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

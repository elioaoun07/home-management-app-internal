"use client";

import {
  ArrowRightIcon,
  KeyRoundIcon,
  MailIcon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadCredentials, saveCredentials } from "@/lib/auth/credentials";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { loginAction } from "./actions";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" />
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [savedEmail, setSavedEmail] = useState("");
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  useEffect(() => {
    const saved = loadCredentials();
    if (saved) {
      setSavedEmail(saved.username);
      setRememberMe(saved.rememberMe);
    }
  }, []);

  useEffect(() => {
    if (errorParam) {
      toast.error(
        errorParam === "missing"
          ? "Please enter email and password"
          : "Invalid email or password"
      );
    }
  }, [errorParam]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    saveCredentials(email, rememberMe);

    try {
      const result = await loginAction(formData);
      if (result?.error) {
        toast.error(result.error);
        setIsLoading(false);
      }
      // If successful, loginAction will redirect
    } catch (error) {
      console.error("Login failed:", error);
      toast.error("Login failed. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      </div>

      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 mb-4 ring-8 ring-primary/10 shadow-2xl shadow-primary/20">
            <KeyRoundIcon className="w-8 h-8 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">
            Sign in to continue to your account
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground drop-shadow-[0_0_6px_rgba(148,163,184,0.4)]" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={savedEmail}
                  placeholder="you@example.com"
                  className="pl-10 h-11 transition-all focus:ring-2 focus:ring-primary/20"
                  disabled={isLoading}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <KeyRoundIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground drop-shadow-[0_0_6px_rgba(148,163,184,0.4)]" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  className="pl-10 h-11 transition-all focus:ring-2 focus:ring-primary/20"
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
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
                  <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
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

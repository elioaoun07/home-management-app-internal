"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/client";
import { safeFetch } from "@/lib/safeFetch";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ResetConfirmPage() {
  const [token, setToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [originMismatch, setOriginMismatch] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Support token in hash (#access_token=...), query (?access_token=...), or `code` param
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, "?")
    );
    const accessToken = hashParams.get("access_token");
    if (accessToken) {
      setToken(accessToken);
      setManualToken(accessToken);
      // Try to extract and store session from URL (if available) so client can update password directly.
      const supabase = supabaseBrowser();
      const authAny: any = supabase.auth as any;
      if (typeof authAny.getSessionFromUrl === "function") {
        authAny
          .getSessionFromUrl({ storeSession: true })
          .then(() => setSessionReady(true))
          .catch(() => {});
      }
      return;
    }

    const q = new URLSearchParams(window.location.search);
    // common names: access_token, token, code
    const detected = q.get("access_token") || q.get("token") || q.get("code");
    setToken(detected);
    setManualToken(detected);
    const emailQ = q.get("email");
    if (emailQ) setEmail(emailQ);
    // capture URL only on client to avoid SSR/client mismatch
    setCurrentUrl(window.location.href);
    // If we have a `code` style link, exchange it for a session immediately to avoid expiry issues
    if (detected && !detected.includes(".")) {
      const supabase = supabaseBrowser();
      const authAny: any = supabase.auth as any;
      if (typeof authAny.exchangeCodeForSession === "function") {
        authAny
          .exchangeCodeForSession(window.location.href)
          .then(() => setSessionReady(true))
          .catch((err: any) => {
            // Fallback try: getSessionFromUrl may also work depending on SDK
            if (typeof authAny.getSessionFromUrl === "function") {
              authAny
                .getSessionFromUrl({ storeSession: true })
                .then(() => setSessionReady(true))
                .catch(() => {
                  console.error("Session exchange failed", err);
                });
            }
          });
      }
    }
    // Check env origin vs current origin if env is provided
    const envOrigin = process.env.NEXT_PUBLIC_APP_URL;
    if (envOrigin) {
      try {
        const envUrl = new URL(envOrigin);
        const cur = new URL(window.location.href);
        if (envUrl.origin !== cur.origin) {
          setOriginMismatch(
            `Env origin ${envUrl.origin} does not match current origin ${cur.origin}. This can cause Supabase to send a recovery code instead of an access_token.`
          );
        }
      } catch {}
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalToken = manualToken || token;
    if (!finalToken) return toast.error("Missing token");
    if (!newPassword) return toast.error("Enter a new password");
    if (newPassword !== confirmPassword)
      return toast.error("Passwords do not match");

    try {
      if (sessionReady) {
        // We have an authenticated session on the client; update password directly via client
        const supabase = supabaseBrowser();
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        } as any);
        if (error) {
          setServerMessage(error.message || "Failed to reset password");
          toast.error(error.message || "Failed to reset password");
          return;
        }
        toast.success("Password updated. You can now sign in.");
        window.location.href = "/login";
      } else {
        // Fallback to server route which supports JWT or code+email verify
        const res = await safeFetch("/api/auth/reset", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            access_token: finalToken,
            email,
            password: newPassword,
          }),
        });
        if (res.ok) {
          toast.success("Password updated. You can now sign in.");
          window.location.href = "/login";
        } else {
          const data = await res.json().catch(() => null);
          const text = data?.message || data?.error || (await res.text());
          setServerMessage(text || "Failed to reset password");
          toast.error(text || "Failed to reset password");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    }
  }

  async function resendReset() {
    if (!email) {
      toast.error("Enter your email above first");
      return;
    }
    try {
      const res = await safeFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        toast.success("If that email exists, a new reset link was sent.");
        setServerMessage(
          "A new reset link was sent. Please use the newest email within a few minutes."
        );
      } else {
        const text = await res.text();
        toast.error(text || "Failed to send reset email");
      }
    } catch (e) {
      toast.error("Network error while sending reset email");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Set a new password</h2>
        <div className="mb-4 p-3 rounded bg-muted">
          <div className="text-xs text-muted-foreground mb-2">
            Debug: detected token / URL (you can paste a token here to test)
          </div>
          <div className="text-xs break-words mb-2">URL: {currentUrl}</div>
          {originMismatch ? (
            <div className="text-xs text-red-600 mb-2">{originMismatch}</div>
          ) : null}
          <div className="mb-2">
            <Label>Detected token</Label>
            <Input
              value={manualToken ?? ""}
              onChange={(e) => setManualToken(e.target.value)}
            />
          </div>
          {manualToken && /^[0-9a-fA-F-]{20,}$/.test(manualToken) ? (
            <div className="mt-2 text-sm text-yellow-600">
              It looks like this link contains a one-time recovery code (not a
              JWT). If the password reset fails with a "token_malformed" error,
              ensure that:
              <ul className="list-disc ml-5">
                <li>
                  Your env var `NEXT_PUBLIC_APP_URL` exactly matches your app
                  origin (including port).
                </li>
                <li>
                  The same origin is configured in Supabase → Authentication →
                  Settings (Site URL / Allowed redirect URLs).
                </li>
              </ul>
              <div className="mt-2">
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    navigator.clipboard?.writeText(manualToken || "")
                  }
                >
                  Copy code to clipboard
                </button>
                <span className="mx-2">·</span>
                <button
                  type="button"
                  className="underline"
                  onClick={resendReset}
                >
                  Send me a new reset email
                </button>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Codes expire quickly and are single-use. Open the newest email
                and use it promptly.
              </div>
            </div>
          ) : null}
          {serverMessage ? (
            <div className="mt-2 text-sm text-red-600">{serverMessage}</div>
          ) : null}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Email (required if the link contains a code)</Label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>New password</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>Confirm password</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Set password</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

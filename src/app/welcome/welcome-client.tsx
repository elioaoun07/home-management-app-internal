"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

export default function WelcomeClient() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [enterCode, setEnterCode] = useState("");

  useEffect(() => {
    // ensure fresh state
    setError(null);
  }, []);

  async function chooseIndividual() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_type: "individual" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed");
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e?.message || "Failed to continue");
    } finally {
      setSubmitting(false);
    }
  }

  async function generateHouseholdCode() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_type: "household" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to generate");
      setGeneratedCode(data?.code || null);
    } catch (e: any) {
      setError(e?.message || "Failed to generate code");
    } finally {
      setSubmitting(false);
    }
  }

  async function claimHouseholdCode() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/household/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: enterCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to link");
      // Mark onboarding completed as household for the partner WITHOUT triggering owner code creation
      const res2 = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_type: "household" }),
      });
      const d2 = await res2.json().catch(() => ({}));
      if (!res2.ok) throw new Error(d2?.error || "Failed to finalize");
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e?.message || "Failed to link");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg p-6 page-transition">
      <h1 className="text-2xl font-semibold mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
        Welcome
      </h1>
      <p
        className="text-muted-foreground mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: "0.1s" }}
      >
        Choose how you want to use the app. You can switch later in Settings.
      </p>

      {error ? (
        <div className="text-sm text-red-600 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {error}
          {/Unauthorized/i.test(error) ? (
            <>
              {" "}
              <Button
                variant="link"
                className="px-1"
                onClick={() => (window.location.href = "/login")}
              >
                Go to login
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Individual option */}
      <section
        className="rounded-md bg-[#0f1d2e]/60 shadow-[0_0_0_1px_rgba(6,182,212,0.25)_inset] p-4 mb-4 transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4)_inset,0_0_20px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4"
        style={{ animationDelay: "0.2s", animationDuration: "0.5s" }}
      >
        <h3 className="font-medium mb-2">Use as an Individual</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Keep things simple with a personal account.
        </p>
        <Button
          onClick={chooseIndividual}
          disabled={submitting}
          className="transition-all hover:scale-105"
        >
          Continue as individual
        </Button>
      </section>

      {/* Household option */}
      <section
        className="rounded-md bg-[#0f1d2e]/60 shadow-[0_0_0_1px_rgba(6,182,212,0.25)_inset] p-4 space-y-6 transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4)_inset,0_0_20px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4"
        style={{ animationDelay: "0.3s", animationDuration: "0.5s" }}
      >
        <h3 className="font-medium">Use as a Household</h3>

        <div className="space-y-3">
          <div>
            <div className="font-medium mb-1">I am the household manager</div>
            <p className="text-sm text-muted-foreground mb-3">
              Generate a one-time code and share it with your partner.
            </p>
            {generatedCode ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">Your code</div>
                <div className="font-mono text-xl tracking-widest">
                  {generatedCode}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generatedCode!);
                      } catch {}
                    }}
                  >
                    Copy code
                  </Button>
                  <Button onClick={() => (window.location.href = "/dashboard")}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={generateHouseholdCode} disabled={submitting}>
                Generate code
              </Button>
            )}
          </div>

          <div className="pt-2">
            <div className="font-medium mb-1">I have a code</div>
            <div className="space-y-2">
              <Label htmlFor="code">Enter code</Label>
              <Input
                id="code"
                value={enterCode}
                onChange={(e) => setEnterCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7K4B2Q"
              />
              <Button
                onClick={claimHouseholdCode}
                disabled={submitting || enterCode.length < 4}
              >
                Link household
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

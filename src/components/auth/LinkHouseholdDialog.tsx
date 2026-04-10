"use client";

import { safeFetch } from "@/lib/safeFetch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export default function LinkHouseholdDialog({ open, onOpenChange }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await safeFetch("/api/household/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to link");
      setSuccess(true);
    } catch (e: any) {
      setError(e?.message || "Failed to link");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await safeFetch("/api/onboarding", {
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
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Household</DialogTitle>
          <DialogDescription>
            Generate a code or enter one to link accounts.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="enter">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="enter">Enter code</TabsTrigger>
            <TabsTrigger value="generate">Generate code</TabsTrigger>
          </TabsList>

          <TabsContent value="enter" className="mt-3">
            <form onSubmit={handleLink} className="space-y-3">
              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 7K4B2Q"
                  autoFocus
                />
              </div>
              {error ? (
                <div className="text-sm text-red-600">{error}</div>
              ) : null}
              {success ? (
                <div className="text-sm text-green-600">
                  Linked successfully.
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button type="submit" disabled={loading || code.length < 4}>
                  {loading ? "Linking…" : "Link"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="generate" className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              If you are the household manager, generate a code and share it
              with your partner.
            </p>
            {generatedCode ? (
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Your code
                </div>
                <div className="font-mono tracking-widest text-lg">
                  {generatedCode}
                </div>
              </div>
            ) : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={loading}>
                {loading
                  ? "Generating…"
                  : generatedCode
                    ? "Regenerate"
                    : "Generate code"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

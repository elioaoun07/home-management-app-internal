"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { safeFetch } from "@/lib/safeFetch";
import { toast } from "sonner";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );
    const at = hashParams.get("access_token");
    const rt = hashParams.get("refresh_token");
    if (at && rt) {
      setAccessToken(at);
      setRefreshToken(rt);
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    const body = new URLSearchParams({
      password,
      confirm,
      ...(accessToken ? { access_token: accessToken } : {}),
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    });

    const res = await safeFetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "follow",
    });

    if (!res.ok && res.status !== 302) {
      toast.error("Failed to update password");
      return;
    }

    router.push("/login?reset=1");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Set a new password</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex items-center justify-end">
            <Button type="submit">Update password</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

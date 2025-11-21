"use client";

import { SettingsDialog } from "@/components/settings/SettingsDialog";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--main-bg))] p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <SettingsDialog />
      </div>
    </div>
  );
}

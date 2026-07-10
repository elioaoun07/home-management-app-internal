// src/components/settings/GoogleCalendarSetupWizard.tsx
// Step-by-step guided wizard for setting up Google Calendar sync.
// Shows before a user connects; replaced by status view once connected.

"use client";

import { Button } from "@/components/ui/button";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Lock,
  Smartphone,
} from "lucide-react";
import { useState } from "react";

type WizardStep = "welcome" | "what-syncs" | "prerequisites" | "connect" | "success";

export function GoogleCalendarSetupWizard({ onConnectClick }: { onConnectClick: () => void }) {
  const tc = useThemeClasses();
  const [step, setStep] = useState<WizardStep>("welcome");

  const handleConnect = () => {
    onConnectClick();
    setStep("success");
  };

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar className={`w-5 h-5 ${tc.headerText}`} />
        <h4 className={`font-medium ${tc.text}`}>Google Calendar Backup Sync</h4>
      </div>

      {step === "welcome" && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${tc.bgSurface} border ${tc.border}`}>
            <p className={`text-sm ${tc.text} mb-3`}>
              <strong>Reliable backup alarms</strong> — even if push notifications are delayed or you're offline.
            </p>
            <ul className={`text-sm ${tc.textMuted} space-y-2`}>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>Your Reminders & Events sync to Google Calendar</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>Google's native alarms fire even when offline</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span>One-way backup — ERA is always the source of truth</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setStep("what-syncs")}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
            >
              Get Started
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === "what-syncs" && (
        <div className="space-y-4">
          <p className={`text-sm ${tc.textMuted}`}>What will sync to Google Calendar:</p>

          <div className="space-y-2">
            <div className={`p-3 rounded-lg ${tc.bgSurface} border border-green-500/20`}>
              <p className={`text-sm font-medium text-green-400 mb-1`}>✓ Will sync</p>
              <ul className={`text-xs ${tc.textMuted} space-y-1 ml-4`}>
                <li>• Reminders with due dates</li>
                <li>• Events with start/end times</li>
                <li>• Alert times (become Google reminders)</li>
                <li>• Recurring items (same recurrence pattern)</li>
              </ul>
            </div>

            <div className={`p-3 rounded-lg ${tc.bgSurface} border border-red-500/20`}>
              <p className={`text-sm font-medium text-red-400 mb-1`}>✗ Will NOT sync</p>
              <ul className={`text-xs ${tc.textMuted} space-y-1 ml-4`}>
                <li>• System alerts (daily reminders, budgets)</li>
                <li>• Items without dates</li>
                <li>• Completed/archived items</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setStep("welcome")}
              variant="outline"
              className={`w-full ${tc.border} border`}
            >
              Back
            </Button>
            <Button
              onClick={() => setStep("prerequisites")}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === "prerequisites" && (
        <div className="space-y-4">
          <p className={`text-sm ${tc.textMuted}`}>
            You'll need a <strong>Google account</strong>. That's it! We'll handle the rest.
          </p>

          <div className={`p-4 rounded-lg ${tc.bgSurface} border ${tc.border} space-y-3`}>
            <div className="flex gap-3">
              <Lock className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className={`text-sm font-medium ${tc.text}`}>Your data is secure</p>
                <p className={`text-xs ${tc.textMuted} mt-1`}>
                  We use OAuth 2.0 — Google never shares your password with us
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Smartphone className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className={`text-sm font-medium ${tc.text}`}>Offline-ready</p>
                <p className={`text-xs ${tc.textMuted} mt-1`}>
                  Google Calendar works offline — alarms fire even without internet
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Calendar className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className={`text-sm font-medium ${tc.text}`}>Dedicated calendar</p>
                <p className={`text-xs ${tc.textMuted} mt-1`}>
                  We create a separate "ERA" calendar so your items don't mix with personal events
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setStep("what-syncs")}
              variant="outline"
              className={`w-full ${tc.border} border`}
            >
              Back
            </Button>
            <Button
              onClick={() => setStep("connect")}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
            >
              Connect Now
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === "connect" && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg bg-blue-500/10 border border-blue-500/20`}>
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className={`text-sm font-medium text-blue-300`}>You'll be redirected to Google</p>
                <p className={`text-xs text-blue-300/70 mt-1`}>
                  Sign in with the account where you want your reminders to appear, then click "Allow" to authorize.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setStep("prerequisites")}
              variant="outline"
              className={`w-full ${tc.border} border`}
            >
              Back
            </Button>
            <Button
              onClick={handleConnect}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            >
              Connect to Google
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <p className={`text-xs ${tc.textMuted} text-center`}>
            You can skip this or disconnect anytime in Settings.
          </p>
        </div>
      )}

      {step === "success" && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center`}>
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className={`text-sm font-medium text-green-300 mb-2`}>Waiting for authorization...</p>
            <p className={`text-xs text-green-300/70`}>
              Redirecting to Google. You'll be back in seconds.
            </p>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {step !== "success" && (
        <div className="flex justify-center gap-1">
          {(["welcome", "what-syncs", "prerequisites", "connect"] as const).map((s) => {
            const stepOrder = (["welcome", "what-syncs", "prerequisites", "connect"] as const).indexOf(s);
            const currentOrder = (["welcome", "what-syncs", "prerequisites", "connect"] as const).indexOf(step as any);
            return (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  stepOrder <= currentOrder
                    ? "bg-cyan-500"
                    : `${tc.bgSurface}`
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

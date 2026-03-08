// src/app/g/drinks-admin/page.tsx
"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2, RefreshCw, Wine } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface DrinkOrder {
  id: string;
  guest_name: string | null;
  drink_selection: string;
  other_drink: string | null;
  created_at: string;
  updated_at: string;
  session_id: string;
}

interface AllergyRecord {
  id: string;
  guest_name: string | null;
  allergies: string;
  session_id: string;
  created_at: string;
}

const drinkLabels: Record<string, { label: string; emoji: string }> = {
  water: { label: "Just Water", emoji: "💧" },
  diet_pepsi: { label: "Diet Pepsi", emoji: "🥤" },
  diet_7up: { label: "Diet 7Up", emoji: "🧃" },
  red_wine: { label: "Red Wine", emoji: "🍷" },
  white_wine: { label: "White Wine", emoji: "🥂" },
  whisky_single: { label: "Whisky (Single Malt)", emoji: "🥃" },
  whisky_blended: { label: "Whisky (Blended)", emoji: "🥃" },
  meskalina: {
    label: "Meskalina pina titto lattatina kwervo sita tato vita panpaniyara",
    emoji: "🍓",
  },
  other: { label: "Other", emoji: "✨" },
};

export default function DrinksAdminPage() {
  const [drinks, setDrinks] = useState<DrinkOrder[]>([]);
  const [allergies, setAllergies] = useState<AllergyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagId, setTagId] = useState<string | null>(null);

  // First fetch the tag ID for "home"
  useEffect(() => {
    fetch("/api/guest-portal/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_slug: "home", fingerprint: "admin-check" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.tag?.id) {
          setTagId(data.tag.id);
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!tagId) return;
    setLoading(true);
    try {
      // Fetch drinks and allergies in parallel
      const [drinksRes, allergiesRes] = await Promise.all([
        fetch(`/api/guest-portal/drinks?tag_id=${tagId}&all=true`),
        fetch(`/api/guest-portal/allergies?tag_id=${tagId}&all=true`),
      ]);

      if (drinksRes.ok) {
        const data = await drinksRes.json();
        setDrinks(data.drinks || []);
      }
      if (allergiesRes.ok) {
        const data = await allergiesRes.json();
        setAllergies(data.allergies || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tagId]);

  useEffect(() => {
    if (tagId) {
      fetchData();
    }
  }, [tagId, fetchData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!tagId) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [tagId, fetchData]);

  // Create a map of session_id to allergies for quick lookup
  const allergyMap = allergies.reduce(
    (acc, a) => {
      acc[a.session_id] = a;
      return acc;
    },
    {} as Record<string, AllergyRecord>,
  );

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Group drinks by selection for summary
  const drinkSummary = drinks.reduce(
    (acc, d) => {
      const key = d.drink_selection;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="min-h-[100dvh] bg-[#0a1628] px-4 py-6">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-[#f59e0b]/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-[#ef4444]/8 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f59e0b]/25 to-[#ef4444]/15 flex items-center justify-center border border-[#f59e0b]/20">
              <Wine className="w-6 h-6 text-[#f59e0b]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Guest Orders</h1>
              <p className="text-xs text-[#38bdf8]/50">
                {drinks.length} drink{drinks.length !== 1 ? "s" : ""} •{" "}
                {allergies.length} allerg{allergies.length !== 1 ? "ies" : "y"}
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[#0f1d2e]/80 border border-[#f59e0b]/20 hover:border-[#f59e0b]/40 transition-all"
          >
            <RefreshCw
              className={cn(
                "w-4 h-4 text-[#f59e0b]",
                loading && "animate-spin",
              )}
            />
          </button>
        </div>

        {/* Summary Cards */}
        {Object.keys(drinkSummary).length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-[#0f1d2e]/70 border border-[#f59e0b]/15">
            <p className="text-[10px] uppercase tracking-wider text-[#f59e0b] font-semibold mb-3">
              Summary
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(drinkSummary).map(([key, count]) => {
                const info = drinkLabels[key] || { label: key, emoji: "🍹" };
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a1628]/60 border border-[#f59e0b]/10"
                  >
                    <span className="text-lg">{info.emoji}</span>
                    <span className="text-xs text-white/80">{info.label}</span>
                    <span className="text-xs font-bold text-[#f59e0b] bg-[#f59e0b]/15 px-2 py-0.5 rounded-full">
                      ×{count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && drinks.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#f59e0b]" />
          </div>
        )}

        {/* Empty state */}
        {!loading && drinks.length === 0 && (
          <div className="text-center py-20">
            <Wine className="w-12 h-12 mx-auto mb-3 text-[#f59e0b]/30" />
            <p className="text-sm text-[#38bdf8]/50">No drink orders yet</p>
            <p className="text-xs text-[#38bdf8]/30 mt-1">
              Guests can order from the portal
            </p>
          </div>
        )}

        {/* Orders list */}
        <div className="space-y-2">
          {drinks.map((order) => {
            const info = drinkLabels[order.drink_selection] || {
              label: order.drink_selection,
              emoji: "🍹",
            };
            const guestAllergy = allergyMap[order.session_id];
            return (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-[#0f1d2e]/70 border border-[#f59e0b]/10 hover:border-[#f59e0b]/25 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center text-xl">
                    {info.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {order.guest_name || "Anonymous Guest"}
                      </span>
                      <span className="text-[10px] text-[#38bdf8]/40">
                        {formatTime(order.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-[#f59e0b]">
                      {info.label}
                      {order.other_drink && (
                        <span className="text-[#38bdf8]/60">
                          {" "}
                          — {order.other_drink}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {/* Allergies */}
                {guestAllergy && (
                  <div className="mt-3 pt-3 border-t border-[#f59e0b]/10">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-amber-400 font-medium uppercase tracking-wide mb-0.5">
                          Allergies
                        </p>
                        <p className="text-xs text-[#38bdf8]/70">
                          {guestAllergy.allergies}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Standalone allergies (guests who submitted allergies but not drinks) */}
        {allergies.filter(
          (a) => !drinks.some((d) => d.session_id === a.session_id),
        ).length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold mb-3">
              ⚠️ Allergies Only (No Drink Selected)
            </p>
            <div className="space-y-2">
              {allergies
                .filter(
                  (a) => !drinks.some((d) => d.session_id === a.session_id),
                )
                .map((allergy) => (
                  <div
                    key={allergy.id}
                    className="p-4 rounded-2xl bg-[#0f1d2e]/70 border border-amber-500/15"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {allergy.guest_name || "Anonymous Guest"}
                          </span>
                          <span className="text-[10px] text-[#38bdf8]/40">
                            {formatTime(allergy.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-[#38bdf8]/70 mt-1">
                          {allergy.allergies}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-[#38bdf8]/30 text-center mt-8">
          Auto-refreshes every 10 seconds
        </p>
      </div>
    </div>
  );
}

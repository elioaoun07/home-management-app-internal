// src/features/era/intents/resolvers/slotBuilders.ts
// HUB-78 — pure builders for a one-question chip turn (EraPendingSlot).
// Kept import-free of the resolvers so budget.ts and slots.ts can both use
// them without a cycle.

import type { EraArtifact } from "@/lib/era/artifacts";
import type { EraActiveProposal, EraChipOption, EraPendingSlot, EraPendingTurn } from "../../types";

export interface SlotResult {
  text: string;
  metadata?: Record<string, unknown>;
  ok?: boolean;
  pending?: EraPendingTurn | null;
  proposal?: EraActiveProposal;
  artifacts?: EraArtifact[];
  /** HUB-94 — a write done before (or while) asking keeps its Undo. */
  undo?: () => Promise<boolean>;
  /** HUB-94 — a page door (e.g. repeating events → the form). */
  navigate?: string;
}

export function slot(
  capability: EraPendingSlot["capability"],
  slotName: string,
  question: string,
  options: EraChipOption[],
  args: Record<string, unknown>,
  rawText: string,
): SlotResult {
  return {
    text: question,
    metadata: { asked: capability, slot: slotName },
    ok: false,
    pending: { kind: "slot", capability, slot: slotName, question, options, args, rawText, createdAt: Date.now() },
  };
}

/** `I took 300$ from Drawer` → Drawer → [Wallet] [Savings] [Other]. */
export function transferSlot(args: {
  amount: number;
  currency?: string;
  fromName?: string;
  toName?: string;
  candidates: Array<{ name: string }>;
  rawText: string;
  question: string;
}): SlotResult {
  const missing = args.fromName ? "to" : "from";
  const known = args.fromName ?? args.toName ?? "";
  const params = new URLSearchParams({ transfer: "refill-wallet", amount: String(args.amount) });
  if (args.fromName) params.set("from", args.fromName);
  if (args.toName) params.set("to", args.toName);
  const options: EraChipOption[] = [
    ...args.candidates
      .filter((a) => a.name !== known)
      .slice(0, 3)
      .map((a) => ({ label: a.name, value: a.name })),
    { label: "Other", value: `nav:/expense?${params.toString()}` },
  ];
  return slot(
    "transfer.create",
    missing,
    args.question,
    options,
    { amount: args.amount, currency: args.currency, fromName: args.fromName, toName: args.toName },
    args.rawText,
  );
}

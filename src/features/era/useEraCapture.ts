"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMyAccounts } from "@/features/accounts/hooks";
import {
  useCategories,
  type UICategory,
} from "@/features/categories/useCategoriesQuery";
import type { HubChatThread } from "@/features/hub/hooks";
import { useMerchantMappings } from "@/hooks/useMerchantMappings";
import {
  preferredThread,
  recallExpense,
  recallGroup,
  type MemoryExpense,
} from "@/lib/era/captureMemory";
import { matchMerchantMapping, resolveCategoryRef } from "@/lib/merchantMatch";
import { parseSpeechExpense } from "@/lib/nlp/speechExpense";
import { parseSmartText } from "@/lib/smartTextParser";
import { safeFetch } from "@/lib/safeFetch";
import { qk } from "@/lib/queryKeys";
import { CACHE_TIMES } from "@/lib/queryConfig";
import type { MerchantMapping } from "@/types/statement";
import { formatDate } from "@/lib/utils/date";
import {
  captureAmount,
  captureSchema,
  captureSeed,
  detectCapture,
  shoppingLines,
  type CaptureKind,
  type NativeCapture,
} from "./capture";
import { pickDraftAccount } from "./useEraBudgetSubmit";
import { captureProgress, OPTIONAL_STEPS } from "./captureProgress";
import {
  captureGhost,
  leadInGhost,
  type AssistState,
  type Ghost,
} from "./captureAssist";
import { useEraCaptureMemory } from "./useEraCaptureMemory";

async function read<T>(url: string): Promise<T> {
  const res = await safeFetch(url);
  if (!res.ok) throw new Error("Unavailable");
  return (await res.json()) as T;
}

/**
 * The category a spend described like this usually gets: the person's own
 * history first, then the household's learned merchant map. A category the
 * sentence names outright (parseSpeechExpense) beats both.
 */
function learnedCategory(
  description: string,
  accountId: string,
  categories: UICategory[],
  remembered: MemoryExpense | null,
  merchants: MerchantMapping[],
): { categoryId?: string; subcategoryId?: string } {
  const parents = categories.filter((c) => !c.parent_id && c.visible !== false);
  const childOf = (id: string) =>
    categories.filter((c) => c.parent_id === id && c.visible !== false);
  if (remembered) {
    // Ids are per account; another account's category is matched by name.
    const sameAccount = remembered.accountId === accountId;
    const category = resolveCategoryRef(
      { id: sameAccount ? remembered.categoryId : null, name: remembered.categoryName },
      parents,
    );
    if (category) {
      const sub =
        remembered.subcategoryId || remembered.subcategoryName
          ? resolveCategoryRef(
              {
                id: sameAccount ? remembered.subcategoryId : null,
                name: remembered.subcategoryName,
              },
              childOf(category.id),
            )
          : null;
      return { categoryId: category.id, subcategoryId: sub?.id };
    }
  }
  const mapping =
    description.trim().length >= 3
      ? matchMerchantMapping(description, merchants)
      : null;
  if (!mapping?.category_id) return {};
  const category = resolveCategoryRef(
    { id: mapping.category_id, slug: mapping.category_slug, name: mapping.category_name },
    parents,
  );
  if (!category) return {};
  const sub = mapping.subcategory_id
    ? resolveCategoryRef(
        {
          id: mapping.subcategory_id,
          slug: mapping.subcategory_slug,
          name: mapping.subcategory_name,
        },
        childOf(category.id),
      )
    : null;
  return { categoryId: category.id, subcategoryId: sub?.id };
}

/**
 * Suggestions are derived; only deliberate field edits live in local state.
 * `primed` (the composer has focus) fetches typing memory before the first
 * word, so completions are ready when typing starts.
 */
export function useEraCapture(
  text: string,
  { primed = false }: { primed?: boolean } = {},
) {
  const [mode, setMode] = useState<CaptureKind | "off" | null>(null);
  const [savedEdits, setEdits] = useState<Record<string, string>>({});
  const [editedKind, setEditedKind] = useState<CaptureKind | null>(null);
  const [reference, setReference] = useState(() => new Date());
  const memory = useEraCaptureMemory(primed || text.trim() !== "");
  const kind =
    mode === "off"
      ? null
      : (mode ?? (text.trim() ? detectCapture(text, memory) : null));
  const edits = editedKind === kind ? savedEdits : {};
  const { data: allAccounts = [] } = useMyAccounts();
  const accounts = allAccounts.filter((a) => a.type === "expense");
  const currencyOf = (id: string) =>
    accounts.find((a) => a.id === id)?.currency ?? "USD";
  // Only spends on accounts the person can post to are useful suggestions.
  const expenses = memory.expenses.filter((e) =>
    accounts.some((a) => a.id === e.accountId),
  );
  const seed = kind
    ? captureSeed(kind, text, reference, { accounts, shopping: memory.shopping })
    : {};

  // ── Expense: account → categories → inferred category ──
  const target = pickDraftAccount(accounts, text);
  const remembered =
    kind === "expense" ? recallExpense(seed.description ?? "", expenses) : null;
  // Memory may pick another account only in the currency the amount already
  // has, so a remembered account never changes what the number means.
  const rememberedAccount =
    remembered &&
    target.ok &&
    currencyOf(remembered.accountId) === currencyOf(target.accountId)
      ? remembered.accountId
      : undefined;
  const accountId =
    edits.accountId ??
    seed.accountId ??
    rememberedAccount ??
    (target.ok ? target.accountId : "");
  const categoriesQuery = useCategories(
    kind === "expense" ? accountId : undefined,
  );
  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );
  const expense = useMemo(
    () => parseSpeechExpense(text, categories),
    [text, categories],
  );
  const { data: merchants = [] } = useMerchantMappings({
    household: true,
    enabled: kind === "expense",
  });
  const learned =
    kind === "expense" && !expense.categoryId
      ? learnedCategory(
          seed.description ?? "",
          accountId,
          categories,
          remembered,
          merchants,
        )
      : {};

  // ── Shopping: list → groups → inferred group ──
  const threadsQuery = useQuery({
    queryKey: qk.hubThreads(),
    queryFn: () => read<{ threads: HubChatThread[] }>("/api/hub/threads"),
    enabled: kind === "shopping",
    staleTime: CACHE_TIMES.DRAFTS,
  });
  const threads = (threadsQuery.data?.threads ?? []).filter(
    (t) => t.purpose === "shopping" && !t.is_archived,
  );
  const typedItems = shoppingLines(seed.items ?? "");
  // A unique list is used silently; several lists follow where these items
  // (or most items) usually go, and otherwise ask.
  const threadId =
    edits.threadId ??
    (threads.length === 1
      ? threads[0].id
      : (preferredThread(
          threads.map((t) => t.id),
          typedItems,
          memory.shopping,
        ) ?? ""));
  const groupsQuery = useQuery({
    queryKey: qk.shoppingGroups(threadId),
    queryFn: () =>
      read<{ groups: Array<{ id: string; name: string }> }>(
        `/api/hub/shopping-groups?thread_id=${encodeURIComponent(threadId)}`,
      ),
    enabled: kind === "shopping" && !!threadId,
    staleTime: CACHE_TIMES.DRAFTS,
  });
  const groups = groupsQuery.data?.groups ?? [];
  const learnedGroup = recallGroup(typedItems, threadId, memory.shopping);

  const fields: Record<string, string> = {
    ...seed,
    ...(kind === "expense"
      ? {
          accountId,
          categoryId: expense.categoryId ?? learned.categoryId ?? "",
          subcategoryId:
            expense.subcategoryId ??
            (expense.categoryId ? "" : (learned.subcategoryId ?? "")),
          amount: expense.amount ? String(expense.amount) : (seed.amount ?? ""),
          date: expense.date ?? seed.date,
        }
      : {}),
    ...(kind === "shopping"
      ? {
          threadId,
          groupId:
            learnedGroup && groups.some((g) => g.id === learnedGroup)
              ? learnedGroup
              : "",
        }
      : {}),
    ...edits,
  };
  if (kind === "event" && fields.date && fields.time) {
    const end = new Date(`${fields.date}T${fields.time}:00`);
    end.setHours(end.getHours() + 1);
    if (Number.isFinite(end.getTime())) {
      const startEdited =
        edits.date !== undefined ||
        edits.time !== undefined ||
        edits.when !== undefined;
      fields.endDate =
        edits.endDate ?? (startEdited ? formatDate(end) : seed.endDate);
      fields.endTime =
        edits.endTime ??
        (startEdited
          ? `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`
          : seed.endTime);
    }
  }
  const parents = categories.filter((c) => !c.parent_id);
  const children = categories.filter((c) => c.parent_id === fields.categoryId);
  const items = shoppingLines(fields.items ?? "");
  const recurring =
    !!parseSmartText(text, reference).recurrenceRule ||
    !!(fields.when && parseSmartText(fields.when, reference).recurrenceRule);
  const result = kind
    ? captureSchema.safeParse(
        kind === "expense"
          ? {
              kind,
              accountId: fields.accountId,
              amount: captureAmount(fields.amount ?? ""),
              categoryId: fields.categoryId,
              subcategoryId: fields.subcategoryId || "",
              description: fields.description,
              date: fields.date,
            }
          : kind === "shopping"
            ? {
                kind,
                threadId: fields.threadId,
                groupId: fields.groupId || null,
                items,
              }
            : {
                kind,
                title: fields.title,
                date: fields.date,
                time: fields.time,
                priority: fields.priority,
                location: fields.location || "",
                alert: fields.alert,
                ...(kind === "event"
                  ? { endDate: fields.endDate, endTime: fields.endTime }
                  : {}),
              },
      )
    : null;
  const validTarget =
    kind !== "expense" ||
    (accounts.some((a) => a.id === fields.accountId) &&
      parents.some((c) => c.id === fields.categoryId) &&
      (!fields.subcategoryId ||
        children.some((c) => c.id === fields.subcategoryId)));
  const validList =
    kind !== "shopping" ||
    (threads.some((t) => t.id === fields.threadId) &&
      (!fields.groupId || groups.some((g) => g.id === fields.groupId)) &&
      !groupsQuery.isLoading &&
      !groupsQuery.isError);
  const validEnd =
    kind !== "event" ||
    `${fields.endDate}T${fields.endTime}` > `${fields.date}T${fields.time}`;
  const dateChosen = edits.date !== undefined || edits.when !== undefined;
  const timeChosen = edits.time !== undefined || edits.when !== undefined;
  const step = captureProgress(
    kind,
    text,
    fields,
    { hasChildren: children.length > 0, dateChosen, timeChosen },
    reference,
  );
  const capture: NativeCapture | null =
    result?.success &&
    validTarget &&
    validList &&
    validEnd &&
    !recurring &&
    (step === "ready" || OPTIONAL_STEPS.has(step))
      ? result.data
      : null;

  const assist: AssistState | null = kind
    ? {
        kind,
        text,
        fields,
        step,
        now: reference,
        accounts,
        parents,
        children,
        threads,
        groups,
        items,
        memory: { expenses, titles: memory.titles, shopping: memory.shopping },
        dateChosen,
        timeChosen,
      }
    : null;
  const ghost: Ghost | null = assist
    ? recurring
      ? null
      : captureGhost(assist)
    : mode === "off"
      ? null
      : leadInGhost(text);

  const reset = () => {
    setMode(null);
    setEdits({});
    setReference(new Date());
  };
  const change = (key: string, value: string) => {
    setEditedKind(kind);
    setEdits((old) => {
      const next = { ...(editedKind === kind ? old : {}), [key]: value };
      if (key === "accountId") {
        next.categoryId = "";
        next.subcategoryId = "";
      }
      if (key === "categoryId") next.subcategoryId = "";
      if (key === "threadId") delete next.groupId;
      if (key === "date" || key === "time") next.when = "";
      if (key === "when") {
        const parsed = parseSmartText(value, reference);
        next.date =
          parsed.dueDate ??
          parsed.startDate ??
          (parsed.confidence.time > 0 ? fields.date : "");
        next.time =
          parsed.dueTime ?? parsed.startTime ?? fields.time ?? "12:00";
      }
      return next;
    });
  };
  return {
    kind,
    fields,
    step,
    capture,
    assist,
    ghost,
    change,
    reset,
    begin: () => setReference(new Date()),
    switchKind: (value: CaptureKind) => {
      setMode(value);
      setEdits({});
      setReference(new Date());
    },
    dismiss: () => setMode("off"),
    accounts,
    parents,
    children,
    threads,
    groups,
    items,
    recurring,
    loading:
      kind === "shopping"
        ? threadsQuery.isLoading || (!!threadId && groupsQuery.isLoading)
        : kind === "expense" && categoriesQuery.isLoading,
    error:
      kind === "shopping"
        ? threadsQuery.isError || groupsQuery.isError
        : kind === "expense" && categoriesQuery.isError,
  };
}
export type EraCaptureHelper = ReturnType<typeof useEraCapture>;

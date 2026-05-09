---
created: 2026-03-23
type: architecture
module: cross-cutting
module-type: n/a
status: active
tags:
  - type/architecture
  - scope/cross-cutting
---

# Common Patterns & Mistakes to Avoid

> Reference this file when implementing mutations, modals, drag-and-drop, or adding new type values.

---

## 1. Optimistic UI — Use ONLY `onMutate`

**Never** use both `useState` and React Query cache for the same data. Using both causes the UI to revert after refetch (race condition between optimistic state clear and stale DB response).

```typescript
// ✅ CORRECT — everything lives in the React Query cache
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey: itemsKeys.all });
  const previous = queryClient.getQueryData(itemsKeys.all);

  queryClient.setQueryData(itemsKeys.all, (old) => {
    return /* updated data */;
  });

  return { previous };
},
onError: (_err, _vars, context) => {
  queryClient.setQueryData(itemsKeys.all, context?.previous); // rollback
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: itemsKeys.all }); // refetch
},
```

**Never add** a parallel `useState` in the component for the same data the mutation manages.

---

## 2. Trace the Full Render Path

After implementing a feature, always:

1. Search for **all usages** of the changed component (`Grep` for its name)
2. Update parent components to pass new props
3. Trace: page → layout → component → subcomponent

Common failure: database ✅, types ✅, hooks ✅, component ✅ — but parent still passes stale/missing props.

---

## 3. Store IDs in State, Not Objects

**Never** store a full object in state for a modal/detail view — it becomes stale the moment the query cache updates.

```typescript
// ❌ WRONG — stale snapshot
const [focusItem, setFocusItem] = useState<Item | null>(null);

// ✅ CORRECT — always fresh
const [focusItemId, setFocusItemId] = useState<string | null>(null);
const focusItem = useMemo(
  () => items.find((i) => i.id === focusItemId) ?? null,
  [focusItemId, items], // items comes from useQuery
);
```

---

## 4. Framer Motion + HTML5 Drag Conflict

**Never** combine `<motion.div draggable>` with HTML5 drag events — Framer Motion intercepts them for its own animation system.

- For HTML5 DnD: use plain `<div draggable onDragStart=... />`
- For Framer Motion drag: use `<motion.div drag ... />` only
- Never mix both on the same element

---

## 5. Incomplete Type/Enum Updates

When adding a new type value (e.g., a new account type, new thread purpose, new action type), check **all** of:

- [ ] Database migration with CHECK constraint update
- [ ] `src/types/domain.ts` and related TypeScript interfaces
- [ ] API route validation / zod schemas
- [ ] Form components (RadioGroup, Select options)
- [ ] Display components (badge colors, label maps)
- [ ] `src/components/expense/AccountSelect.tsx`
- [ ] `src/components/expense/NewAccountDrawer.tsx`
- [ ] `src/components/expense/MobileExpenseForm.tsx`
- [ ] Utility functions (type guards, filters, mappers)
- [ ] Constants / seed data / default values

Missing even one of these causes subtle bugs (e.g., form doesn't show the new option, or the badge renders with no color).

---

## 6. Fetching a Parent + N Child Tables (Bundle Pattern)

**Never** issue separate PostgREST queries for a parent table and its children when both are needed on the same page load. Each Supabase `.from()` call is a separate HTTP round-trip (~170–200 ms floor). Fetching `items` + 6 child tables = 7 round-trips = ~1.3 s **minimum**, before any RLS or query cost.

### Rule

If a feature needs a parent row plus **3 or more** child tables, it must use a **SECURITY DEFINER RPC** that returns the full bundle as a single JSON response.

```typescript
// ❌ WRONG — 7 separate network calls (items + 6 children)
const [items, reminders, events, subtasks, alerts, rules, pauses] =
  await Promise.all([
    supabase.from("items").select("*").eq("user_id", uid),
    supabase.from("reminder_details").select("*").in("item_id", ids),
    // ... 5 more
  ]);

// ✅ CORRECT — 1 round-trip, ownership enforced inside function
const { data } = await supabase.rpc("get_schedule_bundle", {
  include_archived: false,
});
const { items, partner_id } = data;
// items already have reminder_details, event_details, subtasks, alerts, etc. embedded
```

### Canonical example

`get_schedule_bundle` in `migrations/2026-05-11_schedule_bundle_rpc.sql`:

- resolves household partner once
- JOINs all children in a single CTE
- returns one `jsonb` document
- client applies filters in JS (fast for <500 items)

### When to apply this pattern

- Any page that renders a list of items with their detail rows
- Any dashboard that aggregates parent + children counts
- Any modal that pre-loads related records on open

### When NOT to apply

- Mutations (always use individual table writes — bundle RPCs are read-only)
- Single-item detail pages (one item + children is fine as separate selects — low row count, one-off)

---

## 7. No `console.*` in Committed Code

`console.log`, `console.warn`, `console.error` must not appear in committed source files.

**Why it matters:**

- Leaks internal state and data shapes in production (security)
- Slows React DevTools overlay significantly on large state trees
- Noise in Vercel/Supabase edge function logs makes real errors invisible

**Alternatives:**

- **Structured persistence:** write to the Error Logs module (`/api/error-logs`) for anything worth keeping
- **Dev-only logs:** wrap in `if (process.env.NODE_ENV === "development") { ... }` and guard behind a feature flag; use `src/lib/logger.ts` if present
- **One-off debug:** use the browser DevTools debugger / breakpoints instead of adding log statements

Before every commit, run:

```bash
grep -rn "console\." src/ --include="*.ts" --include="*.tsx"
```

Any result is a bug.

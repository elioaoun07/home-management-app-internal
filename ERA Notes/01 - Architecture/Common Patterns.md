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
  [focusItemId, items] // items comes from useQuery
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

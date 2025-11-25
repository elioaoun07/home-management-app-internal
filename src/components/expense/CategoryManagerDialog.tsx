"use client";

import {
  ChevronDownIcon as ChevronDown,
  ChevronRightIcon as ChevronRight,
  GripVerticalIcon as GripVertical,
  PencilIcon as Pencil,
  StarIcon as Star,
  Trash2Icon as Trash2,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToFirstScrollableAncestor,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onChange?: () => void;
};

type UICategory = {
  id: string;
  name: string;
  parent_id: string | null;
  icon?: string | null;
  position?: number | null;
};

export default function CategoryManagerDialog({
  open,
  onOpenChange,
  accountId,
  onChange,
}: Props) {
  const themeClasses = useThemeClasses();
  // Accounts for dropdown + default marker
  const { data: accounts = [] } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accountId);
  useEffect(() => setSelectedAccountId(accountId), [accountId]);

  // Default account handling (persist local for simplicity)
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem("default_account_id");
      if (v) setDefaultAccountId(v);
    } catch {}
  }, []);

  const { data: categories = [], refetch } = useCategories(selectedAccountId);

  const isDbCategories =
    Array.isArray(categories) &&
    categories.length > 0 &&
    typeof (categories as any)[0] === "object" &&
    "parent_id" in (categories as any)[0];

  const all = useMemo<UICategory[]>(
    () =>
      isDbCategories
        ? (categories as unknown as UICategory[]).map((c) => ({
            id: c.id,
            name: c.name,
            parent_id: c.parent_id,
            icon: c.icon ?? null,
            position: c.position ?? null,
          }))
        : [],
    [categories, isDbCategories]
  );

  const roots = useMemo(
    () =>
      all
        .filter((c) => !c.parent_id)
        .sort(
          (a, b) =>
            (a.position ?? 1e9) - (b.position ?? 1e9) ||
            a.name.localeCompare(b.name)
        ),
    [all]
  );

  const getSubs = (parentId: string) =>
    all
      .filter((c) => c.parent_id === parentId)
      .sort(
        (a, b) =>
          (a.position ?? 1e9) - (b.position ?? 1e9) ||
          a.name.localeCompare(b.name)
      );

  // UI state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<{
    type:
      | "cat-rename"
      | "cat-del"
      | "sub-rename"
      | "sub-del"
      | "reorder-save"
      | null;
    id?: string;
  }>({ type: null });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>("");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState<string>("");
  const [confirmCatDeleteId, setConfirmCatDeleteId] = useState<string | null>(
    null
  );
  const [confirmSubDeleteId, setConfirmSubDeleteId] = useState<string | null>(
    null
  );

  // Ordering state and click-to-edit position control
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [editingPosId, setEditingPosId] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor));

  function SortableRoot({
    id,
    children,
  }: {
    id: string;
    children: React.ReactNode;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };
    return (
      <div ref={setNodeRef} style={style} className="py-2">
        <div className="flex items-center justify-between w-full">
          {children}
          <button
            {...attributes}
            {...listeners}
            className="ml-2 p-2 rounded hover:bg-muted/10"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  function SortableSub({
    id,
    children,
  }: {
    id: string;
    children: React.ReactNode;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    };
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2 flex-1">{children}</div>
        <button
          {...attributes}
          {...listeners}
          className="ml-2 p-2 rounded hover:bg-muted/10"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  // Initialize local positions
  useEffect(() => {
    if (!open || !isDbCategories) return;
    const next: Record<string, number> = {};
    for (const c of all)
      next[c.id] = Math.max(1, Math.floor(c.position ?? 1e9));
    setPositions(next);
  }, [open, isDbCategories, all]);

  const displayRoots = useMemo(() => {
    return [...roots].sort(
      (a, b) => (positions[a.id] ?? 1e9) - (positions[b.id] ?? 1e9)
    );
  }, [roots, positions]);

  const getDisplaySubs = (parentId: string) => {
    const subs = getSubs(parentId);
    return [...subs].sort(
      (a, b) => (positions[a.id] ?? 1e9) - (positions[b.id] ?? 1e9)
    );
  };

  // Drag handlers
  function handleRootDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = displayRoots.map((r) => r.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const nextOrder = arrayMove(ids, oldIndex, newIndex);
    const nextPositions = { ...positions };
    nextOrder.forEach((id, i) => (nextPositions[id] = i + 1));
    setPositions(nextPositions);
  }

  function handleSubDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    for (const r of displayRoots) {
      const subs = getDisplaySubs(r.id);
      const ids = subs.map((s) => s.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) continue;
      const nextOrder = arrayMove(ids, oldIndex, newIndex);
      const nextPositions = { ...positions };
      nextOrder.forEach((id, i) => (nextPositions[id] = i + 1));
      setPositions(nextPositions);
      return;
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;
    const rootIds = displayRoots.map((r) => r.id);
    const isActiveRoot = rootIds.includes(activeId);
    const isOverRoot = rootIds.includes(overId);
    if (isActiveRoot && isOverRoot) return handleRootDragEnd(event);
    handleSubDragEnd(event);
  }

  function setPos(id: string, v: string) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    setPositions((p) => ({ ...p, [id]: Math.max(1, Math.floor(n)) }));
  }

  // rename/delete
  async function patchCategoryName(id: string, name: string) {
    setLoading({ type: "cat-rename", id });
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Category renamed");
      await refetch();
      onChange?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to rename category";
      toast.error(msg);
    } finally {
      setLoading({ type: null });
    }
  }

  async function deleteCategory(id: string) {
    setLoading({ type: "cat-del", id });
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Category deleted");
      await refetch();
      onChange?.();
      setConfirmCatDeleteId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete category";
      toast.error(msg);
    } finally {
      setLoading({ type: null });
    }
  }

  async function patchSubcategoryName(id: string, name: string) {
    setLoading({ type: "sub-rename", id });
    try {
      const res = await fetch(`/api/categories/subcategories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Subcategory renamed");
      await refetch();
      onChange?.();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to rename subcategory";
      toast.error(msg);
    } finally {
      setLoading({ type: null });
    }
  }

  async function deleteSubcategory(id: string) {
    setLoading({ type: "sub-del", id });
    try {
      const res = await fetch(`/api/categories/subcategories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Subcategory deleted");
      await refetch();
      onChange?.();
      setConfirmSubDeleteId(null);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to delete subcategory";
      toast.error(msg);
    } finally {
      setLoading({ type: null });
    }
  }

  // persist order
  function normalizeSequential(ids: string[]) {
    const sorted = [...ids].sort(
      (a, b) => (positions[a] ?? 1e9) - (positions[b] ?? 1e9)
    );
    const out: Record<string, number> = {};
    sorted.forEach((id, i) => (out[id] = i + 1));
    return out;
  }

  async function saveOrder() {
    setLoading({ type: "reorder-save" });
    try {
      const rootIds = roots.map((c) => c.id);
      const rootSeq = normalizeSequential(rootIds);
      const subSeq: Record<string, number> = {};
      for (const r of roots) {
        const subs = getSubs(r.id);
        const ids = subs.map((s) => s.id);
        const seq = normalizeSequential(ids);
        ids.forEach((id) => (subSeq[id] = seq[id]));
      }
      const updates: Array<{ id: string; position: number }> = [];
      for (const r of roots) {
        const current = Math.max(1, Math.floor(r.position ?? 1e9));
        const next = rootSeq[r.id];
        if (current !== next) updates.push({ id: r.id, position: next });
      }
      for (const r of roots) {
        for (const s of getSubs(r.id)) {
          const current = Math.max(1, Math.floor(s.position ?? 1e9));
          const next = subSeq[s.id];
          if (current !== next) updates.push({ id: s.id, position: next });
        }
      }
      if (updates.length === 0) {
        toast.info("No changes to save");
        return;
      }
      const res = await fetch("/api/user-categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to save order");
      }
      toast.success("Order saved");
      await refetch();
      onChange?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save order";
      toast.error(msg);
    } finally {
      setLoading({ type: null });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className={themeClasses.dialogTitle}>
            Manage Categories
          </DialogTitle>
        </DialogHeader>

        {/* Account selector + default star */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex-1">
            <Select
              value={selectedAccountId}
              onValueChange={(v) => setSelectedAccountId(v)}
            >
              <SelectTrigger aria-label="Select account">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            className="p-2 rounded hover:bg-muted/10"
            title={
              defaultAccountId === selectedAccountId
                ? "This is your default account"
                : "Set as default account"
            }
            onClick={() => {
              try {
                localStorage.setItem("default_account_id", selectedAccountId);
                setDefaultAccountId(selectedAccountId);
                toast.success("Default account updated");
              } catch {
                toast.error("Failed to update default account");
              }
            }}
            aria-label="Set as default account"
          >
            <Star
              className={
                defaultAccountId === selectedAccountId
                  ? "h-5 w-5 text-yellow-500 fill-yellow-500"
                  : "h-5 w-5 text-muted-foreground"
              }
            />
          </button>
        </div>

        {!isDbCategories ? (
          <div className="text-sm text-muted-foreground">
            You're currently using default categories. Create a custom category
            first to edit or delete.
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-96 pr-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[
                  restrictToVerticalAxis,
                  restrictToFirstScrollableAncestor,
                ]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayRoots.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="divide-y">
                    {displayRoots.map((cat) => {
                      const isExpanded = !!expanded[cat.id];
                      const subs = getDisplaySubs(cat.id);
                      const isBusy =
                        loading.id === cat.id && loading.type !== null;
                      const isEditing = editingCatId === cat.id;
                      return (
                        <Fragment key={cat.id}>
                          <li key={cat.id} className="py-2">
                            <SortableRoot id={cat.id}>
                              <div className="flex items-center justify-between w-full">
                                <button
                                  className="flex items-center gap-2 flex-1 text-left"
                                  onClick={() =>
                                    setExpanded((e) => ({
                                      ...e,
                                      [cat.id]: !e[cat.id],
                                    }))
                                  }
                                  aria-label={
                                    isExpanded ? "Collapse" : "Expand"
                                  }
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  {isEditing ? (
                                    <input
                                      className="ml-1 shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset] bg-[#0a1628]/50 rounded px-2 py-1 text-sm flex-1 min-w-0 focus:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset]"
                                      value={editingCatName}
                                      onChange={(e) =>
                                        setEditingCatName(e.target.value)
                                      }
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className="flex-1">{cat.name}</span>
                                  )}
                                </button>
                                <div className="flex items-center gap-2">
                                  <div className="w-16">
                                    {editingPosId === cat.id ? (
                                      <Input
                                        type="number"
                                        min={1}
                                        value={positions[cat.id] ?? ""}
                                        onChange={(e) =>
                                          setPos(cat.id, e.target.value)
                                        }
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        onBlur={() => setEditingPosId(null)}
                                        onKeyDown={(e) => {
                                          if (
                                            e.key === "Enter" ||
                                            e.key === "Escape"
                                          )
                                            setEditingPosId(null);
                                        }}
                                        autoFocus
                                      />
                                    ) : (
                                      <button
                                        className="w-full px-2 py-1 border rounded text-sm text-muted-foreground hover:bg-muted/10"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setEditingPosId(cat.id);
                                        }}
                                        aria-label="Edit position"
                                      >
                                        {positions[cat.id] ?? ""}
                                      </button>
                                    )}
                                  </div>
                                  {isEditing ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const nn = editingCatName.trim();
                                          if (!nn) return;
                                          void patchCategoryName(cat.id, nn);
                                          setEditingCatId(null);
                                        }}
                                        disabled={loading.type !== null}
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setEditingCatId(null);
                                          setEditingCatName("");
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setEditingCatId(cat.id);
                                          setEditingCatName(cat.name ?? "");
                                        }}
                                        aria-label="Rename"
                                        disabled={isBusy}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      {confirmCatDeleteId === cat.id ? (
                                        <>
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              void deleteCategory(cat.id);
                                            }}
                                            disabled={loading.type !== null}
                                          >
                                            Confirm
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setConfirmCatDeleteId(null);
                                            }}
                                          >
                                            Cancel
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setConfirmCatDeleteId(cat.id);
                                          }}
                                          aria-label="Delete"
                                          disabled={isBusy}
                                        >
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      )}
                                      {cat.icon && (
                                        <span className="text-lg" aria-hidden>
                                          {cat.icon}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </SortableRoot>
                          </li>
                          {isExpanded && (
                            <li key={cat.id + "-subs"} className="-mt-2 mb-2">
                              <SortableContext
                                items={subs.map((s) => s.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <ul className="ml-8 border-l pl-3 space-y-1">
                                  {subs.map((sub) => {
                                    const isSubBusy =
                                      loading.id === sub.id &&
                                      loading.type !== null;
                                    const isSubEditing =
                                      editingSubId === sub.id;
                                    return (
                                      <li
                                        key={sub.id}
                                        className="flex items-center justify-between"
                                      >
                                        <SortableSub id={sub.id}>
                                          <>
                                            <div className="flex items-center gap-2 flex-1">
                                              {isSubEditing ? (
                                                <input
                                                  className="shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset] bg-[#0a1628]/50 rounded px-2 py-1 text-sm flex-1 focus:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset]"
                                                  value={editingSubName}
                                                  onChange={(e) =>
                                                    setEditingSubName(
                                                      e.target.value
                                                    )
                                                  }
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                  }}
                                                  autoFocus
                                                />
                                              ) : (
                                                <span className="flex-1">
                                                  {sub.name}
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="w-16">
                                                {editingPosId === sub.id ? (
                                                  <Input
                                                    type="number"
                                                    min={1}
                                                    value={
                                                      positions[sub.id] ?? ""
                                                    }
                                                    onChange={(e) =>
                                                      setPos(
                                                        sub.id,
                                                        e.target.value
                                                      )
                                                    }
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                    }}
                                                    onBlur={() =>
                                                      setEditingPosId(null)
                                                    }
                                                    onKeyDown={(e) => {
                                                      if (
                                                        e.key === "Enter" ||
                                                        e.key === "Escape"
                                                      )
                                                        setEditingPosId(null);
                                                    }}
                                                    autoFocus
                                                  />
                                                ) : (
                                                  <button
                                                    className={`w-full px-2 py-1 ${themeClasses.inputBorder} rounded text-sm ${themeClasses.labelText} ${themeClasses.bgHover} hover:${themeClasses.inputFocusForce}`}
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      setEditingPosId(sub.id);
                                                    }}
                                                    aria-label="Edit position"
                                                  >
                                                    {positions[sub.id] ?? ""}
                                                  </button>
                                                )}
                                              </div>
                                              {isSubEditing ? (
                                                <>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      const nn =
                                                        editingSubName.trim();
                                                      if (!nn) return;
                                                      void patchSubcategoryName(
                                                        sub.id,
                                                        nn
                                                      );
                                                      setEditingSubId(null);
                                                    }}
                                                    disabled={
                                                      loading.type !== null
                                                    }
                                                  >
                                                    Save
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      setEditingSubId(null);
                                                      setEditingSubName("");
                                                    }}
                                                  >
                                                    Cancel
                                                  </Button>
                                                </>
                                              ) : (
                                                <>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      setEditingSubId(sub.id);
                                                      setEditingSubName(
                                                        sub.name ?? ""
                                                      );
                                                    }}
                                                    aria-label="Rename"
                                                    disabled={isSubBusy}
                                                  >
                                                    <Pencil className="h-4 w-4" />
                                                  </Button>
                                                  {confirmSubDeleteId ===
                                                  sub.id ? (
                                                    <>
                                                      <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          void deleteSubcategory(
                                                            sub.id
                                                          );
                                                        }}
                                                        disabled={
                                                          loading.type !== null
                                                        }
                                                      >
                                                        Confirm
                                                      </Button>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                          setConfirmSubDeleteId(
                                                            null
                                                          );
                                                        }}
                                                      >
                                                        Cancel
                                                      </Button>
                                                    </>
                                                  ) : (
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setConfirmSubDeleteId(
                                                          sub.id
                                                        );
                                                      }}
                                                      aria-label="Delete"
                                                      disabled={isSubBusy}
                                                    >
                                                      <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                  )}
                                                  {sub.icon && (
                                                    <span
                                                      className="text-lg"
                                                      aria-hidden
                                                    >
                                                      {sub.icon}
                                                    </span>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </>
                                        </SortableSub>
                                      </li>
                                    );
                                  })}
                                  {subs.length === 0 && (
                                    <li className="text-sm text-muted-foreground">
                                      No subcategories.
                                    </li>
                                  )}
                                </ul>
                              </SortableContext>
                            </li>
                          )}
                        </Fragment>
                      );
                    })}
                    {displayRoots.length === 0 && (
                      <li className="py-2 text-sm text-muted-foreground">
                        No categories.
                      </li>
                    )}
                  </ul>
                </SortableContext>
              </DndContext>
            </ScrollArea>
            <div className="flex items-center gap-2 justify-end pt-4">
              <Button
                size="sm"
                onClick={async () => {
                  await saveOrder();
                  onOpenChange(false);
                }}
                disabled={loading.type === "reorder-save"}
              >
                {loading.type === "reorder-save" ? "Saving..." : "Save order"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const reset: Record<string, number> = {};
                  for (const c of all)
                    reset[c.id] = Math.max(1, Math.floor(c.position ?? 1e9));
                  setPositions(reset);
                  setEditingPosId(null);
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

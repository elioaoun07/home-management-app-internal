"use client";

// Category picking for the statement review, as a tap grid.
//
// It used to be two `Select` dropdowns side by side — on a phone that is two
// ~150px triggers showing truncated text, and picking a category cost three
// taps plus a scroll through a native listbox. This is the same grid the
// expense form uses (colored icon tile, 3 across), so the gesture is already
// familiar: tap a category → if it has subcategories you land on them, if it
// has none you are done and the sheet above closes itself.
//
// Inline creation stays: creating a category elsewhere used to mean losing the
// review, and even then the list did not refresh (1h staleTime +
// refetchOnMount:false + persisted cache) — hence refetchQueries below.

import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getErrorMessage } from "@/lib/errors";
import { qk } from "@/lib/queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  accountId: string;
  categoryId: string | null;
  subcategoryId: string | null;
  onChange: (next: {
    category_id: string | null;
    subcategory_id: string | null;
  }) => void;
  /** Fired when the choice is complete — the sheet above closes on it. */
  onDone?: () => void;
};

function tap() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(5);
  }
}

export function CategoryPicker({
  accountId,
  categoryId,
  subcategoryId,
  onChange,
  onDone,
}: Props) {
  const tc = useThemeClasses();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories(accountId);

  const [step, setStep] = useState<"category" | "subcategory">("category");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const parents = useMemo(
    () => categories.filter((c) => !c.parent_id && c.visible !== false),
    [categories],
  );

  const subsOf = useCallback(
    (parentId: string | null) =>
      parentId
        ? categories.filter(
            (c) => c.parent_id === parentId && c.visible !== false,
          )
        : [],
    [categories],
  );

  const parent = parents.find((c) => c.id === categoryId) ?? null;
  const subcategories = subsOf(categoryId);

  const pickCategory = (id: string) => {
    tap();
    onChange({ category_id: id, subcategory_id: null });
    // Only stop for a subcategory when there is one to pick.
    if (subsOf(id).length > 0) setStep("subcategory");
    else onDone?.();
  };

  const pickSubcategory = (id: string | null) => {
    tap();
    onChange({ category_id: categoryId, subcategory_id: id });
    onDone?.();
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Enter a name first", { icon: ToastIcons.error });
      return;
    }

    setIsSaving(true);
    const asSubcategory = step === "subcategory";
    try {
      const res = await safeFetch("/api/user-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          icon: null,
          color: tc.defaultAccentColor,
          account_id: accountId,
          parent_id: asSubcategory ? categoryId : null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create");
      }

      const created = await res.json();

      // refetchQueries (not invalidateQueries): this query runs with
      // refetchOnMount:false against a persisted cache, so only an explicit
      // refetch makes the new row appear straight away.
      await queryClient.refetchQueries({ queryKey: qk.categories(accountId) });

      if (asSubcategory) {
        onChange({ category_id: categoryId, subcategory_id: created.id });
      } else {
        onChange({ category_id: created.id, subcategory_id: null });
      }

      toast.success(asSubcategory ? "Subcategory created" : "Category created", {
        icon: ToastIcons.create,
        description: name,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            await safeFetch("/api/categories/manage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                operation: "delete",
                data: { id: created.id, hard_delete: true },
              }),
            });
            await queryClient.refetchQueries({
              queryKey: qk.categories(accountId),
            });
            onChange({ category_id: null, subcategory_id: null });
          },
        },
      });

      setNewName("");
      setCreating(false);
      onDone?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create"), {
        icon: ToastIcons.error,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (creating) {
    return (
      <div className="flex flex-col gap-3">
        <p className={cn("text-xs", tc.textFaint)}>
          {step === "subcategory"
            ? `New subcategory in ${parent?.name ?? "category"}`
            : "New category"}
        </p>
        <input
          type="text"
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") setCreating(false);
          }}
          placeholder="Name"
          className={cn(
            "w-full rounded-xl px-4 h-12 text-base",
            tc.formInput,
            tc.placeholder,
          )}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCreating(false)}
            className={cn(
              "rounded-xl h-12 px-4 text-sm flex items-center gap-2",
              tc.buttonGhost,
              tc.textMuted,
            )}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={isSaving}
            className={cn(
              "rounded-xl h-12 flex-1 text-sm font-medium disabled:opacity-50",
              tc.buttonPrimary,
            )}
          >
            {isSaving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "subcategory" && parent) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setStep("category")}
          className={cn(
            "flex items-center gap-1 text-xs self-start h-9 pr-3",
            tc.textMuted,
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          {parent.name}
        </button>

        <div className="grid grid-cols-3 gap-2">
          <Tile
            label="No subcategory"
            color={parent.color || tc.defaultAccentColor}
            active={!subcategoryId}
            onClick={() => pickSubcategory(null)}
          />
          {subcategories.map((sub) => (
            <Tile
              key={sub.id}
              label={sub.name}
              slug={sub.slug}
              color={sub.color || parent.color || tc.defaultAccentColor}
              active={subcategoryId === sub.id}
              onClick={() => pickSubcategory(sub.id)}
            />
          ))}
          <NewTile onClick={() => setCreating(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {parents.map((cat) => (
        <Tile
          key={cat.id}
          label={cat.name}
          slug={cat.slug}
          color={cat.color || tc.defaultAccentColor}
          active={categoryId === cat.id}
          onClick={() => pickCategory(cat.id)}
        />
      ))}
      <NewTile onClick={() => setCreating(true)} />
    </div>
  );
}

function Tile({
  label,
  slug,
  color,
  active,
  onClick,
}: {
  label: string;
  slug?: string | null;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const tc = useThemeClasses();
  const Icon = getCategoryIcon(label, slug ?? undefined);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: active ? `${color}20` : undefined,
        boxShadow: active ? `inset 0 0 0 1.5px ${color}` : undefined,
      }}
      className={cn(
        "rounded-xl min-h-[78px] p-2 flex flex-col items-center justify-center gap-1.5 text-center active:scale-95 transition-transform",
        !active && tc.pillBg,
      )}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: color, color: "#fff" }}
      >
        <Icon className="w-4 h-4" />
      </span>
      <span
        className={cn("text-[11px] leading-tight line-clamp-2", tc.text)}
        style={active ? { color } : undefined}
      >
        {label}
      </span>
    </button>
  );
}

function NewTile({ onClick }: { onClick: () => void }) {
  const tc = useThemeClasses();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl min-h-[78px] p-2 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed active:scale-95 transition-transform",
        tc.dashedBorder,
        tc.dashedBorderHover,
      )}
    >
      <Plus className={cn("w-5 h-5", tc.textMuted)} />
      <span className={cn("text-[11px]", tc.textFaint)}>New</span>
    </button>
  );
}

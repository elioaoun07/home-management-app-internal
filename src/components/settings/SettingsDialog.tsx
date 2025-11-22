"use client";

import { RotateCcwIcon, SaveIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/contexts/ThemeContext";
import { useAccounts, useSetDefaultAccount } from "@/features/accounts/hooks";
import { usePreferences } from "@/features/preferences/usePreferences";
import {
  useSectionOrder,
  useUpdatePreferences,
  type SectionKey,
} from "@/features/preferences/useSectionOrder";
import { useViewMode, ViewMode } from "@/hooks/useViewMode";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SortableItem } from "./SortableItem";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SECTION_LABELS: Record<SectionKey, string> = {
  amount: "Amount Entry",
  category: "Category Selection",
  subcategory: "Subcategory & Note",
  account: "Account Selection",
};

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { theme: darkLightTheme, updateTheme } = usePreferences();
  const { theme: colorTheme, setTheme, isLoading: themeLoading } = useTheme();
  const { viewMode, updateViewMode } = useViewMode();

  // Section order state
  const { data: serverOrderArray } = useSectionOrder();
  const initialOrder = Array.isArray(serverOrderArray) ? serverOrderArray : [];
  const [order, setOrder] = useState<SectionKey[]>(() =>
    initialOrder.length ? initialOrder : []
  );
  const [activeId, setActiveId] = useState<SectionKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const updatePreferences = useUpdatePreferences();

  useEffect(() => {
    if (Array.isArray(serverOrderArray) && open)
      setOrder(serverOrderArray as SectionKey[]);
  }, [serverOrderArray, open]);

  const canSave = useMemo(() => {
    const so = Array.isArray(serverOrderArray) ? serverOrderArray : null;
    if (!so) return false;
    if (order.length !== so.length) return true;
    return order.some((k, i) => k !== so[i]);
  }, [order, serverOrderArray]);

  function move(idx: number, dir: -1 | 1) {
    setOrder((prev) => {
      const next = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  function resetToDefault() {
    const so = Array.isArray(serverOrderArray) ? serverOrderArray : null;
    if (!so) return;
    // rely on hook defaulting logic by clearing to server default if it had one,
    // or derive from labels order fallback
    setOrder(
      (so as SectionKey[]) ?? [
        "account",
        "category",
        "subcategory",
        "amount",
        "description",
      ]
    );
  }

  async function handleSave() {
    try {
      await updatePreferences.mutateAsync({ section_order: order });
    } catch (e) {
      // Swallow; toast could be added later
      console.error(e);
    }
  }

  // DnD sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as SectionKey);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrder((items) => {
        const oldIndex = items.indexOf(active.id as SectionKey);
        const newIndex = items.indexOf(over.id as SectionKey);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col bg-[hsl(var(--card)/0.96)] backdrop-blur-sm shadow-2xl border border-[hsl(var(--header-border)/0.22)]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-bold">Settings</DialogTitle>
          <DialogDescription className="text-sm">
            Personalize your appearance and layout preferences.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="appearance"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-5 bg-[hsl(var(--header-bg)/0.5)] border border-[hsl(var(--header-border)/0.3)] rounded-xl p-1 flex-shrink-0">
            <TabsTrigger
              value="appearance"
              className="data-[state=active]:bg-[hsl(var(--nav-text-primary)/0.2)] data-[state=active]:text-[hsl(var(--nav-text-primary))] data-[state=active]:neo-glow-sm rounded-lg transition-all"
            >
              Theme
            </TabsTrigger>
            <TabsTrigger
              value="view"
              className="data-[state=active]:bg-[hsl(var(--nav-text-primary)/0.2)] data-[state=active]:text-[hsl(var(--nav-text-primary))] data-[state=active]:neo-glow-sm rounded-lg transition-all"
            >
              View
            </TabsTrigger>
            <TabsTrigger
              value="accounts"
              className="data-[state=active]:bg-[hsl(var(--nav-text-primary)/0.2)] data-[state=active]:text-[hsl(var(--nav-text-primary))] data-[state=active]:neo-glow-sm rounded-lg transition-all"
            >
              Accounts
            </TabsTrigger>
            <TabsTrigger
              value="steps"
              className="data-[state=active]:bg-[hsl(var(--nav-text-primary)/0.2)] data-[state=active]:text-[hsl(var(--nav-text-primary))] data-[state=active]:neo-glow-sm rounded-lg transition-all"
            >
              Steps
            </TabsTrigger>
            <TabsTrigger
              value="household"
              className="data-[state=active]:bg-[hsl(var(--nav-text-primary)/0.2)] data-[state=active]:text-[hsl(var(--nav-text-primary))] data-[state=active]:neo-glow-sm rounded-lg transition-all"
            >
              Household
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="appearance"
            className="mt-4 flex-1 overflow-y-auto"
          >
            <div className="space-y-4 h-[400px] flex flex-col">
              <div className="flex-shrink-0">
                <h3 className="text-base font-semibold text-[hsl(var(--nav-text-primary))]">
                  Color Theme
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose your preferred color scheme
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1">
                <button
                  onClick={async () => {
                    await setTheme("blue");
                    toast.success("Theme updated to Blue");
                  }}
                  disabled={themeLoading}
                  className="neo-card flex flex-col items-center justify-center gap-3 rounded-xl p-6 hover:neo-glow-sm transition-all active:scale-[0.98] h-full disabled:opacity-50"
                >
                  <div className="w-16 h-16 rounded-full neo-glow bg-gradient-to-br from-[#3b82f6] via-[#06b6d4] to-[#14b8a6] shadow-lg"></div>
                  <span className="text-base font-semibold">Blue Ocean</span>
                  <span className="text-xs text-muted-foreground">
                    Cool & Professional
                  </span>
                </button>
                <button
                  onClick={async () => {
                    await setTheme("pink");
                    toast.success("Theme updated to Pink");
                  }}
                  disabled={themeLoading}
                  className="neo-card flex flex-col items-center justify-center gap-3 rounded-xl p-6 hover:neo-glow-sm transition-all active:scale-[0.98] h-full disabled:opacity-50"
                >
                  <div className="w-16 h-16 rounded-full neo-glow bg-gradient-to-br from-[#ec4899] via-[#f472b6] to-[#fbbf24] shadow-lg"></div>
                  <span className="text-base font-semibold">Pink Sunset</span>
                  <span className="text-xs text-muted-foreground">
                    Warm & Vibrant
                  </span>
                </button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="view" className="mt-4 flex-1 overflow-y-auto">
            <div className="space-y-4 h-[400px] flex flex-col">
              <div className="flex-shrink-0">
                <h3 className="text-base font-semibold text-[hsl(var(--nav-text-primary))]">
                  View Mode
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Switch between different platform views
                </p>
              </div>

              <RadioGroup
                value={viewMode}
                onValueChange={(value) => {
                  updateViewMode(value as ViewMode);
                  toast.success(
                    `Switched to ${value.charAt(0).toUpperCase() + value.slice(1)} view`
                  );
                  // Close dialog and reload for view change to take effect
                  setTimeout(() => {
                    onOpenChange(false);
                    window.location.reload();
                  }, 500);
                }}
                className="space-y-3 flex-1"
              >
                <div
                  className={`neo-card flex items-center gap-3 rounded-xl p-4 hover:neo-glow-sm transition-all cursor-pointer ${
                    viewMode === "mobile" ? "border-[#3b82f6] border-2" : ""
                  }`}
                >
                  <RadioGroupItem
                    id="view-mobile"
                    value="mobile"
                    className="flex-shrink-0"
                  />
                  <Label
                    htmlFor="view-mobile"
                    className="flex-1 cursor-pointer"
                  >
                    <div className="text-sm font-semibold">Mobile</div>
                    <div className="text-xs text-muted-foreground">
                      Optimized for phones with touch navigation
                    </div>
                  </Label>
                  {viewMode === "mobile" && (
                    <span className="text-xs bg-[hsl(var(--nav-text-primary)/0.2)] text-[hsl(var(--nav-text-primary))] px-2 py-1 rounded-full font-medium">
                      Active
                    </span>
                  )}
                </div>

                <div
                  className={`neo-card flex items-center gap-3 rounded-xl p-4 hover:neo-glow-sm transition-all cursor-pointer ${
                    viewMode === "web" ? "border-[#3b82f6] border-2" : ""
                  }`}
                >
                  <RadioGroupItem
                    id="view-web"
                    value="web"
                    className="flex-shrink-0"
                  />
                  <Label htmlFor="view-web" className="flex-1 cursor-pointer">
                    <div className="text-sm font-semibold">Web</div>
                    <div className="text-xs text-muted-foreground">
                      Desktop layout with expanded features
                    </div>
                  </Label>
                  {viewMode === "web" && (
                    <span className="text-xs bg-[hsl(var(--nav-text-primary)/0.2)] text-[hsl(var(--nav-text-primary))] px-2 py-1 rounded-full font-medium">
                      Active
                    </span>
                  )}
                </div>

                <div
                  className={`neo-card flex items-center gap-3 rounded-xl p-4 hover:neo-glow-sm transition-all cursor-pointer ${
                    viewMode === "watch" ? "border-[#3b82f6] border-2" : ""
                  }`}
                >
                  <RadioGroupItem
                    id="view-watch"
                    value="watch"
                    className="flex-shrink-0"
                  />
                  <Label htmlFor="view-watch" className="flex-1 cursor-pointer">
                    <div className="text-sm font-semibold">Watch</div>
                    <div className="text-xs text-muted-foreground">
                      Voice entry and quick balance overview
                    </div>
                  </Label>
                  {viewMode === "watch" && (
                    <span className="text-xs bg-[hsl(var(--nav-text-primary)/0.2)] text-[hsl(var(--nav-text-primary))] px-2 py-1 rounded-full font-medium">
                      Active
                    </span>
                  )}
                </div>
              </RadioGroup>

              <div className="flex-shrink-0 p-3 neo-card rounded-lg border border-[hsl(var(--nav-text-primary)/0.2)] bg-[hsl(var(--header-bg)/0.5)]">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-[hsl(var(--nav-text-primary))]">
                    Note:
                  </strong>{" "}
                  View preference is stored locally on this device. Web view is
                  coming soon.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="accounts" className="mt-4 flex-1 overflow-y-auto">
            <div className="h-[400px]">
              <AccountsPanel />
            </div>
          </TabsContent>

          <TabsContent
            value="household"
            className="mt-4 flex-1 overflow-y-auto"
          >
            <div className="h-[400px]">
              <HouseholdPanel />
            </div>
          </TabsContent>

          <TabsContent value="steps" className="mt-4 flex-1 overflow-y-auto">
            <div className="space-y-4 h-[400px] flex flex-col">
              <div className="flex-shrink-0">
                <h3 className="text-base font-semibold text-[hsl(var(--nav-text-primary))]">
                  Expense Walkthrough Steps
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Customize the order of steps in your expense entry
                  walkthrough. Drag to reorder.
                </p>
                <div className="mt-2 p-3 neo-card rounded-lg border border-[hsl(var(--nav-text-primary)/0.2)] bg-[hsl(var(--header-bg)/0.5)]">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-[hsl(var(--nav-text-primary))]">
                      Note:
                    </strong>{" "}
                    The walkthrough guides you through each step. If you have a
                    default account, the Account step is automatically skipped.
                    Subcategory only appears when a category has subcategories.
                  </p>
                </div>
              </div>

              <div className="flex-1 neo-card rounded-xl border border-[hsl(var(--header-border)/0.3)] overflow-hidden">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                  modifiers={[restrictToParentElement, restrictToVerticalAxis]}
                >
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      {!serverOrderArray || serverOrderArray.length === 0 ? (
                        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                          Loading preferences...
                        </div>
                      ) : (
                        <SortableContext
                          items={order}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="space-y-2">
                            {order.map((key) => (
                              <SortableItem key={key} id={key}>
                                {SECTION_LABELS[key]}
                              </SortableItem>
                            ))}
                          </ul>
                        </SortableContext>
                      )}
                    </div>
                  </ScrollArea>
                </DndContext>
              </div>

              <div className="flex items-center justify-between flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetToDefault}
                  className="neo-card hover:neo-glow-sm"
                >
                  <RotateCcwIcon className="mr-2 h-4 w-4 drop-shadow-[0_0_6px_rgba(248,113,113,0.4)]" />{" "}
                  Reset
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave || updatePreferences.isPending}
                  className="neo-gradient text-white hover:opacity-90"
                >
                  <SaveIcon className="mr-2 h-4 w-4 drop-shadow-[0_0_6px_rgba(20,184,166,0.5)]" />
                  {updatePreferences.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;

function AccountsPanel() {
  const { data: accounts = [] } = useAccounts();
  const setDefaultMutation = useSetDefaultAccount();
  const defaultAccount = accounts.find((a: any) => a.is_default);

  const handleSetDefault = async (accountId: string) => {
    try {
      await setDefaultMutation.mutateAsync(accountId);
      toast.success("Default account updated!");
    } catch (error) {
      console.error("Failed to set default account:", error);
      toast.error("Failed to set default account");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[hsl(var(--nav-text-primary))]">
          Default Account
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select your default account for quick expense entry
        </p>
      </div>

      <RadioGroup
        value={defaultAccount?.id || ""}
        onValueChange={handleSetDefault}
        className="space-y-2"
      >
        {accounts.map((account: any) => (
          <div
            key={account.id}
            className="neo-card flex items-center gap-3 rounded-xl p-3 hover:neo-glow-sm transition-all cursor-pointer"
          >
            <RadioGroupItem
              id={`account-${account.id}`}
              value={account.id}
              className="flex-shrink-0"
            />
            <Label
              htmlFor={`account-${account.id}`}
              className="flex-1 cursor-pointer"
            >
              <div className="text-sm font-semibold">{account.name}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {account.type}
              </div>
            </Label>
            {account.is_default && (
              <span className="text-xs bg-[hsl(var(--nav-text-primary)/0.2)] text-[hsl(var(--nav-text-primary))] px-2 py-1 rounded-full font-medium">
                Default
              </span>
            )}
          </div>
        ))}
      </RadioGroup>

      {accounts.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-12 neo-card rounded-xl">
          No accounts found
        </div>
      )}
    </div>
  );
}

function HouseholdPanel() {
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/household", { cache: "no-store" });
        const data = await res.json();
        if (!ignore) setLink(data?.link ?? null);
      } catch (e: any) {
        if (!ignore) setError(e?.message || "Failed to load");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  if (loading)
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        Loading…
      </div>
    );
  if (error)
    return (
      <div className="text-sm text-red-600 neo-card p-4 rounded-xl">
        {error}
      </div>
    );

  if (!link)
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-[hsl(var(--nav-text-primary))]">
            Household Link
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            No household linked yet. Create a code to link with your partner.
          </p>
        </div>
        <Button
          type="button"
          onClick={async () => {
            setError(null);
            setLoading(true);
            try {
              const res = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_type: "household" }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data?.error || "Failed");
              const res2 = await fetch("/api/household", {
                cache: "no-store",
              });
              const d2 = await res2.json();
              setLink(d2?.link ?? { code: data?.code });
            } catch (e: any) {
              setError(e?.message || "Failed to generate code");
            } finally {
              setLoading(false);
            }
          }}
          className="neo-gradient text-white hover:opacity-90"
        >
          Create Household Code
        </Button>
        <p className="text-sm text-muted-foreground">
          Or use the avatar menu → Link household to enter a code.
        </p>
        {error ? (
          <div className="text-sm text-red-600 neo-card p-4 rounded-xl">
            {error}
          </div>
        ) : null}
      </div>
    );

  const isLinked = Boolean(link.partner_user_id);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[hsl(var(--nav-text-primary))]">
          Household Status
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your household connection
        </p>
      </div>

      <div className="neo-card p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          {isLinked ? (
            <span className="text-sm font-semibold text-green-500">
              ✓ Linked
            </span>
          ) : (
            <span className="text-sm font-semibold text-yellow-500">
              ⏳ Awaiting Partner
            </span>
          )}
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Owner</span>
            <span className="text-sm font-medium">
              {link.owner_email || link.owner_user_id}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Partner</span>
            <span className="text-sm font-medium">
              {link.partner_email || link.partner_user_id || "—"}
            </span>
          </div>
        </div>
      </div>

      {!isLinked && link.code ? (
        <div className="neo-card p-4 rounded-xl space-y-2">
          <div className="text-sm font-medium text-[hsl(var(--nav-text-primary))]">
            Share this code:
          </div>
          <div className="font-mono tracking-widest text-2xl font-bold text-center py-3 bg-[hsl(var(--header-bg)/0.5)] rounded-lg">
            {link.code}
          </div>
        </div>
      ) : null}
    </div>
  );
}

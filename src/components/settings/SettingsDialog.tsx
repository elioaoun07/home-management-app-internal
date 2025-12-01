"use client";

import {
  MonitorIcon,
  RotateCcwIcon,
  SaveIcon,
  SmartphoneIcon,
  WatchIcon,
} from "@/components/icons/FuturisticIcons";
import { CategoryManagement } from "@/components/settings/CategoryManagement";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/contexts/ThemeContext";
import { useMyAccounts, useSetDefaultAccount } from "@/features/accounts/hooks";
import {
  useSectionOrder,
  useUpdatePreferences,
  type SectionKey,
} from "@/features/preferences/useSectionOrder";
import { useThemeClasses } from "@/hooks/useThemeClasses";
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
import { useEffect, useMemo, useState } from "react";
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

type SectionType =
  | "theme"
  | "view"
  | "accounts"
  | "categories"
  | "steps"
  | "household"
  | "statement";

export function SettingsDialog({ open, onOpenChange }: Props) {
  const { theme: colorTheme, setTheme, isLoading: themeLoading } = useTheme();
  const themeClasses = useThemeClasses();
  const { viewMode, updateViewMode } = useViewMode();
  const [activeSection, setActiveSection] = useState<SectionType>("theme");

  // Section order state
  const { data: serverOrderArray } = useSectionOrder();
  const initialOrder = Array.isArray(serverOrderArray) ? serverOrderArray : [];
  const [order, setOrder] = useState<SectionKey[]>(() =>
    initialOrder.length ? initialOrder : []
  );
  const [activeId, setActiveId] = useState<SectionKey | null>(null);
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

  function resetToDefault() {
    const so = Array.isArray(serverOrderArray) ? serverOrderArray : null;
    if (!so) return;
    setOrder(
      (so as SectionKey[]) ?? ["amount", "account", "category", "subcategory"]
    );
  }

  async function handleSave() {
    try {
      await updatePreferences.mutateAsync({ section_order: order });
      toast.success("Steps order saved!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save");
    }
  }

  // DnD sensors
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

  const sections: { id: SectionType; label: string }[] = [
    { id: "theme", label: "Theme" },
    { id: "view", label: "View" },
    { id: "accounts", label: "Accounts" },
    { id: "categories", label: "Categories" },
    { id: "steps", label: "Steps" },
    { id: "household", label: "Household" },
    { id: "statement", label: "Statement Import" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`sm:max-w-[720px] max-h-[90vh] p-0 gap-0 ${themeClasses.dialogBg} backdrop-blur-xl border-2 ${themeClasses.border} rounded-3xl overflow-hidden`}
      >
        {/* Header */}
        <DialogHeader
          className={`px-8 pt-8 pb-6 border-b ${themeClasses.border}`}
        >
          <DialogTitle className="text-3xl font-bold">
            <span
              className={`bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent ${themeClasses.glow}`}
            >
              Settings
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div
            className={`md:w-48 border-b md:border-b-0 md:border-r ${themeClasses.border} ${themeClasses.bgSurface} overflow-hidden`}
          >
            <div className="overflow-x-auto md:overflow-x-visible p-4 md:p-6">
              <nav className="flex md:flex-col gap-1 min-w-max md:min-w-0">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      px-4 py-3 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap
                      ${
                        activeSection === section.id
                          ? `bg-gradient-to-r ${themeClasses.activeItemGradient} ${themeClasses.text} ${themeClasses.activeItemShadow}`
                          : `${themeClasses.textFaint} ${themeClasses.textHover} ${themeClasses.bgHover}`
                      }
                    `}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1 p-6 md:p-8">
            {/* THEME SECTION */}
            {activeSection === "theme" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h3
                    className={`text-lg font-semibold ${themeClasses.text} mb-1`}
                  >
                    Color Theme
                  </h3>
                  <p className={`text-sm ${themeClasses.textMuted}`}>
                    Choose your app color scheme
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={async () => {
                      await setTheme("blue");
                    }}
                    disabled={themeLoading}
                    className={`group relative neo-card p-8 rounded-2xl hover:scale-[1.02] transition-all disabled:opacity-50 ${
                      colorTheme === "blue"
                        ? "ring-2 ring-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                        : ""
                    }`}
                  >
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#3b82f6] via-[#06b6d4] to-[#14b8a6] shadow-[0_0_30px_rgba(59,130,246,0.5)] mb-4"></div>
                    <p className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-teal bg-clip-text text-transparent">
                      Blue
                    </p>
                    {colorTheme === "blue" && (
                      <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center text-slate-900 text-xs font-bold">
                        ✓
                      </div>
                    )}
                  </button>

                  <button
                    onClick={async () => {
                      await setTheme("pink");
                    }}
                    disabled={themeLoading}
                    className={`group relative neo-card p-8 rounded-2xl hover:scale-[1.02] transition-all disabled:opacity-50 ${
                      colorTheme === "pink"
                        ? "ring-2 ring-pink-400 shadow-[0_0_30px_rgba(236,72,153,0.3)]"
                        : ""
                    }`}
                  >
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#ec4899] via-[#f472b6] to-[#fbbf24] shadow-[0_0_30px_rgba(236,72,153,0.5)] mb-4"></div>
                    <p className="text-lg font-bold bg-gradient-to-r from-pink-400 to-amber-400 bg-clip-text text-transparent">
                      Pink
                    </p>
                    {colorTheme === "pink" && (
                      <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-pink-400 flex items-center justify-center text-slate-900 text-xs font-bold">
                        ✓
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* VIEW SECTION */}
            {activeSection === "view" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h3
                    className={`text-lg font-semibold ${themeClasses.text} mb-1`}
                  >
                    View Mode
                  </h3>
                  <p className={`text-sm ${themeClasses.textMuted}`}>
                    Choose your preferred interface
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      mode: "mobile" as ViewMode,
                      Icon: SmartphoneIcon,
                      label: "Mobile",
                      desc: "Optimized for touch",
                    },
                    {
                      mode: "web" as ViewMode,
                      Icon: MonitorIcon,
                      label: "Web",
                      desc: "Desktop experience",
                    },
                    {
                      mode: "watch" as ViewMode,
                      Icon: WatchIcon,
                      label: "Watch",
                      desc: "Minimal interface",
                    },
                  ].map(({ mode, Icon, label, desc }) => (
                    <button
                      key={mode}
                      onClick={() => {
                        updateViewMode(mode);
                        toast.success(`Switched to ${label} view`);
                        setTimeout(() => {
                          onOpenChange(false);
                          window.location.reload();
                        }, 500);
                      }}
                      className={`
                        w-full neo-card p-5 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.01]
                        ${
                          viewMode === mode
                            ? `ring-2 ${themeClasses.ringActive} ${themeClasses.shadowActive}`
                            : "hover:bg-[hsl(var(--card)/0.8)]"
                        }
                      `}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${themeClasses.iconBg} flex items-center justify-center`}
                      >
                        <Icon className={`w-6 h-6 ${themeClasses.text}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p
                          className={`font-semibold ${themeClasses.textHighlight}`}
                        >
                          {label}
                        </p>
                        <p className={`text-xs ${themeClasses.textFaint}`}>
                          {desc}
                        </p>
                      </div>
                      {viewMode === mode && (
                        <div
                          className={`px-3 py-1 rounded-full ${themeClasses.bgActive} ${themeClasses.textActive} text-xs font-medium`}
                        >
                          Active
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ACCOUNTS SECTION */}
            {activeSection === "accounts" && <AccountsPanel />}

            {/* CATEGORIES SECTION */}
            {activeSection === "categories" && <CategoryManagement />}

            {/* STEPS SECTION */}
            {activeSection === "steps" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h3
                    className={`text-lg font-semibold ${themeClasses.text} mb-1`}
                  >
                    Entry Steps Order
                  </h3>
                  <p className={`text-sm ${themeClasses.textMuted}`}>
                    Drag to reorder expense entry steps
                  </p>
                </div>

                <div className="neo-card rounded-2xl border border-[hsl(var(--header-border)/0.2)] overflow-hidden">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                    modifiers={[
                      restrictToParentElement,
                      restrictToVerticalAxis,
                    ]}
                  >
                    <div className="p-4">
                      {!serverOrderArray || serverOrderArray.length === 0 ? (
                        <div
                          className={`h-40 flex items-center justify-center ${themeClasses.textFaint}`}
                        >
                          Loading...
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
                  </DndContext>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={resetToDefault}
                    variant="outline"
                    className={`flex-1 ${themeClasses.borderHover}`}
                  >
                    <RotateCcwIcon className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!canSave || updatePreferences.isPending}
                    className={`flex-1 neo-gradient ${themeClasses.textButton} font-semibold`}
                  >
                    <SaveIcon className="mr-2 h-4 w-4" />
                    {updatePreferences.isPending ? "Saving..." : "Save Order"}
                  </Button>
                </div>
              </div>
            )}

            {/* HOUSEHOLD SECTION */}
            {activeSection === "household" && <HouseholdPanel />}

            {/* STATEMENT IMPORT SECTION */}
            {activeSection === "statement" && <StatementImportPanel />}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;

function AccountsPanel() {
  const { data: accounts = [] } = useMyAccounts();
  const themeClasses = useThemeClasses();
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h3 className={`text-lg font-semibold ${themeClasses.text} mb-1`}>
          Default Account
        </h3>
        <p className={`text-sm ${themeClasses.textMuted}`}>
          Choose your primary account
        </p>
      </div>

      {accounts.length === 0 ? (
        <div
          className={`neo-card p-12 rounded-2xl text-center ${themeClasses.textFaint}`}
        >
          No accounts found
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account: any) => (
            <button
              key={account.id}
              onClick={() => handleSetDefault(account.id)}
              className={`
                w-full neo-card p-5 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.01]
                ${
                  account.is_default
                    ? `ring-2 ${themeClasses.ringActive} ${themeClasses.shadowActive}`
                    : "hover:bg-[hsl(var(--card)/0.8)]"
                }
              `}
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${themeClasses.iconBg} flex items-center justify-center`}
              >
                <span className="text-xl">
                  {account.type === "cash"
                    ? "💵"
                    : account.type === "bank"
                      ? "🏦"
                      : "💳"}
                </span>
              </div>
              <div className="flex-1 text-left">
                <p className={`font-semibold ${themeClasses.textHighlight}`}>
                  {account.name}
                </p>
                <p className={`text-xs ${themeClasses.textFaint} capitalize`}>
                  {account.type}
                </p>
              </div>
              {account.is_default && (
                <div
                  className={`px-3 py-1 rounded-full ${themeClasses.bgActive} ${themeClasses.textActive} text-xs font-medium`}
                >
                  Default
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HouseholdPanel() {
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const themeClasses = useThemeClasses();

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
      <div
        className={`flex items-center justify-center py-20 ${themeClasses.textFaint}`}
      >
        Loading...
      </div>
    );

  if (error)
    return (
      <div className="neo-card p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
        {error}
      </div>
    );

  if (!link) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h3 className={`text-lg font-semibold ${themeClasses.text} mb-1`}>
            Household Linking
          </h3>
          <p className={`text-sm ${themeClasses.textMuted}`}>
            Create a code to share with your partner
          </p>
        </div>

        <div className="neo-card p-8 rounded-2xl text-center space-y-4">
          <div
            className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${themeClasses.iconBg} flex items-center justify-center text-4xl`}
          >
            👥
          </div>
          <p className={themeClasses.textHighlight}>
            No household link created yet
          </p>
          <Button
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
                toast.success("Household code created!");
              } catch (e: any) {
                setError(e?.message || "Failed to generate code");
                toast.error("Failed to create code");
              } finally {
                setLoading(false);
              }
            }}
            className={`neo-gradient ${themeClasses.textButton} font-semibold`}
          >
            Create Household Code
          </Button>
        </div>
      </div>
    );
  }

  const isLinked = Boolean(link.partner_user_id);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h3 className={`text-lg font-semibold ${themeClasses.text} mb-1`}>
          Household Status
        </h3>
        <p className={`text-sm ${themeClasses.textMuted}`}>
          Your household connection details
        </p>
      </div>

      <div className="neo-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-[hsl(var(--header-border)/0.2)]">
          <span className={`${themeClasses.textHighlight} font-medium`}>
            Status
          </span>
          {isLinked ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
              <span>✓</span>
              <span>Linked</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
              <span>⏳</span>
              <span>Pending</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${themeClasses.textFaint}`}>Owner</span>
            <span
              className={`text-sm font-medium ${themeClasses.textHighlight} truncate ml-4`}
            >
              {link.owner_email || link.owner_user_id}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${themeClasses.textFaint}`}>Partner</span>
            <span
              className={`text-sm font-medium ${themeClasses.textHighlight} truncate ml-4`}
            >
              {link.partner_email || link.partner_user_id || "—"}
            </span>
          </div>
        </div>
      </div>

      {!isLinked && link.code && (
        <div className="neo-card p-6 rounded-2xl space-y-4 text-center">
          <p className={`text-sm font-medium ${themeClasses.text}`}>
            Share this code:
          </p>
          <div
            className={`font-mono tracking-[0.5em] text-3xl font-bold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent py-4`}
          >
            {link.code}
          </div>
          <p className={`text-xs ${themeClasses.textFaint}`}>
            Your partner can enter this code to link accounts
          </p>
        </div>
      )}
    </div>
  );
}

function StatementImportPanel() {
  const themeClasses = useThemeClasses();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showMappingsDialog, setShowMappingsDialog] = useState(false);

  // Dynamically import the dialogs to avoid circular dependencies
  const StatementImportDialog =
    require("@/components/statement-import/StatementImportDialog").StatementImportDialog;
  const MerchantMappingsManager =
    require("@/components/statement-import/MerchantMappingsManager").MerchantMappingsManager;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h3 className={`text-lg font-semibold ${themeClasses.text} mb-1`}>
          Bank Statement Import
        </h3>
        <p className={`text-sm ${themeClasses.textMuted}`}>
          Upload PDF bank statements to import transactions automatically
        </p>
      </div>

      <div className="space-y-4">
        {/* Import Statement Button */}
        <button
          onClick={() => setShowImportDialog(true)}
          className={`
            w-full neo-card p-5 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.01]
            hover:bg-[hsl(var(--card)/0.8)]
          `}
        >
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${themeClasses.iconBg} flex items-center justify-center`}
          >
            <span className="text-xl">📄</span>
          </div>
          <div className="flex-1 text-left">
            <p className={`font-semibold ${themeClasses.textHighlight}`}>
              Import Statement
            </p>
            <p className={`text-xs ${themeClasses.textFaint}`}>
              Upload a PDF bank statement
            </p>
          </div>
        </button>

        {/* Manage Mappings Button */}
        <button
          onClick={() => setShowMappingsDialog(true)}
          className={`
            w-full neo-card p-5 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.01]
            hover:bg-[hsl(var(--card)/0.8)]
          `}
        >
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${themeClasses.iconBg} flex items-center justify-center`}
          >
            <span className="text-xl">🏷️</span>
          </div>
          <div className="flex-1 text-left">
            <p className={`font-semibold ${themeClasses.textHighlight}`}>
              Merchant Mappings
            </p>
            <p className={`text-xs ${themeClasses.textFaint}`}>
              View and manage learned merchant categories
            </p>
          </div>
        </button>
      </div>

      {/* Info Box */}
      <div className={`p-4 rounded-xl ${themeClasses.bgSurface}`}>
        <h4 className={`font-medium ${themeClasses.text} mb-2`}>
          💡 How it works:
        </h4>
        <ul
          className={`text-sm space-y-1 ${themeClasses.textMuted} list-disc list-inside`}
        >
          <li>Upload your bank statement PDF</li>
          <li>The system extracts transactions automatically</li>
          <li>
            Known merchants (Toters, Spinneys, Alfa...) are auto-categorized
          </li>
          <li>Assign categories to unknown merchants to train the system</li>
          <li>Future imports will remember your choices!</li>
        </ul>
      </div>

      {/* Dialogs */}
      <StatementImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />
      <MerchantMappingsManager
        open={showMappingsDialog}
        onOpenChange={setShowMappingsDialog}
      />
    </div>
  );
}

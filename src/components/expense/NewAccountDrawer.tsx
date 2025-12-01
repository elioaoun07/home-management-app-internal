"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateAccount } from "@/features/accounts/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/types/domain";
import { FolderTree, MapPin, PenLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Common country codes for quick selection
const POPULAR_COUNTRIES = [
  { code: "LB", name: "Lebanon" },
  { code: "US", name: "United States" },
  { code: "AE", name: "UAE" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "TR", name: "Turkey" },
  { code: "EG", name: "Egypt" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "JO", name: "Jordan" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated?: (accountId: string) => void;
};

export default function NewAccountDrawer({
  open,
  onOpenChange,
  onAccountCreated,
}: Props) {
  const themeClasses = useThemeClasses();
  const createAccountMutation = useCreateAccount();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("expense");
  const [countryCode, setCountryCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [withDefaultCategories, setWithDefaultCategories] = useState(true);

  const resetForm = () => {
    setName("");
    setType("expense");
    setCountryCode("");
    setLocationName("");
    setShowCountryPicker(false);
    setWithDefaultCategories(true);
  };

  const handleSelectCountry = (code: string, countryName: string) => {
    setCountryCode(code);
    setLocationName(countryName);
    setShowCountryPicker(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter an account name", { icon: ToastIcons.error });
      return;
    }

    createAccountMutation.mutate(
      {
        name: name.trim(),
        type,
        country_code: countryCode || undefined,
        location_name: locationName || undefined,
        with_default_categories: withDefaultCategories,
      },
      {
        onSuccess: (account) => {
          toast.success("Account created!", {
            icon: ToastIcons.create,
            description: `${account.name} (${account.type})${account.location_name ? ` - ${account.location_name}` : ""}`,
          });
          resetForm();
          onOpenChange(false);
          onAccountCreated?.(account.id);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to create account", {
            icon: ToastIcons.error,
          });
        },
      }
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-bg-dark border-t border-slate-800 max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle
            className={`text-lg font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
          >
            Create New Account
          </DrawerTitle>
          <DrawerDescription className="text-slate-400 text-sm">
            Add a new account to track your finances
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto">
          {/* Account Name */}
          <div className="space-y-2">
            <Label className={`text-sm font-medium ${themeClasses.text}`}>
              Account Name <span className="text-red-400">*</span>
            </Label>
            <Input
              type="text"
              placeholder="e.g., Cash, Credit Card, Trip to Paris..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(
                "h-12 bg-bg-card-custom text-white placeholder:text-slate-500",
                themeClasses.border,
                themeClasses.focusBorder,
                "focus:ring-2",
                themeClasses.focusRing
              )}
              autoFocus
            />
          </div>

          {/* Account Type */}
          <div className="space-y-2">
            <Label className={`text-sm font-medium ${themeClasses.text}`}>
              Account Type <span className="text-red-400">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setType("expense")}
                className={cn(
                  "p-3 rounded-xl border text-center transition-all active:scale-95",
                  type === "expense"
                    ? `neo-card ${themeClasses.borderActive} bg-gradient-to-br from-red-500/20 to-orange-500/10 shadow-lg shadow-red-500/10`
                    : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover}`
                )}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center",
                      type === "expense" ? "bg-red-500/20" : "bg-slate-700/50"
                    )}
                  >
                    <svg
                      className={cn(
                        "w-4 h-4",
                        type === "expense" ? "text-red-400" : "text-slate-400"
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                  <span
                    className={cn(
                      "font-semibold text-sm",
                      type === "expense" ? "text-red-400" : "text-slate-300"
                    )}
                  >
                    Expense
                  </span>
                </div>
              </button>

              <button
                onClick={() => setType("income")}
                className={cn(
                  "p-3 rounded-xl border text-center transition-all active:scale-95",
                  type === "income"
                    ? `neo-card ${themeClasses.borderActive} bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 shadow-lg shadow-emerald-500/10`
                    : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover}`
                )}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center",
                      type === "income"
                        ? "bg-emerald-500/20"
                        : "bg-slate-700/50"
                    )}
                  >
                    <svg
                      className={cn(
                        "w-4 h-4",
                        type === "income"
                          ? "text-emerald-400"
                          : "text-slate-400"
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                      />
                    </svg>
                  </div>
                  <span
                    className={cn(
                      "font-semibold text-sm",
                      type === "income" ? "text-emerald-400" : "text-slate-300"
                    )}
                  >
                    Income
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Category Setup (only for expense accounts) */}
          {type === "expense" && (
            <div className="space-y-2">
              <Label className={`text-sm font-medium ${themeClasses.text}`}>
                Category Setup
              </Label>
              <p className="text-[11px] text-slate-500 -mt-1">
                Choose how to set up categories for this account
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setWithDefaultCategories(true)}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all active:scale-95",
                    withDefaultCategories
                      ? `neo-card ${themeClasses.borderActive} bg-gradient-to-br from-blue-500/20 to-cyan-500/10 shadow-lg shadow-blue-500/10`
                      : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover}`
                  )}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center",
                        withDefaultCategories
                          ? "bg-blue-500/20"
                          : "bg-slate-700/50"
                      )}
                    >
                      <FolderTree
                        className={cn(
                          "w-4 h-4",
                          withDefaultCategories
                            ? "text-blue-400"
                            : "text-slate-400"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "font-semibold text-sm",
                        withDefaultCategories
                          ? "text-blue-400"
                          : "text-slate-300"
                      )}
                    >
                      Default
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Pre-configured categories
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => setWithDefaultCategories(false)}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all active:scale-95",
                    !withDefaultCategories
                      ? `neo-card ${themeClasses.borderActive} bg-gradient-to-br from-amber-500/20 to-orange-500/10 shadow-lg shadow-amber-500/10`
                      : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover}`
                  )}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center",
                        !withDefaultCategories
                          ? "bg-amber-500/20"
                          : "bg-slate-700/50"
                      )}
                    >
                      <PenLine
                        className={cn(
                          "w-4 h-4",
                          !withDefaultCategories
                            ? "text-amber-400"
                            : "text-slate-400"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "font-semibold text-sm",
                        !withDefaultCategories
                          ? "text-amber-400"
                          : "text-slate-300"
                      )}
                    >
                      Empty
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Create manually
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Location / Country (Optional) */}
          <div className="space-y-2">
            <Label className={`text-sm font-medium ${themeClasses.text}`}>
              Location{" "}
              <span className="text-slate-500 font-normal">(optional)</span>
            </Label>
            <p className="text-[11px] text-slate-500 -mt-1">
              For trip tracking on the world map
            </p>

            {!showCountryPicker && !countryCode ? (
              <button
                onClick={() => setShowCountryPicker(true)}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                  `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover}`
                )}
              >
                <MapPin className="w-5 h-5 text-slate-500" />
                <span className="text-slate-400">Add a country...</span>
              </button>
            ) : countryCode ? (
              <div
                className={cn(
                  "w-full p-3 rounded-lg border flex items-center justify-between",
                  `neo-card ${themeClasses.borderActive} bg-blue-500/10`
                )}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-white font-medium">{locationName}</p>
                    <p className="text-[11px] text-slate-500">{countryCode}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCountryCode("");
                    setLocationName("");
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <svg
                    className="w-4 h-4 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : null}

            {showCountryPicker && (
              <div className="space-y-2 mt-2">
                <div className="grid grid-cols-3 gap-2">
                  {POPULAR_COUNTRIES.map((country) => (
                    <button
                      key={country.code}
                      onClick={() =>
                        handleSelectCountry(country.code, country.name)
                      }
                      className={cn(
                        "p-2 rounded-lg border text-center transition-all active:scale-95",
                        `neo-card ${themeClasses.border} bg-bg-card-custom hover:border-blue-500/50`
                      )}
                    >
                      <span className="text-xs font-medium text-white">
                        {country.name}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Country code (e.g., US)"
                    value={countryCode}
                    onChange={(e) =>
                      setCountryCode(e.target.value.toUpperCase().slice(0, 2))
                    }
                    maxLength={2}
                    className={cn(
                      "h-10 bg-bg-card-custom text-white placeholder:text-slate-500 w-24",
                      themeClasses.border
                    )}
                  />
                  <Input
                    type="text"
                    placeholder="Location name"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className={cn(
                      "h-10 bg-bg-card-custom text-white placeholder:text-slate-500 flex-1",
                      themeClasses.border
                    )}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCountryPicker(false)}
                    className={cn(
                      "flex-1 bg-transparent",
                      themeClasses.border,
                      themeClasses.text
                    )}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowCountryPicker(false)}
                    disabled={!countryCode || !locationName}
                    className="flex-1 neo-gradient text-white border-0"
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DrawerFooter className="pt-2 pb-6">
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createAccountMutation.isPending}
            className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createAccountMutation.isPending ? "Creating..." : "Create Account"}
          </Button>
          <DrawerClose asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full h-11 bg-transparent",
                themeClasses.border,
                themeClasses.text
              )}
            >
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

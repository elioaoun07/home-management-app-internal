// src/components/scanner/QRScannerDrawer.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useAddTransaction } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { Scanner } from "@yudiel/react-qr-scanner";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface QRScannerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedQRData {
  account?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  amount?: string;
}

export default function QRScannerDrawer({
  open,
  onOpenChange,
}: QRScannerDrawerProps) {
  const themeClasses = useThemeClasses();
  const addTransactionMutation = useAddTransaction();

  // Scanned data
  const [scannedData, setScannedData] = useState<ParsedQRData | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Form state for confirmation
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // Resolved IDs
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>(
    undefined,
  );
  const [displayTitle, setDisplayTitle] = useState("");

  // Fetch accounts
  const { data: accounts = [] } = useAccounts();

  // Fetch categories for the resolved account
  const { data: categories = [] } = useCategories(accountId);

  // Parse QR code URL
  const parseQRUrl = (url: string): ParsedQRData | null => {
    try {
      const parsed = new URL(url);
      // Check if it's our app's QR expense URL
      if (parsed.pathname.includes("/qr/expense")) {
        return {
          account: parsed.searchParams.get("account") || undefined,
          category: parsed.searchParams.get("category") || undefined,
          subcategory: parsed.searchParams.get("subcategory") || undefined,
          description: parsed.searchParams.get("description") || undefined,
          amount: parsed.searchParams.get("amount") || undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Handle QR scan result
  const handleScan = (result: { rawValue: string }[]) => {
    if (result && result.length > 0) {
      const rawValue = result[0].rawValue;
      const data = parseQRUrl(rawValue);

      if (data) {
        setScannedData(data);
        setAmount(data.amount || "");
        setDescription(data.description || "");
        onOpenChange(false); // Close scanner
        setShowConfirmDialog(true); // Show confirmation
      } else {
        toast.error("Unrecognized QR code");
      }
    }
  };

  // Resolve account ID from name when scanned data changes
  useEffect(() => {
    if (!scannedData || accounts.length === 0) return;

    if (scannedData.account) {
      const acc = accounts.find(
        (a: any) => a.name.toLowerCase() === scannedData.account?.toLowerCase(),
      );
      if (acc) setAccountId(acc.id);
    } else {
      // Fallback to default account
      const defaultAcc = accounts.find((a: any) => a.is_default);
      if (defaultAcc) setAccountId(defaultAcc.id);
    }
  }, [scannedData, accounts]);

  // Resolve category and subcategory when categories load
  useEffect(() => {
    if (!scannedData || categories.length === 0 || !scannedData.category)
      return;

    // Find parent category
    const cat = (categories as any[]).find(
      (c) =>
        c.name?.toLowerCase() === scannedData.category?.toLowerCase() &&
        !c.parent_id,
    );

    if (cat) {
      setCategoryId(cat.id);

      // Find subcategory
      if (scannedData.subcategory) {
        // Check nested subcategories
        if (cat.subcategories) {
          const sub = cat.subcategories.find(
            (s: any) =>
              s.name?.toLowerCase() === scannedData.subcategory?.toLowerCase(),
          );
          if (sub) setSubcategoryId(sub.id);
        } else {
          // Flat structure
          const sub = (categories as any[]).find(
            (c) =>
              c.parent_id === cat.id &&
              c.name?.toLowerCase() === scannedData.subcategory?.toLowerCase(),
          );
          if (sub) setSubcategoryId(sub.id);
        }
      }

      // Build display title
      setDisplayTitle(
        [scannedData.category, scannedData.subcategory]
          .filter(Boolean)
          .join(" → "),
      );
    }
  }, [scannedData, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !categoryId || !amount) {
      toast.error("Missing account or category");
      return;
    }

    const date = new Date().toISOString().split("T")[0];

    // Close dialog immediately
    setShowConfirmDialog(false);
    setScannedData(null);

    // Add transaction
    addTransactionMutation.mutate(
      {
        account_id: accountId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        amount: parseFloat(amount),
        description: description || undefined,
        date: date,
      },
      {
        onSuccess: () => {
          toast.success("Transaction added!", {
            icon: ToastIcons.create,
            description: `$${parseFloat(amount).toFixed(2)} - ${displayTitle}`,
          });
          // Reset state
          setAccountId(undefined);
          setCategoryId(undefined);
          setSubcategoryId(undefined);
          setAmount("");
          setDescription("");
          setDisplayTitle("");
        },
        onError: (err) => {
          console.error("QR expense failed", err);
          toast.error("Failed to add expense", { icon: ToastIcons.error });
        },
      },
    );
  };

  const handleCloseConfirm = () => {
    setShowConfirmDialog(false);
    setScannedData(null);
    setAccountId(undefined);
    setCategoryId(undefined);
    setSubcategoryId(undefined);
    setAmount("");
    setDescription("");
    setDisplayTitle("");
  };

  const isReady = accountId && categoryId;

  return (
    <>
      {/* Scanner Drawer */}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[85vh] bg-black">
          <DrawerHeader className="relative">
            <DrawerTitle className="text-white text-center">
              Scan QR Code
            </DrawerTitle>
            <DrawerDescription className="text-white/60 text-center">
              Point your camera at a Budget Manager QR code
            </DrawerDescription>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 text-white"
              >
                <XIcon className="w-5 h-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 px-4 pb-4">
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              {open && (
                <Scanner
                  onScan={handleScan}
                  onError={(error) => {
                    console.error("Scanner error:", error);
                  }}
                  constraints={{
                    facingMode: "environment",
                  }}
                  styles={{
                    container: {
                      width: "100%",
                      height: "100%",
                    },
                    video: {
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    },
                  }}
                  components={{
                    finder: true,
                  }}
                />
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={handleCloseConfirm}>
        <DialogContent className={cn("neo-card", themeClasses.border)}>
          <DialogHeader>
            <DialogTitle className={themeClasses.dialogTitle}>
              {!isReady
                ? "Loading..."
                : `Confirm Transaction: ${displayTitle || "Expense"}`}
            </DialogTitle>
          </DialogHeader>

          {!isReady ? (
            <div className="py-8 text-center text-muted-foreground">
              Resolving account and category...
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <Label className={themeClasses.headerText}>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                  className={`${themeClasses.inputBg} ${themeClasses.border} text-white`}
                  disabled={addTransactionMutation.isPending}
                />
              </div>
              <div>
                <Label className={themeClasses.headerText}>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes"
                  className={`${themeClasses.inputBg} ${themeClasses.border} text-white`}
                  disabled={addTransactionMutation.isPending}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseConfirm}
                  disabled={addTransactionMutation.isPending}
                  className={`${themeClasses.border} ${themeClasses.headerText}`}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addTransactionMutation.isPending || !amount}
                  className="neo-gradient text-white"
                >
                  {addTransactionMutation.isPending
                    ? "Adding..."
                    : "Add Transaction"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

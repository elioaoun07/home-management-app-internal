"use client";

// src/components/statement-import/StatementImportDialog.tsx
// Main dialog for uploading and reviewing bank statement transactions
// Flow: Upload → Review → Map Keywords → Import

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileTextIcon,
  FilterIcon,
  LayersIcon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import {
  useImportTransactions,
  useParseStatement,
} from "@/features/statement-import/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ParsedTransaction } from "@/types/statement";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "review" | "mapping" | "complete";
type FilterType = "all" | "matched" | "needs-category" | "transfers";

// Keyword group for mapping step
interface KeywordGroup {
  keyword: string;
  suggestedKeywords: string[]; // Smart suggestions
  selectedKeyword: string; // User's chosen keyword
  transactions: ParsedTransaction[];
  category_id: string | null;
  subcategory_id: string | null;
}

export function StatementImportDialog({ open, onOpenChange }: Props) {
  const themeClasses = useThemeClasses();
  const [step, setStep] = useState<Step>("upload");
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState("");
  const [defaultAccountId, setDefaultAccountId] = useState<string>("");
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const { data: accounts = [] } = useMyAccounts();
  const parseStatement = useParseStatement();
  const importTransactions = useImportTransactions();

  // Get expense accounts only
  const expenseAccounts = useMemo(
    () => accounts.filter((a: any) => a.type === "expense"),
    [accounts]
  );

  // Find the default account
  const defaultAccount = useMemo(
    () => expenseAccounts.find((a: any) => a.is_default) || expenseAccounts[0],
    [expenseAccounts]
  );

  // Check if transaction is a transfer (USD account to card)
  const isTransfer = useCallback((txn: ParsedTransaction): boolean => {
    const desc = txn.description.toLowerCase();
    return (
      desc.includes("transfer from") ||
      desc.includes("transfer to") ||
      txn.merchant_name?.toLowerCase().includes("transfer") ||
      false
    );
  }, []);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep("upload");
      setTransactions([]);
      setFileName("");
      setExpandedTxn(null);
      setShowPasteArea(false);
      setCsvText("");
      setFilter("all");
      setKeywordGroups([]);
      setExpandedGroup(null);
    }
    onOpenChange(newOpen);
  };

  // Handle CSV text parsing
  const handleParseCsvText = async () => {
    if (!csvText.trim()) {
      toast.error("Please paste CSV data first");
      return;
    }

    const blob = new Blob([csvText], { type: "text/csv" });
    const file = new File([blob], "pasted-statement.csv", { type: "text/csv" });
    setFileName("Pasted CSV Data");

    await handleFileUpload(file);
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!fileName) setFileName(file.name);

    try {
      const result = await parseStatement.mutateAsync(file);

      // Set default account for all transactions
      const defaultAccId = defaultAccount?.id || expenseAccounts[0]?.id;
      setDefaultAccountId(defaultAccId);

      // Process transactions: auto-unselect transfers
      const txnsWithAccount = result.transactions.map((t) => {
        const desc = t.description.toLowerCase();
        const isXfer =
          desc.includes("transfer from") ||
          desc.includes("transfer to") ||
          t.merchant_name?.toLowerCase().includes("transfer") ||
          false;
        return {
          ...t,
          account_id: t.account_id || defaultAccId,
          // Auto-unselect transfers
          selected: !isXfer,
        };
      });

      setTransactions(txnsWithAccount);
      setStep("review");

      const transferCount = txnsWithAccount.filter((t) => !t.selected).length;
      if (transferCount > 0) {
        toast.info(
          `${transferCount} transfers auto-unselected (USD → Card transfers)`
        );
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to parse statement");
    }
  };

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [defaultAccount]
  );

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Toggle transaction selection
  const toggleSelection = (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  // Toggle all selections (for filtered view)
  const toggleAll = () => {
    const filtered = filteredTransactions;
    const allSelected = filtered.every((t) => t.selected);
    const filteredIds = new Set(filtered.map((t) => t.id));

    setTransactions((prev) =>
      prev.map((t) =>
        filteredIds.has(t.id) ? { ...t, selected: !allSelected } : t
      )
    );
  };

  // Update transaction field
  const updateTransaction = (
    id: string,
    field: keyof ParsedTransaction,
    value: any
  ) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  // Filter transactions based on current filter
  const filteredTransactions = useMemo(() => {
    switch (filter) {
      case "matched":
        return transactions.filter((t) => t.matched);
      case "needs-category":
        return transactions.filter((t) => !t.matched && !t.category_id);
      case "transfers":
        return transactions.filter((t) => isTransfer(t));
      default:
        return transactions;
    }
  }, [transactions, filter, isTransfer]);

  // Filter counts for badges
  const filterCounts = useMemo(() => {
    return {
      all: transactions.length,
      matched: transactions.filter((t) => t.matched).length,
      "needs-category": transactions.filter((t) => !t.matched && !t.category_id)
        .length,
      transfers: transactions.filter((t) => isTransfer(t)).length,
    };
  }, [transactions, isTransfer]);

  // Extract smart keywords from a description
  const extractSmartKeywords = useCallback((description: string): string[] => {
    const keywords: string[] = [];
    const desc = description.toUpperCase();

    // Common patterns to extract
    // 1. Remove transaction type prefix
    let cleaned = desc
      .replace(/^(POS PURCHASE|ONLINE PURCHASE|BILL PAYMENT)\s+/i, "")
      .trim();

    // 2. Remove location suffix (e.g., "BEIRUT LB 1234")
    cleaned = cleaned
      .replace(/\s+(LB|US|AE|GB|FR|DE)\s*\d{4}$/i, "")
      .replace(/\s+\d{4}$/, "")
      .trim();

    // 3. Remove common Lebanese location names at end
    const locations = [
      "BEIRUT",
      "MTAYLEB",
      "HAZMIEH",
      "DBAYEH",
      "DORA",
      "METN",
      "KASLIK",
      "JOUNIEH",
      "TRIPOLI",
      "SAIDA",
      "CORNET CHEHWAN",
      "KORNT CHEHWN",
      "SIN EL FIL",
      "ASHRAFIEH",
      "HAMRA",
      "MATEN",
      "ANTELIAS",
      "JDEIDEH",
      "ZALKA",
      "JBEIL",
      "BYBLOS",
    ];
    for (const loc of locations) {
      cleaned = cleaned.replace(new RegExp(`\\s+${loc}$`, "i"), "").trim();
    }

    // 4. Extract the main merchant name (usually first 1-3 words)
    const words = cleaned.split(/\s+/);
    if (words.length > 0) {
      // Take first word as primary keyword
      keywords.push(words[0]);

      // Take first 2 words if second word isn't a location
      if (words.length > 1 && !locations.includes(words[1])) {
        keywords.push(words.slice(0, 2).join(" "));
      }

      // Take first 3 words for specificity
      if (
        words.length > 2 &&
        !locations.includes(words[1]) &&
        !locations.includes(words[2])
      ) {
        keywords.push(words.slice(0, 3).join(" "));
      }
    }

    // Full cleaned name as option
    if (cleaned && !keywords.includes(cleaned)) {
      keywords.push(cleaned);
    }

    return [...new Set(keywords)]; // Remove duplicates
  }, []);

  // Extract all possible keywords from a group of transactions
  const extractAllKeywords = useCallback(
    (txns: ParsedTransaction[]): string[] => {
      const allKeywords = new Set<string>();

      txns.forEach((txn) => {
        extractSmartKeywords(txn.description).forEach((k) =>
          allKeywords.add(k)
        );
      });

      return Array.from(allKeywords);
    },
    [extractSmartKeywords]
  );

  // Generate smart keyword groups from selected transactions
  const generateKeywordGroups = useCallback(() => {
    const selectedTxns = transactions.filter((t) => t.selected);

    // Group by extracted merchant pattern or smart keyword
    const groups = new Map<string, ParsedTransaction[]>();

    selectedTxns.forEach((txn) => {
      // Extract smart keywords from description
      const keywords = extractSmartKeywords(txn.description);
      const primaryKeyword = keywords[0] || txn.description;

      if (!groups.has(primaryKeyword)) {
        groups.set(primaryKeyword, []);
      }
      groups.get(primaryKeyword)!.push(txn);
    });

    // Convert to KeywordGroup array
    const keywordGroupsArray: KeywordGroup[] = Array.from(groups.entries()).map(
      ([keyword, txns]) => ({
        keyword,
        suggestedKeywords: extractAllKeywords(txns),
        selectedKeyword: keyword,
        transactions: txns,
        category_id: txns[0]?.category_id || null,
        subcategory_id: txns[0]?.subcategory_id || null,
      })
    );

    // Sort by transaction count (most common first)
    keywordGroupsArray.sort(
      (a, b) => b.transactions.length - a.transactions.length
    );

    setKeywordGroups(keywordGroupsArray);
    setStep("mapping");
  }, [transactions, extractSmartKeywords, extractAllKeywords]);

  // Update keyword group category
  const updateGroupCategory = (
    keyword: string,
    field: "category_id" | "subcategory_id" | "selectedKeyword",
    value: string | null
  ) => {
    setKeywordGroups((prev) =>
      prev.map((g) => {
        if (g.keyword === keyword) {
          const updated = { ...g, [field]: value };
          // If changing category, reset subcategory
          if (field === "category_id") {
            updated.subcategory_id = null;
          }
          return updated;
        }
        return g;
      })
    );
  };

  // Handle import with keyword mappings
  const handleImport = async () => {
    // Build transaction list with assigned categories from groups
    const txnsToImport: Array<{
      date: string;
      description: string;
      amount: number;
      category_id: string | null;
      subcategory_id: string | null;
      account_id: string;
      save_merchant_mapping: boolean;
      merchant_pattern: string;
      merchant_name: string;
    }> = [];

    // Create mapping from transaction ID to category assignment
    const categoryMap = new Map<
      string,
      {
        category_id: string | null;
        subcategory_id: string | null;
        keyword: string;
      }
    >();

    keywordGroups.forEach((group) => {
      group.transactions.forEach((txn) => {
        categoryMap.set(txn.id, {
          category_id: group.category_id,
          subcategory_id: group.subcategory_id,
          keyword: group.selectedKeyword,
        });
      });
    });

    // Build import list
    transactions
      .filter((t) => t.selected)
      .forEach((txn) => {
        const mapping = categoryMap.get(txn.id);
        txnsToImport.push({
          date: txn.date,
          description: txn.description,
          amount: txn.type === "debit" ? txn.amount : -txn.amount,
          category_id: mapping?.category_id || txn.category_id || null,
          subcategory_id: mapping?.subcategory_id || txn.subcategory_id || null,
          account_id: txn.account_id!,
          save_merchant_mapping: !txn.matched && !!mapping?.category_id,
          merchant_pattern: mapping?.keyword || txn.description,
          merchant_name:
            mapping?.keyword || txn.merchant_name || txn.description,
        });
      });

    if (txnsToImport.length === 0) {
      toast.error("No transactions to import");
      return;
    }

    try {
      const result = await importTransactions.mutateAsync({
        transactions: txnsToImport,
        file_name: fileName,
      });

      toast.success(
        `Successfully imported ${result.imported_count} transactions`
      );
      setStep("complete");
    } catch (error: any) {
      toast.error(error.message || "Failed to import transactions");
    }
  };

  const selectedCount = transactions.filter((t) => t.selected).length;
  const filteredSelectedCount = filteredTransactions.filter(
    (t) => t.selected
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`sm:max-w-[900px] max-h-[90vh] p-0 gap-0 ${themeClasses.dialogBg} backdrop-blur-xl border-2 ${themeClasses.border} rounded-3xl overflow-hidden flex flex-col`}
      >
        <DialogHeader
          className={`px-8 pt-8 pb-6 border-b ${themeClasses.border} flex-shrink-0`}
        >
          <DialogTitle className="text-2xl font-bold">
            <span
              className={`bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
            >
              {step === "upload" && "Import Bank Statement"}
              {step === "review" && "Review Transactions"}
              {step === "mapping" && "Map Categories"}
              {step === "complete" && "Import Complete"}
            </span>
          </DialogTitle>
          <DialogDescription className={themeClasses.textMuted}>
            {step === "upload" &&
              "Upload your bank statement (PDF or CSV) to extract transactions"}
            {step === "review" &&
              `${selectedCount} of ${transactions.length} transactions selected • Review and filter`}
            {step === "mapping" &&
              `Assign categories to ${keywordGroups.length} merchant groups`}
            {step === "complete" && "Your transactions have been imported"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {/* UPLOAD STEP */}
          {step === "upload" && (
            <div
              className="p-8 overflow-auto"
              style={{ maxHeight: "calc(90vh - 200px)" }}
            >
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`
                  border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
                  transition-all hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.05)]
                  ${themeClasses.border}
                `}
              >
                <input
                  type="file"
                  accept=".pdf,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="statement-file"
                />
                <label
                  htmlFor="statement-file"
                  className="cursor-pointer block"
                >
                  {parseStatement.isPending ? (
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(var(--accent)/0.2)] flex items-center justify-center animate-pulse">
                        <FileTextIcon className="w-8 h-8 text-[hsl(var(--accent))]" />
                      </div>
                      <p className={themeClasses.text}>Processing file...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div
                        className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${themeClasses.iconBg} flex items-center justify-center`}
                      >
                        <UploadIcon className="w-8 h-8 text-[hsl(var(--accent))]" />
                      </div>
                      <div>
                        <p
                          className={`text-lg font-medium ${themeClasses.text}`}
                        >
                          Drop your bank statement here
                        </p>
                        <p className={`text-sm mt-1 ${themeClasses.textMuted}`}>
                          PDF or CSV • Click to browse
                        </p>
                      </div>
                    </div>
                  )}
                </label>
              </div>

              <div className={`mt-6 p-4 rounded-xl ${themeClasses.bgSurface}`}>
                <h4 className={`font-medium ${themeClasses.text} mb-2`}>
                  💡 Tips for best results:
                </h4>
                <ul
                  className={`text-sm space-y-1 ${themeClasses.textMuted} list-disc list-inside`}
                >
                  <li>
                    <strong>CSV recommended</strong> - Copy the statement table
                    from PDF and paste into Excel, then save as CSV
                  </li>
                  <li>
                    CSV format: DATE, TRANSACTIONS, MONEY OUT, MONEY IN, BALANCE
                  </li>
                  <li>Transfers (USD → Card) are auto-unselected</li>
                  <li>Group similar transactions and assign categories once</li>
                </ul>
              </div>

              {/* Paste CSV Option */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowPasteArea(!showPasteArea)}
                  className={`flex items-center gap-2 text-sm ${themeClasses.textMuted} hover:text-[hsl(var(--accent))] transition-colors`}
                >
                  {showPasteArea ? (
                    <ChevronUpIcon className="w-4 h-4" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4" />
                  )}
                  Or paste CSV data directly
                </button>

                {showPasteArea && (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      placeholder={`Paste your statement data here...\n\nExample:\nDATE,TRANSACTIONS,MONEY OUT,MONEY IN,BALANCE\n01/01/2025,POS Purchase SPINNEYS DBAYEH,45.50,-,1234.50`}
                      className={`w-full h-40 px-4 py-3 rounded-xl border ${themeClasses.border} ${themeClasses.bgSurface} ${themeClasses.text} text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]`}
                    />
                    <Button
                      onClick={handleParseCsvText}
                      disabled={!csvText.trim() || parseStatement.isPending}
                      className="w-full"
                    >
                      {parseStatement.isPending
                        ? "Processing..."
                        : "Parse CSV Data"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REVIEW STEP */}
          {step === "review" && (
            <div
              className="flex flex-col"
              style={{ height: "calc(90vh - 200px)" }}
            >
              {/* Filter Header */}
              <div
                className={`px-6 py-3 border-b ${themeClasses.border} flex-shrink-0`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <FilterIcon className="w-4 h-4 text-[hsl(var(--accent))]" />
                  <span className={`text-sm ${themeClasses.textMuted} mr-2`}>
                    Filter:
                  </span>
                  {(
                    [
                      { key: "all", label: "All" },
                      { key: "needs-category", label: "Needs Category" },
                      { key: "matched", label: "Matched" },
                      { key: "transfers", label: "Transfers" },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        filter === key
                          ? "bg-[hsl(var(--accent))] text-white"
                          : `${themeClasses.bgSurface} ${themeClasses.text} hover:bg-[hsl(var(--accent)/0.2)]`
                      }`}
                    >
                      {label}
                      <span className="ml-1 opacity-70">
                        ({filterCounts[key]})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toolbar */}
              <div
                className={`px-6 py-3 border-b ${themeClasses.border} flex items-center justify-between flex-shrink-0`}
              >
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={
                      filteredTransactions.length > 0 &&
                      filteredTransactions.every((t) => t.selected)
                    }
                    onCheckedChange={toggleAll}
                  />
                  <span className={`text-sm ${themeClasses.textMuted}`}>
                    Select all ({filteredSelectedCount}/
                    {filteredTransactions.length})
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Select
                    value={defaultAccountId}
                    onValueChange={(val) => {
                      setDefaultAccountId(val);
                      setTransactions((prev) =>
                        prev.map((t) =>
                          !t.account_id ? { ...t, account_id: val } : t
                        )
                      );
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Default Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseAccounts.map((acc: any) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Transaction List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="divide-y divide-[hsl(var(--border)/0.5)]">
                  {filteredTransactions.map((txn) => (
                    <TransactionRow
                      key={txn.id}
                      transaction={txn}
                      expanded={expandedTxn === txn.id}
                      onToggleExpand={() =>
                        setExpandedTxn(expandedTxn === txn.id ? null : txn.id)
                      }
                      onToggleSelect={() => toggleSelection(txn.id)}
                      onUpdate={(field, value) =>
                        updateTransaction(txn.id, field, value)
                      }
                      accounts={expenseAccounts}
                      isTransfer={isTransfer(txn)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MAPPING STEP */}
          {step === "mapping" && (
            <div
              className="flex flex-col"
              style={{ height: "calc(90vh - 200px)" }}
            >
              <div
                className={`px-6 py-3 border-b ${themeClasses.border} flex-shrink-0`}
              >
                <div className="flex items-center gap-2">
                  <LayersIcon className="w-4 h-4 text-[hsl(var(--accent))]" />
                  <span className={`text-sm ${themeClasses.text}`}>
                    {keywordGroups.length} merchant groups •{" "}
                    {keywordGroups.filter((g) => g.category_id).length} mapped
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-4 space-y-3">
                  {keywordGroups.map((group) => (
                    <KeywordGroupCard
                      key={group.keyword}
                      group={group}
                      expanded={expandedGroup === group.keyword}
                      onToggleExpand={() =>
                        setExpandedGroup(
                          expandedGroup === group.keyword ? null : group.keyword
                        )
                      }
                      onUpdateCategory={(field, value) =>
                        updateGroupCategory(group.keyword, field, value)
                      }
                      accountId={defaultAccountId}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* COMPLETE STEP */}
          {step === "complete" && (
            <div className="p-8 text-center">
              <div
                className={`w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-6`}
              >
                <CheckIcon className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className={`text-xl font-semibold ${themeClasses.text} mb-2`}>
                Import Successful!
              </h3>
              <p className={themeClasses.textMuted}>
                Your transactions have been added to your account.
              </p>
            </div>
          )}
        </div>

        <DialogFooter
          className={`px-8 py-6 border-t ${themeClasses.border} flex-shrink-0`}
        >
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={generateKeywordGroups}
                disabled={selectedCount === 0}
                className={`neo-gradient ${themeClasses.textButton}`}
              >
                Next: Map Categories ({selectedCount})
              </Button>
            </>
          )}

          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("review")}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={importTransactions.isPending}
                className={`neo-gradient ${themeClasses.textButton}`}
              >
                {importTransactions.isPending
                  ? "Importing..."
                  : `Import ${selectedCount} Transactions`}
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button
              onClick={() => handleOpenChange(false)}
              className={`neo-gradient ${themeClasses.textButton}`}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Transaction row component
function TransactionRow({
  transaction,
  expanded,
  onToggleExpand,
  onToggleSelect,
  onUpdate,
  accounts,
  isTransfer,
}: {
  transaction: ParsedTransaction;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onUpdate: (field: keyof ParsedTransaction, value: any) => void;
  accounts: any[];
  isTransfer: boolean;
}) {
  const themeClasses = useThemeClasses();

  return (
    <div className={`${transaction.selected ? "" : "opacity-50"}`}>
      {/* Main row */}
      <div className="px-6 py-3 flex items-center gap-4">
        <Checkbox
          checked={transaction.selected}
          onCheckedChange={onToggleSelect}
        />

        <button
          onClick={onToggleExpand}
          className={`p-1 rounded hover:bg-[hsl(var(--accent)/0.1)]`}
        >
          {expanded ? (
            <ChevronUpIcon className="w-4 h-4" />
          ) : (
            <ChevronDownIcon className="w-4 h-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${themeClasses.text} truncate`}>
              {transaction.merchant_name || transaction.description}
            </span>
            {transaction.matched && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-500">
                Matched
              </span>
            )}
            {!transaction.matched && !transaction.category_id && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-500">
                Needs Category
              </span>
            )}
            {isTransfer && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-500">
                Transfer
              </span>
            )}
          </div>
          <p className={`text-xs ${themeClasses.textMuted} truncate mt-0.5`}>
            {transaction.date}
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <span
            className={`font-semibold ${
              transaction.type === "credit"
                ? "text-emerald-500"
                : themeClasses.text
            }`}
          >
            {transaction.type === "credit" ? "+" : "-"}$
            {transaction.amount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className={`px-6 py-4 ${themeClasses.bgSurface} border-t ${themeClasses.border}`}
        >
          <p className={`text-xs ${themeClasses.textMuted} mb-3 font-mono`}>
            {transaction.description}
          </p>
          <div className="grid grid-cols-3 gap-4">
            {/* Account */}
            <div>
              <label className={`text-xs ${themeClasses.textMuted} mb-1 block`}>
                Account
              </label>
              <Select
                value={transaction.account_id || ""}
                onValueChange={(val) => onUpdate("account_id", val)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Keyword Group Card for mapping step
function KeywordGroupCard({
  group,
  expanded,
  onToggleExpand,
  onUpdateCategory,
  accountId,
}: {
  group: KeywordGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdateCategory: (
    field: "category_id" | "subcategory_id" | "selectedKeyword",
    value: string | null
  ) => void;
  accountId: string;
}) {
  const themeClasses = useThemeClasses();
  const { data: categories = [] } = useCategories(accountId);

  const parentCategories = useMemo(
    () => categories.filter((c: any) => !c.parent_id && c.visible !== false),
    [categories]
  );

  const subcategories = useMemo(() => {
    if (!group.category_id) return [];
    return categories.filter(
      (c: any) => c.parent_id === group.category_id && c.visible !== false
    );
  }, [categories, group.category_id]);

  const totalAmount = group.transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div
      className={`rounded-xl border ${themeClasses.border} overflow-hidden ${
        group.category_id ? "border-emerald-500/50" : ""
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[hsl(var(--accent)/0.05)] ${themeClasses.bgSurface}`}
        onClick={onToggleExpand}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${themeClasses.text}`}>
              {group.selectedKeyword}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${themeClasses.bgSurface} ${themeClasses.textMuted}`}
            >
              {group.transactions.length} txn
              {group.transactions.length !== 1 ? "s" : ""}
            </span>
            {group.category_id && (
              <CheckIcon className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <p className={`text-xs ${themeClasses.textMuted} mt-0.5`}>
            Total: ${totalAmount.toFixed(2)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Select */}
          <Select
            value={group.category_id || "__none__"}
            onValueChange={(val) =>
              onUpdateCategory("category_id", val === "__none__" ? null : val)
            }
          >
            <SelectTrigger
              className="w-[160px] h-9"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select category...</SelectItem>
              {parentCategories.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Subcategory Select */}
          <Select
            value={group.subcategory_id || "__none__"}
            onValueChange={(val) =>
              onUpdateCategory(
                "subcategory_id",
                val === "__none__" ? null : val
              )
            }
            disabled={!group.category_id || subcategories.length === 0}
          >
            <SelectTrigger
              className="w-[140px] h-9"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder="Subcategory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {subcategories.map((sub: any) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.icon} {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={onToggleExpand}
            className={`p-1 rounded hover:bg-[hsl(var(--accent)/0.1)]`}
          >
            {expanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className={`border-t ${themeClasses.border}`}>
          {/* Keyword picker */}
          <div className={`px-4 py-3 ${themeClasses.bgSurface}`}>
            <label
              className={`text-xs ${themeClasses.textMuted} mb-2 block font-medium`}
            >
              Choose keyword for mapping:
            </label>
            <div className="flex flex-wrap gap-2">
              {group.suggestedKeywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => onUpdateCategory("selectedKeyword", kw)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    group.selectedKeyword === kw
                      ? "bg-[hsl(var(--accent))] text-white"
                      : `border ${themeClasses.border} ${themeClasses.text} hover:border-[hsl(var(--accent))]`
                  }`}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction list */}
          <div className="max-h-48 overflow-auto">
            {group.transactions.map((txn, idx) => (
              <div
                key={txn.id}
                className={`px-4 py-2 text-sm flex justify-between ${
                  idx % 2 === 0 ? "" : themeClasses.bgSurface
                }`}
              >
                <span className={`${themeClasses.textMuted} truncate flex-1`}>
                  {txn.date} • {txn.description}
                </span>
                <span className={`${themeClasses.text} ml-4 flex-shrink-0`}>
                  ${txn.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

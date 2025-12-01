"use client";

// src/components/statement-import/MerchantMappingsManager.tsx
// UI for viewing and managing trained merchant mappings

import { PlusIcon, SearchIcon, TrashIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useMyAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import {
  useDeleteMerchantMapping,
  useMerchantMappings,
  useSaveMerchantMapping,
} from "@/features/statement-import/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { MerchantMapping } from "@/types/statement";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MerchantMappingsManager({ open, onOpenChange }: Props) {
  const themeClasses = useThemeClasses();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: mappings = [], isLoading } = useMerchantMappings();
  const deleteMutation = useDeleteMerchantMapping();

  // Filter mappings by search
  const filteredMappings = useMemo(() => {
    if (!search) return mappings;
    const lower = search.toLowerCase();
    return mappings.filter(
      (m) =>
        m.merchant_name.toLowerCase().includes(lower) ||
        m.merchant_pattern.toLowerCase().includes(lower)
    );
  }, [mappings, search]);

  const handleDelete = async (mapping: MerchantMapping) => {
    if (!confirm(`Delete mapping for "${mapping.merchant_name}"?`)) return;

    try {
      await deleteMutation.mutateAsync(mapping.id);
      toast.success("Mapping deleted");
    } catch (error) {
      toast.error("Failed to delete mapping");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`sm:max-w-[600px] max-h-[80vh] p-0 gap-0 ${themeClasses.dialogBg} backdrop-blur-xl border-2 ${themeClasses.border} rounded-3xl overflow-hidden`}
        >
          <DialogHeader
            className={`px-6 pt-6 pb-4 border-b ${themeClasses.border}`}
          >
            <DialogTitle className="text-xl font-bold">
              <span
                className={`bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
              >
                Merchant Mappings
              </span>
            </DialogTitle>
            <DialogDescription className={themeClasses.textMuted}>
              These are learned mappings from your previous imports. When a
              transaction matches a pattern, it will auto-assign the category.
            </DialogDescription>
          </DialogHeader>

          {/* Search and Add */}
          <div className={`px-6 py-4 border-b ${themeClasses.border}`}>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <SearchIcon
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${themeClasses.textMuted}`}
                />
                <Input
                  placeholder="Search merchants..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={() => setShowAddDialog(true)}
                className={`neo-gradient ${themeClasses.textButton}`}
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Mappings List */}
          <ScrollArea className="flex-1 h-[400px]">
            {isLoading ? (
              <div className={`p-8 text-center ${themeClasses.textMuted}`}>
                Loading...
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className={`p-8 text-center ${themeClasses.textMuted}`}>
                {search
                  ? "No mappings found"
                  : "No merchant mappings yet. Import a statement to start learning!"}
              </div>
            ) : (
              <div className="divide-y divide-[hsl(var(--border)/0.5)]">
                {filteredMappings.map((mapping) => (
                  <MappingRow
                    key={mapping.id}
                    mapping={mapping}
                    onDelete={() => handleDelete(mapping)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className={`px-6 py-4 border-t ${themeClasses.border}`}>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Mapping Dialog */}
      <AddMappingDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </>
  );
}

// Single mapping row
function MappingRow({
  mapping,
  onDelete,
}: {
  mapping: MerchantMapping;
  onDelete: () => void;
}) {
  const themeClasses = useThemeClasses();
  const { data: accounts = [] } = useMyAccounts();
  const account = accounts.find((a: any) => a.id === mapping.account_id);
  const { data: categories = [] } = useCategories(
    mapping.account_id || undefined
  );

  const category = categories.find((c: any) => c.id === mapping.category_id);
  const subcategory = categories.find(
    (c: any) => c.id === mapping.subcategory_id
  );

  return (
    <div className="px-6 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${themeClasses.text}`}>
            {mapping.merchant_name}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${themeClasses.bgSurface} ${themeClasses.textMuted}`}
          >
            {mapping.use_count} uses
          </span>
        </div>
        <p className={`text-sm ${themeClasses.textMuted} truncate mt-1`}>
          Pattern: {mapping.merchant_pattern}
        </p>
        {(category || account) && (
          <div className="flex items-center gap-2 mt-1 text-sm">
            {category &&
              (() => {
                const CategoryIcon = getCategoryIcon(category.name);
                return (
                  <span
                    className={`flex items-center gap-1 ${themeClasses.textMuted}`}
                  >
                    <CategoryIcon className="w-4 h-4 text-cyan" />
                    {category.name}
                    {subcategory &&
                      (() => {
                        const SubIcon = getCategoryIcon(subcategory.name);
                        return (
                          <span className="flex items-center gap-1">
                            → <SubIcon className="w-3.5 h-3.5 text-cyan" />{" "}
                            {subcategory.name}
                          </span>
                        );
                      })()}
                  </span>
                );
              })()}
            {account && (
              <span className={`${themeClasses.textFaint}`}>
                • {account.name}
              </span>
            )}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
      >
        <TrashIcon className="w-4 h-4" />
      </Button>
    </div>
  );
}

// Add new mapping dialog
function AddMappingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const themeClasses = useThemeClasses();
  const [pattern, setPattern] = useState("");
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  const { data: accounts = [] } = useMyAccounts();
  const { data: categories = [] } = useCategories(accountId || undefined);
  const saveMutation = useSaveMerchantMapping();

  const expenseAccounts = useMemo(
    () => accounts.filter((a: any) => a.type === "expense"),
    [accounts]
  );

  const parentCategories = useMemo(
    () => categories.filter((c: any) => !c.parent_id && c.visible !== false),
    [categories]
  );

  const subcategories = useMemo(() => {
    if (!categoryId) return [];
    return categories.filter(
      (c: any) => c.parent_id === categoryId && c.visible !== false
    );
  }, [categories, categoryId]);

  const handleSave = async () => {
    if (!pattern || !name) {
      toast.error("Pattern and name are required");
      return;
    }

    try {
      await saveMutation.mutateAsync({
        merchant_pattern: pattern,
        merchant_name: name,
        account_id: accountId || null,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
      });
      toast.success("Mapping saved");
      onOpenChange(false);
      setPattern("");
      setName("");
      setAccountId("");
      setCategoryId("");
      setSubcategoryId("");
    } catch (error) {
      toast.error("Failed to save mapping");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[450px] ${themeClasses.dialogBg}`}>
        <DialogHeader>
          <DialogTitle>Add Merchant Mapping</DialogTitle>
          <DialogDescription>
            Create a new pattern to auto-categorize future transactions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className={`text-sm ${themeClasses.text} mb-1 block`}>
              Pattern *
            </label>
            <Input
              placeholder="e.g., TOTERS, SPINNEYS"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
            <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
              Text to match in transaction descriptions (case insensitive)
            </p>
          </div>

          <div>
            <label className={`text-sm ${themeClasses.text} mb-1 block`}>
              Display Name *
            </label>
            <Input
              placeholder="e.g., Toters, Spinneys"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className={`text-sm ${themeClasses.text} mb-1 block`}>
              Default Account
            </label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
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

          <div>
            <label className={`text-sm ${themeClasses.text} mb-1 block`}>
              Category
            </label>
            <Select
              value={categoryId}
              onValueChange={(val) => {
                setCategoryId(val);
                setSubcategoryId("");
              }}
              disabled={!accountId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    accountId ? "Select category" : "Select account first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {parentCategories.map((cat: any) => {
                  const Icon = getCategoryIcon(cat.name);
                  return (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-cyan" />
                        {cat.name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {subcategories.length > 0 && (
            <div>
              <label className={`text-sm ${themeClasses.text} mb-1 block`}>
                Subcategory
              </label>
              <Select value={subcategoryId} onValueChange={setSubcategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((sub: any) => {
                    const Icon = getCategoryIcon(sub.name);
                    return (
                      <SelectItem key={sub.id} value={sub.id}>
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-cyan" />
                          {sub.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !pattern || !name}
            className={`neo-gradient ${themeClasses.textButton}`}
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

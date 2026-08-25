"use client";

// A CategoryPicker on its own, for a single row that isn't part of a merchant
// group (a non-partner transfer, a "spent" cash withdrawal) — GroupSheet
// carries a rename input, date, account override and a "Rows" disclosure that
// don't apply here; this is just the grid.

import { CategoryPicker } from "@/components/statement-import/CategoryPicker";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  categoryId: string | null;
  subcategoryId: string | null;
  onChange: (next: {
    category_id: string | null;
    subcategory_id: string | null;
  }) => void;
};

export function CategoryPickerSheet({
  open,
  onOpenChange,
  accountId,
  categoryId,
  subcategoryId,
  onChange,
}: Props) {
  const tc = useThemeClasses();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn(tc.cardBg)}>
        <div
          className="mx-auto w-full max-w-md flex flex-col px-4 pt-3"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <DrawerTitle className={cn("text-base font-semibold mb-3", tc.headerText)}>
            Category
          </DrawerTitle>
          <CategoryPicker
            accountId={accountId}
            categoryId={categoryId}
            subcategoryId={subcategoryId}
            onChange={onChange}
            onDone={() => onOpenChange(false)}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

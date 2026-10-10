"use client";

import {
  Sheet,
  SheetClose,
  SheetContent as BaseSheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader as BaseSheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import * as React from "react";

/**
 * Mobile-safe drop-in replacement for `@/components/ui/sheet`.
 * The raw shadcn primitive gives bottom sheets no side padding, no height cap
 * and no safe-area inset, so every consumer had to remember all three and most
 * didn't — body content ended up flush against the screen edge or taller than
 * the viewport. Defaults live here once; a consumer's own className wins
 * (e.g. `p-0` for a sheet that lays out its own padding).
 *
 * Bottom sheets get: 16px side gutter, dynamic-viewport height cap with inner
 * scroll, no horizontal overflow, bottom safe-area inset.
 * Other sides pass through unchanged.
 */

function SheetContent({
  className,
  side = "right",
  ...props
}: React.ComponentProps<typeof BaseSheetContent>) {
  return (
    <BaseSheetContent
      side={side}
      className={cn(
        side === "bottom" &&
          "w-full max-w-full min-w-0 max-h-[92dvh] overflow-x-hidden overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    />
  );
}

/** Header sits inside the content gutter, so it carries no side padding of its own. */
function SheetHeader({ className, ...props }: React.ComponentProps<typeof BaseSheetHeader>) {
  return <BaseSheetHeader className={cn("px-0", className)} {...props} />;
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};

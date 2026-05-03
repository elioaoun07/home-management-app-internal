"use client";

// src/components/era/EraShell.tsx
// Top-level ERA layout. Single component tree, responsive via Tailwind.
//
// Mobile (default):  vertical column — header, canvas, command bar.
// Desktop (md+):     two columns — left rail with QuickFaceChips, right pane
//                    with header + canvas + command bar.
//
// Layout offsets:
//   - top: 4rem (h-16 fixed ConditionalHeader)
//   - bottom (mobile only): MOBILE_NAV_HEIGHT = 72px reserved for MobileNav.
//     Tailwind class pb-[72px] md:pb-0 mirrors src/constants/layout.ts.

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { CommandBar } from "./CommandBar";
import { FaceCanvas } from "./FaceCanvas";
import { FaceHeader } from "./FaceHeader";
import { QuickFaceChips } from "./QuickFaceChips";

export function EraShell() {
  const tc = useThemeClasses();

  return (
    <div
      className={[
        "fixed inset-x-0 top-16 bottom-0 flex w-full",
        tc.bgPage,
        tc.text,
      ].join(" ")}
    >
      {/* Desktop rail */}
      <aside
        className={[
          "hidden md:flex md:w-56 lg:w-64 shrink-0 flex-col gap-3 border-r p-3",
          tc.border,
        ].join(" ")}
        aria-label="ERA face navigation"
      >
        <span
          className={["text-xs uppercase tracking-wider", tc.textFaint].join(
            " ",
          )}
        >
          Faces
        </span>
        <QuickFaceChips orientation="column" />
      </aside>

      {/* Main column. Mobile reserves 72px for the fixed MobileNav. */}
      <div className="flex min-w-0 flex-1 flex-col pb-[72px] md:pb-0">
        <FaceHeader />
        <FaceCanvas />
        <CommandBar />
      </div>
    </div>
  );
}

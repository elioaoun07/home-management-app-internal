"use client";

import * as React from "react";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const themeClasses = useThemeClasses();

  return (
    <input
      type={type}
      data-slot="input"
      // Suppress hydration warnings caused by browser extensions (password managers, etc.)
      // that add attributes like fdprocessedid to form inputs
      suppressHydrationWarning
      className={cn(
        "file:text-foreground selection:text-white flex h-9 w-full min-w-0 rounded-md px-3 py-1 text-base transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        themeClasses.inputBg,
        themeClasses.placeholder,
        themeClasses.selection,
        themeClasses.inputBorder,
        themeClasses.inputFocus,
        themeClasses.inputFocusBg,
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };

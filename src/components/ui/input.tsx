import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-[#06b6d4]/50 selection:bg-[#06b6d4] selection:text-white dark:bg-[#0f1d2e] flex h-9 w-full min-w-0 rounded-md bg-[#0a1628]/50 px-3 py-1 text-base shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset] transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset,0_0_20px_rgba(6,182,212,0.3)] focus-visible:bg-[#0f1d2e]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };

import * as React from "react";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const themeClasses = useThemeClasses();
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        themeClasses.placeholder,
        themeClasses.textareaBorder,
        themeClasses.textareaRing,
        className
      )}
      {...props}
    />
  );
}

export { Textarea };

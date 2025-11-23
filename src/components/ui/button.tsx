import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:shadow-[0_0_0_3px_rgba(6,182,212,0.4)] aria-invalid:shadow-[0_0_0_3px_rgba(239,68,68,0.3)] active:scale-95 hover:shadow-md will-change-transform",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:-translate-y-0.5 transition-all",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 hover:shadow-lg focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 hover:-translate-y-0.5",
        outline:
          "bg-transparent shadow-[0_0_0_2px_rgba(6,182,212,0.4)_inset] hover:shadow-[0_0_0_2px_rgba(6,182,212,0.8)_inset,0_0_20px_rgba(6,182,212,0.3)] hover:bg-[#06b6d4]/10 text-[#06b6d4] hover:-translate-y-0.5 transition-all",
        secondary:
          "bg-[#1a2942] text-[#38bdf8] shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:bg-[#1e3a5f] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 transition-all",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 hover:shadow-sm hover:scale-105",
        link: "text-primary underline-offset-4 hover:underline hover:scale-105",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      suppressHydrationWarning
      {...props}
    />
  );
}

export { Button, buttonVariants };

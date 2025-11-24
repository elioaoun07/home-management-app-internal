import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:shadow-[0_0_0_3px_rgba(6,182,212,0.4)] aria-invalid:shadow-[0_0_0_3px_rgba(239,68,68,0.3)] active:scale-95 hover:shadow-md will-change-transform",
  {
    variants: {
      variant: {
        default: "hover:-translate-y-0.5 transition-all",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 hover:shadow-lg focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 hover:-translate-y-0.5",
        outline: "hover:-translate-y-0.5 transition-all",
        secondary: "hover:-translate-y-0.5 transition-all",
        ghost: "hover:scale-105",
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
  variant = "default",
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  const themeClasses = useThemeClasses();

  const dynamicClasses = React.useMemo(() => {
    switch (variant) {
      case "default":
        return cn(themeClasses.buttonPrimary, themeClasses.buttonFocus);
      case "secondary":
        return cn(themeClasses.buttonSecondary, themeClasses.buttonFocus);
      case "outline":
        return cn(themeClasses.buttonOutline, themeClasses.buttonFocus);
      case "ghost":
        return cn(themeClasses.buttonGhost, themeClasses.buttonFocus);
      default:
        return themeClasses.buttonFocus;
    }
  }, [variant, themeClasses]);

  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, className }),
        dynamicClasses
      )}
      suppressHydrationWarning
      {...props}
    />
  );
}

export { Button, buttonVariants };

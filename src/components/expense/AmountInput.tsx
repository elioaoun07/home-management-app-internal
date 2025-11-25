"use client";

import {
  CalculatorIcon,
  DollarSignIcon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ReactNode, useState } from "react";
import CalculatorDialog from "./CalculatorDialog";

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  rightExtra?: ReactNode; // Optional extra control (e.g., voice entry)
};

export default function AmountInput({ value, onChange, rightExtra }: Props) {
  const themeClasses = useThemeClasses();
  const [isCalcOpen, setCalcOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Label
        htmlFor="amount"
        className="text-base font-semibold flex items-center gap-2"
      >
        <DollarSignIcon className={`h-4 w-4 ${themeClasses.glow}`} />
        Amount
      </Label>
      <div className="relative flex items-center">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold z-10">
          $
        </span>
        <Input
          id="amount"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={`pl-8 pr-24 h-12 text-lg font-semibold transition-all focus:ring-0 focus-visible:ring-0 ${themeClasses.inputFocusForce}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-8 w-8 transition-all ${themeClasses.bgHover}`}
            aria-label="Open calculator"
            onClick={() => setCalcOpen(true)}
          >
            <CalculatorIcon
              className={`h-5 w-5 ${themeClasses.text} ${themeClasses.glow}`}
            />
          </Button>
          {rightExtra}
        </div>
      </div>

      <CalculatorDialog
        open={isCalcOpen}
        onOpenChange={setCalcOpen}
        onResult={(result) => {
          onChange?.(result);
          setCalcOpen(false);
        }}
        initialValue={value || "0"}
      />
    </div>
  );
}

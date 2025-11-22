"use client";

import {
  CalculatorIcon,
  DollarSignIcon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReactNode, useState } from "react";
import CalculatorDialog from "./CalculatorDialog";

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  rightExtra?: ReactNode; // Optional extra control (e.g., voice entry)
};

export default function AmountInput({ value, onChange, rightExtra }: Props) {
  const [isCalcOpen, setCalcOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Label
        htmlFor="amount"
        className="text-base font-semibold flex items-center gap-2"
      >
        <DollarSignIcon className="h-4 w-4 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]" />
        Amount
      </Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
            $
          </span>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="pl-8 h-12 text-lg font-semibold transition-all focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 hover:bg-primary/10 hover:text-primary transition-all"
          aria-label="Open calculator"
          onClick={() => setCalcOpen(true)}
        >
          <CalculatorIcon className="h-5 w-5 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
        </Button>
        {rightExtra}
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

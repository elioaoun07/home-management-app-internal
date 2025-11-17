"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult?: (result: string) => void;
  initialValue?: string;
};

type Operation = "+" | "-" | "*" | "/" | null;

export default function CalculatorDialog({
  open,
  onOpenChange,
  onResult,
  initialValue = "0",
}: Props) {
  const [display, setDisplay] = useState(initialValue);
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [justCalculated, setJustCalculated] = useState(false);
  // Persist tip state across dialog opens if value is unchanged
  // Track the last value for which a tip was added
  const [lastTipValue, setLastTipValue] = useState<string | null>(null);
  // Used to restore tip state if dialog is reopened with same value
  const initialValueRef = useRef(initialValue);

  // Reset calculator when dialog opens
  useEffect(() => {
    if (open) {
      setDisplay(initialValue);
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(false);
      setJustCalculated(false);
      initialValueRef.current = initialValue;
    }
  }, [open, initialValue]);

  const resetTip = useCallback(() => {
    setLastTipValue(null);
  }, []);

  const inputNumber = useCallback(
    (num: string) => {
      setJustCalculated(false);
      resetTip();
      if (waitingForNewValue) {
        setDisplay(num);
        setWaitingForNewValue(false);
      } else {
        setDisplay(display === "0" ? num : display + num);
      }
    },
    [display, waitingForNewValue, resetTip]
  );

  const inputDot = useCallback(() => {
    resetTip();
    if (waitingForNewValue) {
      setDisplay("0.");
      setWaitingForNewValue(false);
    } else if (display.indexOf(".") === -1) {
      setDisplay(display + ".");
    }
  }, [display, waitingForNewValue, resetTip]);

  const clear = useCallback(() => {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
    resetTip();
  }, [resetTip]);
  const addTip = useCallback(() => {
    if (display === lastTipValue) return;
    const value = parseFloat(display);
    if (!isNaN(value)) {
      const withTip = (value * 1.1).toFixed(2);
      setDisplay(withTip);
      setLastTipValue(withTip);
    }
  }, [display, lastTipValue]);

  const performOperation = useCallback(
    (nextOperation: Operation) => {
      const inputValue = parseFloat(display);

      if (previousValue === null) {
        setPreviousValue(display);
      } else if (operation) {
        const currentValue = previousValue || "0";
        const previousFloat = parseFloat(currentValue);
        let result: number;

        switch (operation) {
          case "+":
            result = previousFloat + inputValue;
            break;
          case "-":
            result = previousFloat - inputValue;
            break;
          case "*":
            result = previousFloat * inputValue;
            break;
          case "/":
            result =
              inputValue !== 0 ? previousFloat / inputValue : previousFloat;
            break;
          default:
            return;
        }

        const resultString = String(result);
        setDisplay(resultString);
        setPreviousValue(resultString);
      }

      setWaitingForNewValue(true);
      setOperation(nextOperation);
    },
    [display, previousValue, operation]
  );

  const calculate = useCallback(() => {
    if (operation && previousValue) {
      performOperation(null);
      setOperation(null);
      setPreviousValue(null);
      setWaitingForNewValue(true);
      setJustCalculated(true);
    }
  }, [performOperation, operation, previousValue]);

  const handleEqualsClick = useCallback(() => {
    if (justCalculated) {
      // If we just calculated, submit the result
      onResult?.(display);
      onOpenChange(false);
    } else {
      // If we haven't calculated yet, perform calculation
      calculate();
    }
  }, [justCalculated, display, onResult, onOpenChange, calculate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      e.preventDefault();

      if (e.key >= "0" && e.key <= "9") {
        inputNumber(e.key);
      } else if (e.key === ".") {
        inputDot();
      } else if (
        e.key === "+" ||
        e.key === "-" ||
        e.key === "*" ||
        e.key === "/"
      ) {
        performOperation(e.key as Operation);
      } else if (e.key === "Enter" || e.key === "=") {
        handleEqualsClick();
      } else if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "Backspace") {
        if (display.length > 1) {
          setDisplay(display.slice(0, -1));
        } else {
          setDisplay("0");
        }
      } else if (e.key.toLowerCase() === "c") {
        clear();
      }
    },
    [
      open,
      inputNumber,
      inputDot,
      performOperation,
      calculate,
      onOpenChange,
      display,
      clear,
    ]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#1a2942] border-[#3b82f6]/20">
        <DialogHeader>
          <DialogTitle className="text-[#06b6d4] text-xl">
            Calculator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Display */}
          <div className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 p-4 rounded-lg text-right">
            <div className="text-3xl font-mono font-bold text-white truncate">
              {(() => {
                const num = parseFloat(display);
                // Show no decimals for whole numbers, up to 2 for decimals
                return num % 1 === 0 ? num.toString() : num.toFixed(2);
              })()}
            </div>
            {operation && previousValue && (
              <div className="text-sm text-[#38bdf8]/70 mt-1">
                {previousValue} {operation}
              </div>
            )}
          </div>

          {/* Add Tip Button */}
          <div className="flex justify-end mb-2">
            <Button
              variant="secondary"
              onClick={addTip}
              disabled={display === lastTipValue}
              className="text-xs px-3 py-1 bg-[#14b8a6]/20 hover:bg-[#14b8a6]/30 border border-[#14b8a6]/30 text-[#14b8a6]"
            >
              Add Tip 10%
            </Button>
          </div>
          {/* Keypad */}
          <div className="grid grid-cols-4 gap-2">
            {/* Row 1 */}
            <Button
              variant="outline"
              onClick={clear}
              className="col-span-2 neo-card bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/20"
            >
              C
            </Button>
            <Button
              variant="outline"
              onClick={() => setDisplay(display.slice(0, -1) || "0")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-[#38bdf8] hover:bg-[#3b82f6]/10"
            >
              ⌫
            </Button>
            <Button
              variant="outline"
              onClick={() => performOperation("/")}
              className="neo-card bg-[#0f1d2e] border-[#06b6d4]/30 text-[#06b6d4] hover:bg-[#06b6d4]/10"
            >
              ÷
            </Button>

            {/* Row 2 */}
            <Button
              variant="outline"
              onClick={() => inputNumber("7")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              7
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("8")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              8
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("9")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              9
            </Button>
            <Button
              variant="outline"
              onClick={() => performOperation("*")}
              className="neo-card bg-[#0f1d2e] border-[#06b6d4]/30 text-[#06b6d4] hover:bg-[#06b6d4]/10"
            >
              ×
            </Button>

            {/* Row 3 */}
            <Button
              variant="outline"
              onClick={() => inputNumber("4")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              4
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("5")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              5
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("6")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              6
            </Button>
            <Button
              variant="outline"
              onClick={() => performOperation("-")}
              className="neo-card bg-[#0f1d2e] border-[#06b6d4]/30 text-[#06b6d4] hover:bg-[#06b6d4]/10"
            >
              −
            </Button>

            {/* Row 4 */}
            <Button
              variant="outline"
              onClick={() => inputNumber("1")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              1
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("2")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              2
            </Button>
            <Button
              variant="outline"
              onClick={() => inputNumber("3")}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              3
            </Button>
            <Button
              variant="outline"
              onClick={() => performOperation("+")}
              className="neo-card bg-[#0f1d2e] border-[#06b6d4]/30 text-[#06b6d4] hover:bg-[#06b6d4]/10"
            >
              +
            </Button>

            {/* Row 5 */}
            <Button
              variant="outline"
              onClick={() => inputNumber("0")}
              className="col-span-2 neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              0
            </Button>
            <Button
              variant="outline"
              onClick={inputDot}
              className="neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-white hover:bg-[#3b82f6]/10"
            >
              .
            </Button>
            <Button
              onClick={
                operation
                  ? handleEqualsClick
                  : () => {
                      if (onResult) onResult(display);
                      onOpenChange(false);
                    }
              }
              className={
                operation
                  ? "neo-gradient text-white hover:scale-105 transition-all"
                  : "bg-[#14b8a6] hover:bg-[#14b8a6]/90 text-white neo-glow-sm"
              }
            >
              {operation ? "=" : "✓"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

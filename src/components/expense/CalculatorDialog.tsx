"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
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
  const themeClasses = useThemeClasses();
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
      <DialogContent
        className={`sm:max-w-md border-2 ${themeClasses.calculatorBg} ${themeClasses.calculatorShadow}`}
      >
        <DialogHeader>
          <DialogTitle
            className={`text-transparent bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-xl font-bold`}
          >
            Calculator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Display */}
          <div
            className={`neo-card ${themeClasses.calculatorDisplayBg} border-2 ${themeClasses.border} p-5 rounded-xl text-right ${themeClasses.activeItemShadow} relative overflow-hidden`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${themeClasses.bgSurface} to-transparent pointer-events-none`}
            ></div>
            <div
              className={`text-4xl font-mono font-bold text-transparent bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text truncate relative z-10`}
            >
              {(() => {
                const num = parseFloat(display);
                // Show no decimals for whole numbers, up to 2 for decimals
                return num % 1 === 0 ? num.toString() : num.toFixed(2);
              })()}
            </div>
            {operation && previousValue && (
              <div
                className={`text-sm ${themeClasses.textMuted} mt-2 relative z-10`}
              >
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
              className={cn(
                "text-xs px-4 py-2 border font-medium transition-all",
                themeClasses.calculatorTipBtn
              )}
            >
              💡 Add 10% Tip
            </Button>
          </div>
          {/* Keypad */}
          <div className="grid grid-cols-4 gap-2">
            {/* Row 1 */}
            <Button
              onClick={clear}
              className={cn(
                "col-span-2 font-bold transition-all duration-300 border",
                themeClasses.calculatorClearBtn
              )}
            >
              C
            </Button>
            <Button
              onClick={() => setDisplay(display.slice(0, -1) || "0")}
              className={cn(
                "font-bold transition-all duration-300 border",
                themeClasses.calculatorBackspaceBtn
              )}
            >
              ⌫
            </Button>
            <Button
              onClick={() => performOperation("/")}
              className={cn(
                "font-bold text-lg transition-all duration-300 border",
                themeClasses.calculatorOperatorBtn
              )}
            >
              ÷
            </Button>

            {/* Row 2 */}
            <Button
              onClick={() => inputNumber("7")}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              7
            </Button>
            <Button
              onClick={() => inputNumber("8")}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              8
            </Button>
            <Button
              onClick={() => inputNumber("9")}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              9
            </Button>
            <Button
              onClick={() => performOperation("*")}
              className={cn(
                "font-bold text-lg transition-all duration-300 border",
                themeClasses.calculatorOperatorBtn
              )}
            >
              ×
            </Button>

            {/* Row 3 */}
            <Button
              onClick={() => inputNumber("4")}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              4
            </Button>
            <Button
              onClick={() => inputNumber("5")}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              5
            </Button>
            <Button
              onClick={() => inputNumber("6")}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              6
            </Button>
            <Button
              onClick={() => performOperation("-")}
              className={cn(
                "font-bold text-lg transition-all duration-300 border",
                themeClasses.calculatorOperatorBtn
              )}
            >
              −
            </Button>

            {/* Row 4 */}
            <Button
              onClick={() => inputNumber("1")}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              1
            </Button>
            <Button
              onClick={() => inputNumber("2")}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              2
            </Button>
            <Button
              onClick={() => inputNumber("3")}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              3
            </Button>
            <Button
              onClick={() => performOperation("+")}
              className={cn(
                "font-bold text-lg transition-all duration-300 border",
                themeClasses.calculatorOperatorBtn
              )}
            >
              +
            </Button>

            {/* Row 5 */}
            <Button
              onClick={() => inputNumber("0")}
              className={cn(
                "col-span-2 font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
            >
              0
            </Button>
            <Button
              onClick={inputDot}
              className={cn(
                "font-semibold text-lg transition-all duration-300 border",
                themeClasses.calculatorNumberBtn
              )}
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
              className={cn(
                "font-bold text-xl transition-all hover:scale-110",
                operation
                  ? themeClasses.calculatorEqualBtn
                  : `bg-gradient-to-r ${themeClasses.activeItemGradient} text-white ${themeClasses.activeItemShadow}`
              )}
            >
              {operation ? "=" : "✓"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

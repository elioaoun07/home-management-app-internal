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
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-[#0f1d2e] to-[#1a2942] border-2 border-[#3b82f6]/30 shadow-[0_0_40px_rgba(59,130,246,0.2)]">
        <DialogHeader>
          <DialogTitle className="text-transparent bg-gradient-to-r from-cyan-400 to-teal bg-clip-text text-xl font-bold">
            Calculator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Display */}
          <div className="neo-card bg-gradient-to-br from-[#0a1525] to-[#0f1d2e] border-2 border-cyan-500/30 p-5 rounded-xl text-right shadow-[0_0_20px_rgba(6,182,212,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none"></div>
            <div className="text-4xl font-mono font-bold text-transparent bg-gradient-to-r from-cyan-300 to-teal bg-clip-text truncate relative z-10">
              {(() => {
                const num = parseFloat(display);
                // Show no decimals for whole numbers, up to 2 for decimals
                return num % 1 === 0 ? num.toString() : num.toFixed(2);
              })()}
            </div>
            {operation && previousValue && (
              <div className="text-sm text-cyan-400/70 mt-2 relative z-10">
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
              className="text-xs px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-teal/20 hover:from-emerald-500/30 hover:to-teal/30 border border-emerald-400/40 text-emerald-300 font-medium shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
            >
              💡 Add 10% Tip
            </Button>
          </div>
          {/* Keypad */}
          <div className="grid grid-cols-4 gap-2">
            {/* Row 1 */}
            <Button
              onClick={clear}
              className="col-span-2"
              style={{
                background:
                  "linear-gradient(to bottom right, rgba(239, 68, 68, 0.2), rgba(225, 29, 72, 0.2))",
                border: "1px solid rgba(248, 113, 113, 0.5)",
                color: "#fecaca",
                fontWeight: "bold",
                boxShadow: "0 0 15px rgba(239, 68, 68, 0.2)",
                transition: "all 0.3s",
              }}
            >
              C
            </Button>
            <Button
              onClick={() => setDisplay(display.slice(0, -1) || "0")}
              style={{
                background:
                  "linear-gradient(to bottom right, rgba(249, 115, 22, 0.2), rgba(245, 158, 11, 0.2))",
                border: "1px solid rgba(251, 146, 60, 0.5)",
                color: "#fed7aa",
                fontWeight: "bold",
                boxShadow: "0 0 15px rgba(249, 115, 22, 0.2)",
                transition: "all 0.3s",
              }}
            >
              ⌫
            </Button>
            <Button
              onClick={() => performOperation("/")}
              style={{
                background:
                  "linear-gradient(to bottom right, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15))",
                border: "1px solid rgba(34, 211, 238, 0.4)",
                color: "#67e8f9",
                fontWeight: "bold",
                fontSize: "1.125rem",
                boxShadow: "0 0 15px rgba(6, 182, 212, 0.2)",
                transition: "all 0.3s",
              }}
            >
              ÷
            </Button>

            {/* Row 2 */}
            <Button
              onClick={() => inputNumber("7")}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              7
            </Button>
            <Button
              onClick={() => inputNumber("8")}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              8
            </Button>
            <Button
              onClick={() => inputNumber("9")}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              9
            </Button>
            <Button
              onClick={() => performOperation("*")}
              style={{
                background:
                  "linear-gradient(to bottom right, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15))",
                border: "1px solid rgba(34, 211, 238, 0.4)",
                color: "#67e8f9",
                fontWeight: "bold",
                fontSize: "1.125rem",
                boxShadow: "0 0 15px rgba(6, 182, 212, 0.2)",
                transition: "all 0.3s",
              }}
            >
              ×
            </Button>

            {/* Row 3 */}
            <Button
              onClick={() => inputNumber("4")}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              4
            </Button>
            <Button
              onClick={() => inputNumber("5")}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              5
            </Button>
            <Button
              onClick={() => inputNumber("6")}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              6
            </Button>
            <Button
              onClick={() => performOperation("-")}
              style={{
                background:
                  "linear-gradient(to bottom right, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15))",
                border: "1px solid rgba(34, 211, 238, 0.4)",
                color: "#67e8f9",
                fontWeight: "bold",
                fontSize: "1.125rem",
                boxShadow: "0 0 15px rgba(6, 182, 212, 0.2)",
                transition: "all 0.3s",
              }}
            >
              −
            </Button>

            {/* Row 4 */}
            <Button
              onClick={() => inputNumber("1")}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              1
            </Button>
            <Button
              onClick={() => inputNumber("2")}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              2
            </Button>
            <Button
              onClick={() => inputNumber("3")}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              3
            </Button>
            <Button
              onClick={() => performOperation("+")}
              style={{
                background:
                  "linear-gradient(to bottom right, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15))",
                border: "1px solid rgba(34, 211, 238, 0.4)",
                color: "#67e8f9",
                fontWeight: "bold",
                fontSize: "1.125rem",
                boxShadow: "0 0 15px rgba(6, 182, 212, 0.2)",
                transition: "all 0.3s",
              }}
            >
              +
            </Button>

            {/* Row 5 */}
            <Button
              onClick={() => inputNumber("0")}
              className="col-span-2"
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
            >
              0
            </Button>
            <Button
              onClick={inputDot}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(71, 85, 105, 0.3)",
                color: "#cbd5e1",
                fontWeight: "600",
                fontSize: "1.125rem",
                boxShadow: "0 0 10px rgba(100, 116, 139, 0.15)",
                transition: "all 0.3s",
              }}
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
                  ? "bg-gradient-to-r from-emerald-500 to-teal text-white hover:from-emerald-600 hover:to-teal/90 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] font-bold text-xl transition-all hover:scale-110"
                  : "bg-gradient-to-r from-teal to-cyan-500 text-white hover:from-teal/90 hover:to-cyan-600 shadow-[0_0_20px_rgba(20,184,166,0.4)] hover:shadow-[0_0_30px_rgba(20,184,166,0.6)] font-bold text-xl transition-all hover:scale-110"
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

// src/components/items/EditScopeDialog.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ItemEditScope } from "@/types/items";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { CalendarClock, Copy, FileEdit, RefreshCw } from "lucide-react";
import { useState } from "react";

interface EditScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: ItemEditScope) => void;
  itemTitle: string;
  isRecurring?: boolean;
}

export function EditScopeDialog({
  open,
  onOpenChange,
  onConfirm,
  itemTitle,
  isRecurring = false,
}: EditScopeDialogProps) {
  const themeClasses = useThemeClasses();
  const [selectedScope, setSelectedScope] =
    useState<ItemEditScope>("this_occurrence");

  const handleConfirm = () => {
    onConfirm(selectedScope);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${themeClasses.bgPage} ${themeClasses.border}`}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-cyan-400" />
            Edit Scope
          </DialogTitle>
          <DialogDescription className="text-white/60">
            <span className="font-medium text-white/80">
              &quot;{itemTitle}&quot;
            </span>{" "}
            is linked to a template. How would you like to apply your changes?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedScope}
          onValueChange={(v) => setSelectedScope(v as ItemEditScope)}
          className="space-y-3 py-4"
        >
          {/* This Occurrence Only */}
          <div
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedScope === "this_occurrence"
                ? "border-cyan-500/50 bg-cyan-500/10"
                : "border-white/10 hover:border-white/20"
            }`}
            onClick={() => setSelectedScope("this_occurrence")}
          >
            <RadioGroupItem
              value="this_occurrence"
              id="this_occurrence"
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="this_occurrence"
                className="text-white font-medium flex items-center gap-2 cursor-pointer"
              >
                <Copy className="h-4 w-4 text-cyan-400" />
                This occurrence only
              </Label>
              <p className="text-white/50 text-sm mt-1">
                Creates an exception for this specific date. The template and
                other occurrences remain unchanged.
              </p>
            </div>
          </div>

          {/* Future Only (if recurring) */}
          {isRecurring && (
            <div
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                selectedScope === "future_only"
                  ? "border-cyan-500/50 bg-cyan-500/10"
                  : "border-white/10 hover:border-white/20"
              }`}
              onClick={() => setSelectedScope("future_only")}
            >
              <RadioGroupItem
                value="future_only"
                id="future_only"
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="future_only"
                  className="text-white font-medium flex items-center gap-2 cursor-pointer"
                >
                  <CalendarClock className="h-4 w-4 text-amber-400" />
                  This and future occurrences
                </Label>
                <p className="text-white/50 text-sm mt-1">
                  Apply changes to this occurrence and all future ones. Past
                  occurrences stay as they were.
                </p>
              </div>
            </div>
          )}

          {/* Update Template */}
          <div
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedScope === "update_template"
                ? "border-pink-500/50 bg-pink-500/10"
                : "border-white/10 hover:border-white/20"
            }`}
            onClick={() => setSelectedScope("update_template")}
          >
            <RadioGroupItem
              value="update_template"
              id="update_template"
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="update_template"
                className="text-white font-medium flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 text-pink-400" />
                Update template (global)
              </Label>
              <p className="text-white/50 text-sm mt-1">
                Update the Catalogue template. You&apos;ll be asked whether to
                update past occurrences or future only.
              </p>
            </div>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white hover:opacity-90"
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

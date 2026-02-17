// src/components/web/DisableCatalogueItemDialog.tsx
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
import type { CatalogueDisableScope } from "@/types/items";
import { CalendarOff, Pause, Trash2 } from "lucide-react";
import { useState } from "react";

interface DisableCatalogueItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scope: CatalogueDisableScope) => void;
  itemName: string;
}

export function DisableCatalogueItemDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
}: DisableCatalogueItemDialogProps) {
  const [selectedScope, setSelectedScope] =
    useState<CatalogueDisableScope>("pause");

  const handleConfirm = () => {
    onConfirm(selectedScope);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900/95 border-white/10 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-amber-400" />
            Remove from Calendar
          </DialogTitle>
          <DialogDescription className="text-white/60">
            <span className="font-medium text-white/80">
              &quot;{itemName}&quot;
            </span>{" "}
            is currently active on your calendar. How would you like to disable
            it?
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedScope}
          onValueChange={(v) => setSelectedScope(v as CatalogueDisableScope)}
          className="space-y-3 py-4"
        >
          {/* Pause */}
          <div
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedScope === "pause"
                ? "border-cyan-500/50 bg-cyan-500/10"
                : "border-white/10 hover:border-white/20"
            }`}
            onClick={() => setSelectedScope("pause")}
          >
            <RadioGroupItem value="pause" id="pause" className="mt-0.5" />
            <div className="flex-1">
              <Label
                htmlFor="pause"
                className="text-white font-medium flex items-center gap-2 cursor-pointer"
              >
                <Pause className="h-4 w-4 text-cyan-400" />
                Pause recurrence
              </Label>
              <p className="text-white/50 text-sm mt-1">
                Stop future occurrences from appearing. Past history and
                completions are preserved. You can resume later.
              </p>
            </div>
          </div>

          {/* Delete Future */}
          <div
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedScope === "delete_future"
                ? "border-red-500/50 bg-red-500/10"
                : "border-white/10 hover:border-white/20"
            }`}
            onClick={() => setSelectedScope("delete_future")}
          >
            <RadioGroupItem
              value="delete_future"
              id="delete_future"
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="delete_future"
                className="text-white font-medium flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-red-400" />
                Delete future occurrences
              </Label>
              <p className="text-white/50 text-sm mt-1">
                Remove all future scheduled occurrences. Past completions and
                history are kept for your records.
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
            className={`text-white ${
              selectedScope === "delete_future"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-gradient-to-r from-cyan-500 to-pink-500 hover:opacity-90"
            }`}
          >
            {selectedScope === "pause" ? "Pause" : "Delete Future"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

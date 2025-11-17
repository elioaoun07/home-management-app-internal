"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

type Props = {
  value?: string;
  onChange?: (value: string) => void;
};

export default function DescriptionField({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor="description"
        className="text-base font-semibold flex items-center gap-2"
      >
        <FileText className="h-4 w-4" />
        Description (Optional)
      </Label>
      <Textarea
        id="description"
        placeholder="What was this for? Add any additional notes..."
        rows={3}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="resize-none transition-all focus:ring-2 focus:ring-primary/20"
      />
      <p className="text-xs text-muted-foreground">
        {value?.length || 0} / 500 characters
      </p>
    </div>
  );
}

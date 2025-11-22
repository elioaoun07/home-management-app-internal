"use client";

import { FileTextIcon } from "@/components/icons/FuturisticIcons";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
        <FileTextIcon className="h-4 w-4 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]" />
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

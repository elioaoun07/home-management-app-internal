"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateTripDocument, useUpdateTripDocument } from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { compressReceiptImage } from "@/lib/receiptUtils";
import { TRIP_DOCUMENT_TYPE_LABELS, type TripDocument, type TripDocumentType } from "@/types/trips";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

const DOC_TYPES: TripDocumentType[] = ["passport", "visa", "ticket", "booking", "insurance", "other"];

interface AddDocumentSheetProps {
  tripId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When editing metadata on an existing document (no re-upload). */
  document?: TripDocument;
}

export function AddDocumentSheet({ tripId, open, onOpenChange, document }: AddDocumentSheetProps) {
  const tc = useThemeClasses();
  const createDoc = useCreateTripDocument(tripId);
  const updateDoc = useUpdateTripDocument(tripId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(document?.title ?? "");
  const [docType, setDocType] = useState<TripDocumentType>(document?.doc_type ?? "other");
  const [expiresOn, setExpiresOn] = useState(document?.expires_on ?? "");
  const [notes, setNotes] = useState(document?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  const isPending = createDoc.isPending || updateDoc.isPending || processing;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (document) {
      await updateDoc.mutateAsync({
        id: document.id,
        title: title.trim(),
        doc_type: docType,
        expires_on: expiresOn || null,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
      return;
    }

    if (!file) return;
    setProcessing(true);
    try {
      const upload = file.type === "application/pdf" ? file : await compressReceiptImage(file, 400);
      await createDoc.mutateAsync({
        file: upload,
        title: title.trim(),
        doc_type: docType,
        expires_on: expiresOn || null,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  const inputClass = cn("bg-white/5 border text-white placeholder:text-white/30", tc.border);
  const canSubmit = title.trim() && (document || file);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("rounded-t-2xl border-t", tc.border, tc.bgPage, "max-h-[90vh] overflow-y-auto")}>
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white">{document ? "Edit document" : "Add document"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pb-8">
          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Title *</Label>
            <Input className={inputClass} placeholder="Passport, Visa, Flight ticket…" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Type</Label>
              <select
                className={cn(inputClass, "w-full rounded-md px-3 py-2 text-sm")}
                value={docType}
                onChange={(e) => setDocType(e.target.value as TripDocumentType)}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{TRIP_DOCUMENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>Expires on</Label>
              <Input className={inputClass} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            </div>
          </div>

          {!document && (
            <div className="space-y-1.5">
              <Label className={tc.textMuted}>File * (photo or PDF)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn("w-full flex items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm", tc.border, tc.textMuted)}
              >
                <Upload className="w-4 h-4" />
                {file ? file.name : "Take a photo or choose a file"}
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className={tc.textMuted}>Notes</Label>
            <textarea
              className={cn(inputClass, "w-full rounded-md px-3 py-2 text-sm resize-none h-16")}
              placeholder="Policy number, expiry reminders…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={!canSubmit || isPending} className={cn("w-full", tc.bgSurface, tc.text, "border", tc.border)}>
            {isPending ? "Saving…" : document ? "Save changes" : "Add document"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

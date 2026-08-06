"use client";

import {
  useDeleteTripDocument,
  useTrip,
  useTripDocumentUrls,
  useTripDocuments,
} from "@/features/trips/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { TRIP_DOCUMENT_TYPE_LABELS, type TripDocument } from "@/types/trips";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, ExternalLink, FileText, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { AddDocumentSheet } from "./AddDocumentSheet";

function ExpiryNote({ expiresOn, tripEndDate }: { expiresOn: string | null; tripEndDate: string | null }) {
  if (!expiresOn) return null;
  const expires = parseISO(expiresOn);
  const today = new Date();
  const daysUntilExpiry = differenceInCalendarDays(expires, today);

  if (tripEndDate) {
    const end = parseISO(tripEndDate);
    if (expires < end) {
      return (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle className="w-3 h-3" /> Expires before you're back home
        </span>
      );
    }
  }
  if (daysUntilExpiry < 0) {
    return <span className="text-xs text-red-400">Expired</span>;
  }
  if (daysUntilExpiry <= 90) {
    return <span className="text-xs text-amber-400">Expires in {daysUntilExpiry}d</span>;
  }
  return null;
}

function DocumentRow({ tripId, doc, tripEndDate }: { tripId: string; doc: TripDocument; tripEndDate: string | null }) {
  const tc = useThemeClasses();
  const deleteDoc = useDeleteTripDocument(tripId);
  const { getUrl } = useTripDocumentUrls(tripId, [doc.storage_path]);
  const [editOpen, setEditOpen] = useState(false);
  const url = getUrl(doc.storage_path);

  return (
    <>
      <div className={cn("rounded-xl border p-3.5 bg-white/5 flex items-start gap-3", tc.border)}>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", tc.bgSurface)}>
          <FileText className={cn("w-4 h-4", tc.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{doc.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-white/40">
            <span>{TRIP_DOCUMENT_TYPE_LABELS[doc.doc_type]}</span>
            <ExpiryNote expiresOn={doc.expires_on} tripEndDate={tripEndDate} />
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-white/30 hover:text-white/60">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button onClick={() => setEditOpen(true)} className="p-1.5 text-white/30 hover:text-white/60">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => deleteDoc.mutate(doc.id)} className="p-1.5 text-white/20 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <AddDocumentSheet tripId={tripId} open={editOpen} onOpenChange={setEditOpen} document={doc} />
    </>
  );
}

export function DocumentsView({ tripId }: { tripId: string }) {
  const tc = useThemeClasses();
  const { data: trip } = useTrip(tripId);
  const { data: documents = [], isLoading, isError, isFetching, refetch } = useTripDocuments(tripId);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={cn("text-sm font-medium", tc.textMuted)}>Documents</h3>
        <button onClick={() => setAddOpen(true)} className={cn("flex items-center gap-1 text-sm", tc.text)}>
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {isLoading ? (
        <p className={cn("text-sm text-center py-4", tc.textFaint)}>Loading…</p>
      ) : isError ? (
        <div className={cn("text-center py-8 rounded-xl border border-dashed", tc.border)}>
          <FileText className={cn("w-8 h-8 mx-auto mb-2", tc.textFaint)} />
          <p className={cn("text-sm", tc.textMuted)}>Couldn&apos;t load documents</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className={cn("mt-3 inline-flex items-center gap-1.5 text-sm disabled:opacity-50", tc.text)}
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            {isFetching ? "Retrying…" : "Try again"}
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className={cn("text-center py-8 rounded-xl border border-dashed", tc.border)}>
          <FileText className={cn("w-8 h-8 mx-auto mb-2", tc.textFaint)} />
          <p className={cn("text-sm", tc.textFaint)}>No documents yet</p>
          <p className="text-xs text-white/30 mt-1">Passport, visa, tickets, insurance…</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} tripId={tripId} doc={doc} tripEndDate={trip?.end_date ?? null} />
          ))}
        </div>
      )}

      <AddDocumentSheet tripId={tripId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

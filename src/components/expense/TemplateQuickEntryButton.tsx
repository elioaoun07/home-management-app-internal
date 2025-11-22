"use client";
import {
  PencilIcon,
  PlusCircleIcon,
  Trash2Icon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import TemplateDialog from "./TemplateDialog";

export type Template = {
  id: string;
  name: string;
  account_id: string;
  category_id: string;
  subcategory_id: string | null;
  amount: string;
  description: string | null;
};

export default function TemplateQuickEntryButton({
  onTemplateSelect,
  onCreateTemplate,
  onEditTemplate,
  selectedDate,
}: {
  onTemplateSelect: (template: Template) => void;
  onCreateTemplate: () => void;
  onEditTemplate: (template: Template) => void;
  selectedDate?: string; // YYYY-MM-DD
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | undefined>(undefined);
  const [quickEdit, setQuickEdit] = useState<Template | undefined>(undefined);
  const [quickEditAmount, setQuickEditAmount] = useState("");
  const [quickEditDescription, setQuickEditDescription] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  const refreshTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/transaction-templates");
      if (!res.ok) {
        let msg = "Failed to load templates";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        if (res.status === 401) {
          toast.error("Please sign in to view templates");
        } else {
          toast.error(msg);
        }
        setTemplates([]);
        return;
      }
      const data = await res.json();
      setTemplates(data || []);
    } catch (err) {
      console.error("Failed to load templates", err);
      toast.error("Failed to load templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (open) {
      refreshTemplates();
    }
  }, [open]);

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg p-0 w-14 h-14 flex items-center justify-center bg-primary text-white hover:bg-primary/90"
        onClick={() => setOpen(true)}
        aria-label="Quick Templates"
        style={{ borderRadius: "50%" }}
      >
        <PlusCircleIcon
          size={32}
          className="drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]"
        />
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-6 bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-4 w-80 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-lg">Templates</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(undefined);
                  setDialogOpen(true);
                }}
              >
                New
              </Button>
            </div>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates yet
              </div>
            ) : (
              <ul className="space-y-2">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-accent"
                  >
                    <button
                      className="flex-1 text-left font-medium truncate bg-transparent border-0 p-0 m-0 hover:underline cursor-pointer"
                      onClick={() => {
                        setQuickEdit(tpl);
                        setQuickEditAmount(tpl.amount || "");
                        setQuickEditDescription(tpl.description || "");
                      }}
                    >
                      {tpl.name}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(tpl);
                        setDialogOpen(true);
                      }}
                      aria-label="Edit"
                    >
                      <PencilIcon
                        size={16}
                        className="drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]"
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            "/api/transaction-templates",
                            {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: tpl.id }),
                            }
                          );
                          if (!res.ok) {
                            let msg = "Failed to delete template";
                            try {
                              const j = await res.json();
                              if (j?.error) msg = j.error;
                            } catch {}
                            toast.error(msg);
                            return;
                          }
                          toast.success("Template deleted");
                          refreshTemplates();
                        } catch (err) {
                          console.error("Delete template failed", err);
                          toast.error("Failed to delete template");
                        }
                      }}
                      aria-label="Delete"
                    >
                      <Trash2Icon
                        size={16}
                        className="drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]"
                      />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <TemplateDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(undefined);
        }}
        initial={editing}
        onSave={async (tpl) => {
          // Create or update a template with error handling. Throw on failure so the dialog stays open.
          const method = tpl.id ? "PATCH" : "POST";
          const res = await fetch("/api/transaction-templates", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tpl),
          });
          if (!res.ok) {
            let msg = tpl.id
              ? "Failed to update template"
              : "Failed to create template";
            try {
              const j = await res.json();
              if (j?.error) msg = j.error;
            } catch {}
            toast.error(msg);
            throw new Error(msg);
          }
          toast.success(tpl.id ? "Template updated" : "Template created");
          refreshTemplates();
        }}
        onDelete={
          editing && editing.id
            ? async () => {
                try {
                  const res = await fetch("/api/transaction-templates", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: editing.id }),
                  });
                  if (!res.ok) {
                    let msg = "Failed to delete template";
                    try {
                      const j = await res.json();
                      if (j?.error) msg = j.error;
                    } catch {}
                    toast.error(msg);
                    return;
                  }
                  toast.success("Template deleted");
                  setDialogOpen(false);
                  refreshTemplates();
                } catch (err) {
                  console.error("Delete template failed", err);
                  toast.error("Failed to delete template");
                }
              }
            : undefined
        }
      />

      {quickEdit && (
        <Dialog
          open={!!quickEdit}
          onOpenChange={(v) => {
            if (!v) setQuickEdit(undefined);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Quick Entry: {quickEdit.name}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!quickEdit) return;
                try {
                  setQuickSaving(true);
                  const res = await fetch("/api/transactions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      account_id: quickEdit.account_id,
                      category_id: quickEdit.category_id,
                      subcategory_id: quickEdit.subcategory_id,
                      amount: quickEditAmount,
                      description: quickEditDescription,
                      date: selectedDate,
                    }),
                  });
                  if (!res.ok) {
                    let msg = "Failed to add expense";
                    try {
                      const j = await res.json();
                      if (j?.error) msg = j.error;
                    } catch {}
                    toast.error(msg);
                    return;
                  }
                  toast.success("Expense added");
                  // Close both dialogs on success
                  setQuickEdit(undefined);
                  setOpen(false);
                } catch (err) {
                  console.error("Quick entry failed", err);
                  toast.error("Failed to add expense");
                } finally {
                  setQuickSaving(false);
                }
              }}
            >
              <div>
                <Label>Amount</Label>
                <Input
                  value={quickEditAmount}
                  onChange={(e) => setQuickEditAmount(e.target.value)}
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  disabled={quickSaving}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={quickEditDescription}
                  onChange={(e) => setQuickEditDescription(e.target.value)}
                  disabled={quickSaving}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuickEdit(undefined)}
                  disabled={quickSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={quickSaving}>
                  {quickSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

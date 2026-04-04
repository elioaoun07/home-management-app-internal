"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useAddChecklistItem,
  useCreateNfcTag,
  useDeleteChecklistItem,
  useDeleteNfcTag,
  useNfcChecklist,
  useNfcHistory,
  useNfcTags,
  useUpdateNfcTag,
} from "@/features/nfc/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import type { NfcDbChecklistItem, NfcTag } from "@/types/nfc";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Copy,
  Link2,
  ListChecks,
  Loader2,
  MapPin,
  Nfc,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type View = "list" | "detail" | "create";

interface FormState {
  tag_slug: string;
  label: string;
  location_name: string;
  states: string[];
}

const EMPTY_FORM: FormState = {
  tag_slug: "",
  label: "",
  location_name: "",
  states: ["leaving", "arriving"],
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function NfcAdminClient() {
  const tc = useThemeClasses();
  const { data: tags, isLoading } = useNfcTags();
  const [view, setView] = useState<View>("list");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<NfcTag | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [stateInput, setStateInput] = useState("");

  const selectedTag = useMemo(
    () => tags?.find((t) => t.tag_slug === selectedSlug) ?? null,
    [tags, selectedSlug],
  );

  const openDetail = useCallback((tag: NfcTag) => {
    setSelectedSlug(tag.tag_slug);
    setView("detail");
  }, []);

  const backToList = useCallback(() => {
    setView("list");
    setSelectedSlug(null);
  }, []);

  const openCreate = useCallback(() => {
    setForm(EMPTY_FORM);
    setStateInput("");
    setView("create");
  }, []);

  const openEdit = useCallback((tag: NfcTag) => {
    setEditingTag(tag);
    setForm({
      tag_slug: tag.tag_slug,
      label: tag.label,
      location_name: tag.location_name ?? "",
      states: [...tag.states],
    });
    setStateInput("");
    setShowEditDialog(true);
  }, []);

  return (
    <div className="min-h-[100dvh] pt-14 pb-24">
      {/* Header */}
      <div
        className={`sticky top-14 z-30 backdrop-blur-md border-b ${tc.border} px-4 py-3`}
      >
        <div className="flex items-center gap-3">
          {view !== "list" && (
            <button
              onClick={backToList}
              className={`p-1.5 rounded-lg ${tc.bgHover} transition-colors`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Nfc className={`w-5 h-5 ${tc.text} shrink-0`} />
            <h1 className="text-lg font-semibold truncate">
              {view === "detail" && selectedTag
                ? selectedTag.label
                : view === "create"
                  ? "New NFC Tag"
                  : "NFC Tags"}
            </h1>
            {view === "list" && tags && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {tags.length}
              </Badge>
            )}
          </div>
          {view === "list" && (
            <Button size="sm" className={tc.buttonPrimary} onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {view === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
          >
            <TagList
              tags={tags ?? []}
              isLoading={isLoading}
              tc={tc}
              onSelect={openDetail}
              onEdit={openEdit}
            />
          </motion.div>
        )}

        {view === "detail" && selectedTag && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.15 }}
          >
            <TagDetail
              tag={selectedTag}
              tc={tc}
              onEdit={() => openEdit(selectedTag)}
              onDeleteRequest={() => setShowDeleteConfirm(true)}
            />
          </motion.div>
        )}

        {view === "create" && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.15 }}
          >
            <CreateTagForm
              form={form}
              setForm={setForm}
              stateInput={stateInput}
              setStateInput={setStateInput}
              tc={tc}
              onBack={backToList}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Dialog */}
      {editingTag && (
        <EditTagDialog
          tag={editingTag}
          form={form}
          setForm={setForm}
          stateInput={stateInput}
          setStateInput={setStateInput}
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) setEditingTag(null);
          }}
          tc={tc}
        />
      )}

      {/* Delete Confirm Dialog */}
      {selectedTag && (
        <DeleteConfirmDialog
          tag={selectedTag}
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          tc={tc}
          onDeleted={backToList}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tag List
// ─────────────────────────────────────────────

function TagList({
  tags,
  isLoading,
  tc,
  onSelect,
  onEdit,
}: {
  tags: NfcTag[];
  isLoading: boolean;
  tc: ReturnType<typeof useThemeClasses>;
  onSelect: (tag: NfcTag) => void;
  onEdit: (tag: NfcTag) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={`w-6 h-6 animate-spin ${tc.text}`} />
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tc.iconBg} flex items-center justify-center mb-4`}
        >
          <Nfc className={`w-8 h-8 ${tc.text}`} />
        </div>
        <p className="text-white/80 font-medium mb-1">No NFC tags yet</p>
        <p className={`text-sm ${tc.textMuted}`}>
          Create your first tag to get started
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {tags.map((tag) => (
        <TagCard
          key={tag.id}
          tag={tag}
          tc={tc}
          onSelect={onSelect}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tag Card (list item)
// ─────────────────────────────────────────────

function TagCard({
  tag,
  tc,
  onSelect,
  onEdit,
}: {
  tag: NfcTag;
  tc: ReturnType<typeof useThemeClasses>;
  onSelect: (tag: NfcTag) => void;
  onEdit: (tag: NfcTag) => void;
}) {
  const updateTag = useUpdateNfcTag(tag.tag_slug);

  const toggleActive = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newActive = !tag.is_active;
      updateTag.mutate(
        { is_active: newActive },
        {
          onSuccess: () => {
            toast.success(newActive ? "Tag enabled" : "Tag disabled", {
              icon: ToastIcons.update,
              duration: 4000,
              action: {
                label: "Undo",
                onClick: () => updateTag.mutate({ is_active: !newActive }),
              },
            });
          },
        },
      );
    },
    [tag.is_active, updateTag],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(tag)}
      onDoubleClick={(e) => {
        e.preventDefault();
        onEdit(tag);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(tag);
        }
      }}
      className={`w-full text-left rounded-xl border ${tc.border} ${tc.bgHover} p-4 transition-all group cursor-pointer`}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tc.iconBg} flex items-center justify-center shrink-0`}
        >
          <Nfc className={`w-5 h-5 ${tc.text}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{tag.label}</span>
            {!tag.is_active && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 opacity-60"
              >
                Disabled
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {tag.location_name && (
              <span
                className={`text-xs ${tc.textMuted} flex items-center gap-1`}
              >
                <MapPin className="w-3 h-3" />
                {tag.location_name}
              </span>
            )}
            <span className={`text-xs ${tc.textFaint}`}>/{tag.tag_slug}</span>
          </div>
          {/* States */}
          <div className="flex items-center gap-1.5 mt-1.5">
            {tag.states.map((s) => (
              <span
                key={s}
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  tag.current_state === s
                    ? `${tc.bgActive} ${tc.text} font-medium`
                    : `bg-white/5 ${tc.textFaint}`
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Toggle + Chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <div onClick={toggleActive}>
            <Switch
              checked={tag.is_active}
              className={tc.switchChecked}
              aria-label={tag.is_active ? "Disable tag" : "Enable tag"}
            />
          </div>
          <ChevronRight
            className={`w-4 h-4 ${tc.textFaint} group-hover:translate-x-0.5 transition-transform`}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tag Detail
// ─────────────────────────────────────────────

function TagDetail({
  tag,
  tc,
  onEdit,
  onDeleteRequest,
}: {
  tag: NfcTag;
  tc: ReturnType<typeof useThemeClasses>;
  onEdit: () => void;
  onDeleteRequest: () => void;
}) {
  const { data: history, isLoading: historyLoading } = useNfcHistory(
    tag.tag_slug,
    20,
  );
  const updateTag = useUpdateNfcTag(tag.tag_slug);
  const { data: dbChecklist } = useNfcChecklist(tag.tag_slug);
  const addChecklistItem = useAddChecklistItem(tag.tag_slug);
  const deleteChecklistItem = useDeleteChecklistItem(tag.tag_slug);

  const tagUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/nfc/${tag.tag_slug}`
      : `/nfc/${tag.tag_slug}`;

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(tagUrl);
    toast.success("URL copied", { icon: ToastIcons.success });
  }, [tagUrl]);

  const totalChecklistItems = dbChecklist?.length ?? 0;

  return (
    <div className="p-4 space-y-6">
      {/* Info Card */}
      <div className={`rounded-xl border ${tc.border} p-4 space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Nfc className={`w-5 h-5 ${tc.text}`} />
            <span className="font-semibold text-lg">{tag.label}</span>
          </div>
          <Badge
            variant={tag.is_active ? "default" : "secondary"}
            className={
              tag.is_active
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "opacity-60"
            }
          >
            {tag.is_active ? "Active" : "Disabled"}
          </Badge>
        </div>

        {tag.location_name && (
          <div className={`flex items-center gap-2 text-sm ${tc.textMuted}`}>
            <MapPin className="w-4 h-4" />
            {tag.location_name}
          </div>
        )}

        {/* URL */}
        <div
          className={`flex items-center gap-2 text-sm ${tc.textFaint} rounded-lg bg-white/5 px-3 py-2`}
        >
          <Link2 className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1 font-mono text-xs">{tagUrl}</span>
          <button
            onClick={copyUrl}
            className={`p-1 rounded ${tc.bgHover} transition-colors`}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* States */}
        <div>
          <p
            className={`text-xs uppercase tracking-wide ${tc.textFaint} mb-1.5`}
          >
            States
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tag.states.map((s) => (
              <span
                key={s}
                className={`text-xs px-2 py-1 rounded-full ${
                  tag.current_state === s
                    ? `${tc.bgActive} ${tc.text} font-medium`
                    : `bg-white/5 ${tc.textFaint}`
                }`}
              >
                {s}
                {tag.current_state === s && " (current)"}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className={tc.buttonOutline}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={onDeleteRequest}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Checklists */}
      <div className={`rounded-xl border ${tc.border} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className={`w-4 h-4 ${tc.text}`} />
          <h3 className="font-medium">Checklists</h3>
          {totalChecklistItems > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {totalChecklistItems}
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          {tag.states.map((state) => (
            <ChecklistEditor
              key={state}
              state={state}
              items={(dbChecklist ?? []).filter((ci) => ci.state === state)}
              tc={tc}
              isSaving={
                addChecklistItem.isPending || deleteChecklistItem.isPending
              }
              onAdd={(title) => {
                const stateItems = (dbChecklist ?? []).filter(
                  (ci) => ci.state === state,
                );
                addChecklistItem.mutate(
                  {
                    state,
                    title,
                    order_index: stateItems.length,
                  },
                  {
                    onSuccess: () => {
                      toast.success(`Item added to "${state}" checklist`, {
                        icon: ToastIcons.success,
                      });
                    },
                    onError: (err) => {
                      toast.error(err.message || "Failed to add item", {
                        icon: ToastIcons.error,
                      });
                    },
                  },
                );
              }}
              onRemove={(itemId) => {
                deleteChecklistItem.mutate(itemId, {
                  onSuccess: () => {
                    toast.success("Item removed", {
                      icon: ToastIcons.delete,
                    });
                  },
                  onError: (err) => {
                    toast.error(err.message || "Failed to remove item", {
                      icon: ToastIcons.error,
                    });
                  },
                });
              }}
            />
          ))}
        </div>
      </div>

      {/* History */}
      <div className={`rounded-xl border ${tc.border} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <Clock className={`w-4 h-4 ${tc.text}`} />
          <h3 className="font-medium">Recent Activity</h3>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className={`w-5 h-5 animate-spin ${tc.textMuted}`} />
          </div>
        ) : !history || history.length === 0 ? (
          <p className={`text-sm ${tc.textFaint} py-4 text-center`}>
            No activity yet
          </p>
        ) : (
          <div className="space-y-1">
            {history.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-white/5"
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${tc.text} opacity-60`}
                  style={{ backgroundColor: "currentColor" }}
                />
                <span className={`${tc.textMuted} flex-1`}>
                  {log.previous_state ? (
                    <>
                      {log.previous_state} → <strong>{log.new_state}</strong>
                    </>
                  ) : (
                    <>
                      → <strong>{log.new_state}</strong>
                    </>
                  )}
                </span>
                <span className={`text-xs ${tc.textFaint} shrink-0`}>
                  {formatRelativeTime(log.changed_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Create Tag Form
// ─────────────────────────────────────────────

function CreateTagForm({
  form,
  setForm,
  stateInput,
  setStateInput,
  tc,
  onBack,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  stateInput: string;
  setStateInput: React.Dispatch<React.SetStateAction<string>>;
  tc: ReturnType<typeof useThemeClasses>;
  onBack: () => void;
}) {
  const createTag = useCreateNfcTag();

  const addState = useCallback(() => {
    const val = stateInput.trim().toLowerCase();
    if (val && !form.states.includes(val)) {
      setForm((f) => ({ ...f, states: [...f.states, val] }));
      setStateInput("");
    }
  }, [stateInput, form.states, setForm, setStateInput]);

  const removeState = useCallback(
    (state: string) => {
      setForm((f) => ({
        ...f,
        states: f.states.filter((s) => s !== state),
      }));
    },
    [setForm],
  );

  const handleSubmit = useCallback(() => {
    if (!form.tag_slug.trim() || !form.label.trim() || form.states.length < 2) {
      toast.error("Fill all required fields (slug, label, at least 2 states)");
      return;
    }
    createTag.mutate(
      {
        tag_slug: form.tag_slug.trim().toLowerCase(),
        label: form.label.trim(),
        location_name: form.location_name.trim() || undefined,
        states: form.states,
      },
      {
        onSuccess: () => {
          toast.success("NFC tag created", { icon: ToastIcons.create });
          onBack();
        },
        onError: (err) => {
          toast.error(err.message || "Failed to create tag", {
            icon: ToastIcons.error,
          });
        },
      },
    );
  }, [form, createTag, onBack]);

  return (
    <div className="p-4 space-y-6">
      <TagFormFields
        form={form}
        setForm={setForm}
        stateInput={stateInput}
        setStateInput={setStateInput}
        addState={addState}
        removeState={removeState}
        tc={tc}
        slugEditable
      />
      <Button
        className={`w-full ${tc.buttonPrimary}`}
        disabled={
          createTag.isPending ||
          !form.tag_slug.trim() ||
          !form.label.trim() ||
          form.states.length < 2
        }
        onClick={handleSubmit}
      >
        {createTag.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        Create Tag
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Edit Tag Dialog
// ─────────────────────────────────────────────

function EditTagDialog({
  tag,
  form,
  setForm,
  stateInput,
  setStateInput,
  open,
  onOpenChange,
  tc,
}: {
  tag: NfcTag;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  stateInput: string;
  setStateInput: React.Dispatch<React.SetStateAction<string>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tc: ReturnType<typeof useThemeClasses>;
}) {
  const updateTag = useUpdateNfcTag(tag.tag_slug);

  const addState = useCallback(() => {
    const val = stateInput.trim().toLowerCase();
    if (val && !form.states.includes(val)) {
      setForm((f) => ({ ...f, states: [...f.states, val] }));
      setStateInput("");
    }
  }, [stateInput, form.states, setForm, setStateInput]);

  const removeState = useCallback(
    (state: string) => {
      setForm((f) => ({
        ...f,
        states: f.states.filter((s) => s !== state),
      }));
    },
    [setForm],
  );

  const handleSave = useCallback(() => {
    if (!form.label.trim() || form.states.length < 2) {
      toast.error("Label and at least 2 states required");
      return;
    }
    updateTag.mutate(
      {
        label: form.label.trim(),
        location_name: form.location_name.trim() || null,
        states: form.states,
      },
      {
        onSuccess: () => {
          toast.success("Tag updated", { icon: ToastIcons.update });
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to update", {
            icon: ToastIcons.error,
          });
        },
      },
    );
  }, [form, updateTag, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${tc.dialogBg} ${tc.dialogShadow} ${tc.bgPage}`}
      >
        <DialogHeader>
          <DialogTitle className={tc.dialogTitle}>Edit Tag</DialogTitle>
          <DialogDescription className={tc.dialogDescription}>
            Update &quot;{tag.label}&quot; configuration
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <TagFormFields
            form={form}
            setForm={setForm}
            stateInput={stateInput}
            setStateInput={setStateInput}
            addState={addState}
            removeState={removeState}
            tc={tc}
            slugEditable={false}
          />
          <Button
            className={`w-full ${tc.buttonPrimary}`}
            disabled={
              updateTag.isPending ||
              !form.label.trim() ||
              form.states.length < 2
            }
            onClick={handleSave}
          >
            {updateTag.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Delete Confirm Dialog
// ─────────────────────────────────────────────

function DeleteConfirmDialog({
  tag,
  open,
  onOpenChange,
  tc,
  onDeleted,
}: {
  tag: NfcTag;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tc: ReturnType<typeof useThemeClasses>;
  onDeleted: () => void;
}) {
  const deleteTag = useDeleteNfcTag();

  const handleDelete = useCallback(() => {
    deleteTag.mutate(tag.tag_slug, {
      onSuccess: () => {
        toast.success(`"${tag.label}" deleted`, {
          icon: ToastIcons.delete,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => {
              toast.info(
                "NFC tag deletion cannot be undone after confirmation",
              );
            },
          },
        });
        onOpenChange(false);
        onDeleted();
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete", {
          icon: ToastIcons.error,
        });
      },
    });
  }, [tag, deleteTag, onOpenChange, onDeleted]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${tc.dialogBg} ${tc.dialogShadow} ${tc.bgPage}`}
      >
        <DialogHeader>
          <DialogTitle className={tc.dialogTitle}>Delete Tag</DialogTitle>
          <DialogDescription className={tc.dialogDescription}>
            This will permanently delete &quot;{tag.label}&quot; and all its
            history. Connected item prerequisites will no longer trigger.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end mt-4">
          <Button
            variant="ghost"
            className={tc.buttonGhost}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteTag.isPending}
            onClick={handleDelete}
          >
            {deleteTag.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Shared Form Fields
// ─────────────────────────────────────────────

function TagFormFields({
  form,
  setForm,
  stateInput,
  setStateInput,
  addState,
  removeState,
  tc,
  slugEditable,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  stateInput: string;
  setStateInput: React.Dispatch<React.SetStateAction<string>>;
  addState: () => void;
  removeState: (s: string) => void;
  tc: ReturnType<typeof useThemeClasses>;
  slugEditable: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Slug */}
      <div className="space-y-1.5">
        <Label className={tc.textMuted}>URL Slug</Label>
        <Input
          value={form.tag_slug}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              tag_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
            }))
          }
          placeholder="main-door"
          disabled={!slugEditable}
          className={`${tc.inputBg} ${tc.inputBorder} ${tc.inputFocus} ${tc.placeholder}`}
        />
        <p className={`text-xs ${tc.textFaint}`}>
          /nfc/{form.tag_slug || "your-slug"}
        </p>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label className={tc.textMuted}>Label</Label>
        <Input
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="Main Door"
          className={`${tc.inputBg} ${tc.inputBorder} ${tc.inputFocus} ${tc.placeholder}`}
        />
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <Label className={tc.textMuted}>Location (optional)</Label>
        <Input
          value={form.location_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, location_name: e.target.value }))
          }
          placeholder="Front entrance"
          className={`${tc.inputBg} ${tc.inputBorder} ${tc.inputFocus} ${tc.placeholder}`}
        />
      </div>

      {/* States */}
      <div className="space-y-1.5">
        <Label className={tc.textMuted}>States (min. 2)</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.states.map((s) => (
            <span
              key={s}
              className={`text-xs px-2 py-1 rounded-full ${tc.bgActive} ${tc.text} flex items-center gap-1`}
            >
              {s}
              <button
                type="button"
                onClick={() => removeState(s)}
                className="hover:opacity-70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={stateInput}
            onChange={(e) => setStateInput(e.target.value)}
            placeholder="Add a state..."
            className={`flex-1 ${tc.inputBg} ${tc.inputBorder} ${tc.inputFocus} ${tc.placeholder}`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addState();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={tc.buttonOutline}
            onClick={addState}
            disabled={!stateInput.trim()}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Checklist Editor (per state)
// ─────────────────────────────────────────────

function ChecklistEditor({
  state,
  items,
  tc,
  isSaving,
  onAdd,
  onRemove,
}: {
  state: string;
  items: NfcDbChecklistItem[];
  tc: ReturnType<typeof useThemeClasses>;
  isSaving: boolean;
  onAdd: (title: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const [newItemTitle, setNewItemTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addItem = useCallback(() => {
    const title = newItemTitle.trim();
    if (!title) return;
    onAdd(title);
    setNewItemTitle("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [newItemTitle, onAdd]);

  return (
    <div>
      <p className={`text-xs uppercase tracking-wide ${tc.textFaint} mb-1.5`}>
        On &quot;{state}&quot;
      </p>

      {items.length > 0 && (
        <div className="space-y-1 mb-2">
          {items
            .sort((a, b) => a.order_index - b.order_index)
            .map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-white/5 group"
              >
                <span className={`text-xs ${tc.textFaint} w-5 text-center`}>
                  {idx + 1}
                </span>
                <span className="flex-1 truncate">{item.title}</span>
                {item.source_tag_id && (
                  <Link2 className="w-3 h-3 text-cyan-400/50 shrink-0" />
                )}
                <button
                  onClick={() => onRemove(item.id)}
                  disabled={isSaving}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          placeholder={`Add checklist item for "${state}"...`}
          className={`flex-1 text-sm ${tc.inputBg} ${tc.inputBorder} ${tc.inputFocus} ${tc.placeholder}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          disabled={isSaving}
        />
        <Button
          size="sm"
          variant="outline"
          className={tc.buttonOutline}
          onClick={addItem}
          disabled={!newItemTitle.trim() || isSaving}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

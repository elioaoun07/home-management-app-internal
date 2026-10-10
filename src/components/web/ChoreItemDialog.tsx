"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateItem,
  useCreateRoom,
  useHomeRooms,
  useUpdateItem,
} from "@/features/catalogue/hooks";
import { useTheme } from "@/contexts/ThemeContext";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type {
  CatalogueItem,
  ChoreCategory,
  FlexiblePeriod,
  RoomConfig,
} from "@/types/catalogue";
import { CHORE_CATEGORIES, FLEXIBLE_PERIOD_LABELS } from "@/types/catalogue";
import { ChevronDown, Loader2, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Tasks module: chore templates are task templates flagged `is_chore` */
  moduleId: string;
  categoryId?: string;
  editingItem: CatalogueItem | null;
  onSuccess?: (item: CatalogueItem) => void;
}

const PERIODS: FlexiblePeriod[] = ["weekly", "biweekly", "monthly"];

const chip = (on: boolean) =>
  cn(
    "px-3 py-1.5 rounded-full text-sm border transition-all",
    on
      ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
  );

const personChip = (on: boolean, color: string) =>
  cn(
    "px-3 py-1.5 rounded-full text-sm border transition-all",
    on
      ? color === "pink"
        ? "bg-pink-500/20 border-pink-500/60 text-pink-300"
        : "bg-blue-500/20 border-blue-500/60 text-blue-300"
      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
  );

/** Digits only, or undefined when empty / zero. */
const toMinutes = (text: string): number | undefined => {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : undefined;
};

/**
 * Dedicated chore form. A chore is a flexible routine ("N× per week/month")
 * tagged with the rooms it applies to; each room may carry its own steps and
 * minutes. Saved as a Tasks-module template with `is_chore`, which is what the
 * Chores page reads.
 */
export default function ChoreItemDialog({
  open,
  onOpenChange,
  moduleId,
  categoryId,
  editingItem,
  onSuccess,
}: Props) {
  const themeClasses = useThemeClasses();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const createRoom = useCreateRoom();
  const { data: rooms = [] } = useHomeRooms();
  const { theme } = useTheme();
  const { data: household } = useHouseholdMembers();

  const [name, setName] = useState("");
  const [choreCategory, setChoreCategory] = useState<ChoreCategory | "">("");
  const [period, setPeriod] = useState<FlexiblePeriod>("weekly");
  const [times, setTimes] = useState("1");
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [roomInput, setRoomInput] = useState("");
  // Per-room text state: checklist and minutes, keyed by room id
  const [roomChecklists, setRoomChecklists] = useState<Record<string, string>>({});
  const [roomMinutes, setRoomMinutes] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [subtasksText, setSubtasksText] = useState("");
  const [description, setDescription] = useState("");
  // Same steps/minutes for every room, or one set per room
  const [perRoom, setPerRoom] = useState(false);
  // Default owner (user id); null = anyone
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  // Optional fields stay folded unless the chore already uses them
  const [more, setMore] = useState(false);

  const isEditing = !!editingItem;
  const isLoading =
    createItem.isPending || updateItem.isPending || createRoom.isPending;

  useEffect(() => {
    if (!open) return;
    const item = editingItem;
    setName(item?.name ?? "");
    setChoreCategory(item?.chore_category ?? "");
    setPeriod(
      item?.recurrence_pattern === "biweekly" ||
        item?.recurrence_pattern === "monthly"
        ? item.recurrence_pattern
        : "weekly",
    );
    setTimes(String(item?.flexible_occurrences ?? 1));
    setRoomIds(item?.room_ids ?? []);
    const config = item?.room_config ?? {};
    setRoomChecklists(
      Object.fromEntries(
        Object.entries(config).map(([id, c]) => [id, c.checklist ?? ""]),
      ),
    );
    setRoomMinutes(
      Object.fromEntries(
        Object.entries(config).map(([id, c]) => [id, c.minutes ? String(c.minutes) : ""]),
      ),
    );
    setRoomInput("");
    setMinutes(item?.preferred_duration_minutes?.toString() ?? "");
    setPreferredTime(item?.preferred_time?.slice(0, 5) ?? "");
    setSubtasksText(item?.subtasks_text ?? "");
    setDescription(item?.description ?? "");
    setPerRoom(Object.keys(config).length > 0);
    setAssigneeId(item?.default_assignee_id ?? null);
    setMore(
      !!item &&
        !!(
          item.chore_category ||
          item.preferred_duration_minutes ||
          item.preferred_time ||
          item.subtasks_text ||
          item.description ||
          Object.keys(config).length > 0
        ),
    );
  }, [open, editingItem]);

  const toggleRoom = (id: string) =>
    setRoomIds((ids) =>
      ids.includes(id) ? ids.filter((r) => r !== id) : [...ids, id],
    );

  const allRoomsOn =
    rooms.length > 0 && rooms.every((r) => roomIds.includes(r.id));
  const toggleAllRooms = () =>
    setRoomIds(allRoomsOn ? [] : rooms.map((r) => r.id));

  const addNewRoom = async () => {
    const roomName = roomInput.trim();
    if (!roomName) return;
    const existing = rooms.find(
      (r) => r.name.toLowerCase() === roomName.toLowerCase(),
    );
    try {
      const room = existing ?? (await createRoom.mutateAsync(roomName));
      setRoomInput("");
      if (room)
        setRoomIds((ids) => (ids.includes(room.id) ? ids : [...ids, room.id]));
    } catch {
      // the mutation already toasted
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Ticked rooms only; sent when changed so saves work before the column exists
    const nextConfig: RoomConfig = {};
    for (const id of perRoom ? roomIds : []) {
      const checklist = roomChecklists[id]?.trim();
      const mins = toMinutes(roomMinutes[id] ?? "");
      if (checklist || mins) {
        nextConfig[id] = {
          ...(checklist ? { checklist } : {}),
          ...(mins ? { minutes: mins } : {}),
        };
      }
    }
    const configChanged =
      JSON.stringify(nextConfig) !== JSON.stringify(editingItem?.room_config ?? {});
    const roomsChanged =
      roomIds.join() !== (editingItem?.room_ids ?? []).join();

    const note = description.trim();
    const steps = subtasksText.trim();
    const mins = toMinutes(minutes);
    const assigneeChanged = assigneeId !== (editingItem?.default_assignee_id ?? null);
    const common = {
      name: name.trim(),
      is_chore: true,
      is_flexible_routine: true,
      recurrence_pattern: period,
      flexible_occurrences: Math.min(31, Math.max(1, parseInt(times, 10) || 1)),
      default_assignee_id: assigneeChanged ? assigneeId : undefined,
      room_ids: roomsChanged ? roomIds : undefined,
      room_config: configChanged ? nextConfig : undefined,
    };

    try {
      const result = isEditing && editingItem
        ? await updateItem.mutateAsync({
            id: editingItem.id,
            ...common,
            // Emptied fields clear on edit
            description: note || null,
            chore_category: choreCategory || null,
            preferred_time: preferredTime || null,
            preferred_duration_minutes: mins ?? null,
            subtasks_text: steps || null,
            expected_revision: editingItem.revision,
          })
        : await createItem.mutateAsync({
            ...common,
            is_public: true,
            description: note || undefined,
            chore_category: choreCategory || undefined,
            preferred_time: preferredTime || undefined,
            preferred_duration_minutes: mins,
            subtasks_text: steps || undefined,
            module_id: moduleId,
            category_id: categoryId,
            item_type: "task",
            location_context: "home",
          });
      onOpenChange(false);
      onSuccess?.(result);
    } catch {
      // the mutation already toasted
    }
  };

  // Colours follow the person, not the viewer (theme pink = me pink)
  const myColor = theme === "pink" ? "pink" : "blue";
  const owners = (household?.members ?? []).map((m) => ({
    id: m.id,
    label: m.isCurrentUser ? "Me" : (m.displayName ?? "").split(/[s@]/)[0] || "?",
    color: m.isCurrentUser ? myColor : myColor === "pink" ? "blue" : "pink",
  }));

  const selectedRooms = rooms.filter((r) => roomIds.includes(r.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-2xl max-h-[90vh] overflow-y-auto",
          themeClasses.surfaceBg,
          themeClasses.border,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            {isEditing ? "Edit Chore" : "New Chore"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Name"
            autoFocus
            className={cn(themeClasses.inputBg, "border-white/10 text-white")}
          />

          {/* Frequency */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              aria-label="Times per period"
              value={times}
              onChange={(e) => setTimes(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => {
                const n = parseInt(times, 10);
                setTimes(String(Number.isFinite(n) && n >= 1 ? Math.min(n, 31) : 1));
              }}
              className="w-16 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-400/50"
            />
            <span className="text-white/50 text-sm">×</span>
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={chip(period === p)}
              >
                {FLEXIBLE_PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Rooms */}
          <div className="space-y-2">
            <Label className="text-white/60 text-xs">Rooms</Label>
            <div className="flex flex-wrap gap-1.5">
              {rooms.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAllRooms}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-all",
                    allRoomsOn
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10",
                  )}
                >
                  All
                </button>
              )}
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggleRoom(room.id)}
                  className={chip(roomIds.includes(room.id))}
                >
                  {room.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addNewRoom();
                  }
                }}
                placeholder="New room"
                className="bg-white/5 border-white/10 text-white text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void addNewRoom()}
                aria-label="Add room"
                className="border-white/10 bg-white/5"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Default owner: Chores pre-assigns it, only the day is left to pick */}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setAssigneeId(null)} className={chip(assigneeId === null)}>
              Anyone
            </button>
            {owners.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setAssigneeId(o.id)}
                className={personChip(assigneeId === o.id, o.color)}
              >
                {o.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white/80"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", more && "rotate-180")} />
            More
          </button>
          {more && (
            <div className="space-y-5">
          {/* Kind */}
          <div className="flex flex-wrap gap-1.5">
            {CHORE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setChoreCategory(choreCategory === cat ? "" : cat)}
                className={cn(chip(choreCategory === cat), "capitalize")}
              >
                {cat}
              </button>
            ))}
          </div>

          {selectedRooms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setPerRoom(false)} className={chip(!perRoom)}>
                Same for all
              </button>
              <button type="button" onClick={() => setPerRoom(true)} className={chip(perRoom)}>
                Per room
              </button>
            </div>
          )}

          {/* Per room: minutes + steps */}
          {perRoom && selectedRooms.length > 0 && (
            <div className="space-y-2">
              {selectedRooms.map((room) => (
                <div
                  key={room.id}
                  className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-emerald-300">{room.name}</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`${room.name} minutes`}
                        value={roomMinutes[room.id] ?? ""}
                        placeholder={minutes || "—"}
                        onChange={(e) =>
                          setRoomMinutes((m) => ({
                            ...m,
                            [room.id]: e.target.value.replace(/[^0-9]/g, ""),
                          }))
                        }
                        className="w-16 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white text-sm text-right placeholder:text-white/30 focus:outline-none focus:border-emerald-400/50"
                      />
                      <span className="text-xs text-white/50">min</span>
                    </div>
                  </div>
                  <Textarea
                    value={roomChecklists[room.id] ?? ""}
                    onChange={(e) =>
                      setRoomChecklists((c) => ({ ...c, [room.id]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Steps"
                    aria-label={`${room.name} steps`}
                    className="bg-white/5 border-white/10 text-white text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Defaults for rooms without their own */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="chore-minutes" className="text-white/60 text-xs">
                Minutes
              </Label>
              <Input
                id="chore-minutes"
                type="text"
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))}
                className={cn(themeClasses.inputBg, "border-white/10 text-white")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chore-time" className="text-white/60 text-xs">
                Time
              </Label>
              <Input
                id="chore-time"
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className={cn(themeClasses.inputBg, "border-white/10 text-white")}
              />
            </div>
          </div>

          <Textarea
            value={subtasksText}
            onChange={(e) => setSubtasksText(e.target.value)}
            rows={3}
            placeholder="Steps"
            aria-label="Steps"
            className="bg-white/5 border-white/10 text-white text-sm"
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Notes"
            aria-label="Notes"
            className="bg-white/5 border-white/10 text-white text-sm"
          />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="text-white/70 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEditing ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

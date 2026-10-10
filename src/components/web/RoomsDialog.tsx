"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useCreateRoom,
  useDeleteRoom,
  useHomeRooms,
  useRenameRoom,
} from "@/features/catalogue/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { HomeRoom } from "@/types/catalogue";
import { Home, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RoomRow({ room }: { room: HomeRoom }) {
  const rename = useRenameRoom();
  const remove = useDeleteRoom();
  const [name, setName] = useState(room.name);

  const commit = () => {
    const next = name.trim();
    if (!next) setName(room.name);
    else if (next !== room.name) {
      rename.mutate({ room, name: next }, { onError: () => setName(room.name) });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="bg-white/5 border-white/10 text-white text-sm"
      />
      <button
        type="button"
        onClick={() => remove.mutate(room)}
        aria-label={`Delete ${room.name}`}
        className="p-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Rename / delete / add the rooms chores are tagged with. */
export default function RoomsDialog({ open, onOpenChange }: Props) {
  const themeClasses = useThemeClasses();
  const { data: rooms = [] } = useHomeRooms();
  const createRoom = useCreateRoom();
  const [name, setName] = useState("");

  const add = () => {
    const next = name.trim();
    if (!next) return;
    createRoom.mutate(next, { onSuccess: () => setName("") });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-md max-h-[90vh] overflow-y-auto", themeClasses.surfaceBg, themeClasses.border)}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-400" />
            Rooms
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {rooms.map((room) => (
            <RoomRow key={`${room.id}:${room.name}`} room={room} />
          ))}
          <div className="flex gap-2 pt-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="New room"
              className="bg-white/5 border-white/10 text-white text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={add}
              aria-label="Add room"
              className="border-white/10 bg-white/5"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

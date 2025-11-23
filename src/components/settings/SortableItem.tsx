"use client";

import { GripVerticalIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    transition: {
      duration: 150,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-lg border border-[hsl(var(--header-border)/0.3)] bg-[hsl(var(--card)/0.6)] px-4 py-3 touch-none select-none w-full hover:bg-[hsl(var(--card)/0.8)] transition-colors"
    >
      <div className="text-sm font-medium text-slate-200">{children}</div>
      <Button
        size="icon"
        variant="ghost"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing hover:bg-transparent"
      >
        <GripVerticalIcon className="h-5 w-5 text-slate-400 hover:text-cyan-400 transition-colors drop-shadow-[0_0_4px_rgba(148,163,184,0.3)]" />
      </Button>
    </li>
  );
}

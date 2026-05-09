"use client";

// Registry-driven widget that mounts the right per-face component.
// variant="card" → compact (corner card)
// variant="placeholder" → large (active-face center, mobile)

import type { Face } from "@/features/era/types";
import { BrainWidget } from "./BrainWidget";
import { BudgetWidget } from "./BudgetWidget";
import { ChefWidget } from "./ChefWidget";
import { ScheduleWidget } from "./ScheduleWidget";

type Variant = "card" | "placeholder";

type Props = {
  face: Face;
  variant: Variant;
};

export function EraFaceWidget({ face, variant }: Props) {
  switch (face.key) {
    case "schedule":
      return <ScheduleWidget variant={variant} />;
    case "budget":
      return <BudgetWidget variant={variant} />;
    case "chef":
      return <ChefWidget variant={variant} />;
    case "brain":
      return <BrainWidget variant={variant} />;
    default:
      return null;
  }
}

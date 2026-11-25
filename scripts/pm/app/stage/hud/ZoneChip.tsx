import { forwardRef, type CSSProperties } from "react";
import type { ZoneId } from "../config";

export interface ZoneChipProps {
  zone: ZoneId | null;
  label: string;
  style?: CSSProperties;
}

/** The recorded action stays readable on the shelf while the camera moves. */
export const ZoneChip = forwardRef<HTMLOutputElement, ZoneChipProps>(
  function ZoneChip({ zone, label, style }, ref) {
    return (
      <output
        ref={ref}
        className="board-zone-chip foundry-command-chip"
        data-zone={zone ?? undefined}
        title={label}
        style={style}
        hidden={!zone || !label}
        tabIndex={0}
      >
        {label}
      </output>
    );
  },
);

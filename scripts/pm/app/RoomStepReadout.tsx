import "./room-step-readout.css";

export function RoomStepReadout({ number, total, label, replay = false }: {
  number: number;
  total: number;
  label: string;
  replay?: boolean;
}) {
  return (
    <div className="room-step-readout" aria-live="polite" aria-atomic="true">
      <small><i className="room-step-signal" aria-hidden="true" />{replay ? "Replay step" : "Current step"}</small>
      <strong>{label}</strong>
      <span className="room-step-count" aria-label={`Step ${number} of ${total}`}>{String(number).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
    </div>
  );
}

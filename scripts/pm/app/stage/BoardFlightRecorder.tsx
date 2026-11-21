import { FlightRecorder, type FlightRecorderProps } from "../FlightRecorder";
import { useBoardReplayTime } from "./clockStore";

/** Keep the original recorder while isolating its playhead from the page. */
export function BoardFlightRecorder(props: FlightRecorderProps) {
  const time = useBoardReplayTime(props.timeline.run.run_id, props.time);
  return <FlightRecorder {...props} time={time} />;
}

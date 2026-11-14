import { Sparkles } from "lucide-react";
import type { launchRecommendation } from "./launchRecommendationModel";
import "./launch-recommendation.css";

export function LaunchRecommendation({ recommendation, disabled, onRestore }: {
  recommendation: ReturnType<typeof launchRecommendation>;
  disabled: boolean;
  onRestore: () => void;
}) {
  if (!recommendation) return null;
  return <div className="launch-md-recommendation">
    <button type="button" className="text-button" disabled={disabled || !recommendation.supported}
      title={`Use Markdown recommendation · ${recommendation.alias}`} aria-label="Use Markdown recommendation" onClick={onRestore}>
      <Sparkles size={16} aria-hidden="true" />
      <span>{recommendation.modelLabel} · {recommendation.effort || "Default effort"}</span>
    </button>
    {!recommendation.supported && <small>Recommendation unavailable</small>}
  </div>;
}

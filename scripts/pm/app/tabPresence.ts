import { useEffect, useRef } from "react";

/** The glyphs are state, not a progress indicator. */
export function presenceSymbol(state: string) {
  if (["link-down", "signal-lost", "stale"].includes(state)) return "▲";
  if (state === "quiet") return "○";
  if (state === "failed") return "✕";
  if (state === "cancelled") return "■";
  if (state === "shipped") return "✓";
  if (state === "reverted") return "↩";
  if (
    [
      "your-turn",
      "owner-turn",
      "uat-ready",
      "push-pending",
      "revert-push-pending",
    ].includes(state)
  )
    return "◆";
  return "●";
}

export function presenceTitle(
  workId: string,
  state: string,
  attention = 0,
  title = "",
) {
  const suffix = title ? ` · ${title}` : "";
  if (attention > 0) return `◆ ${attention} · ${workId}${suffix}`;
  return `${presenceSymbol(state)} ${workId}${suffix}`;
}

export function useTabPresence(
  workId: string,
  state: string,
  attention = 0,
  title = "",
) {
  const link = useRef<HTMLLinkElement | null>(null);
  useEffect(() => {
    const title = document.title;
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/png";
    document.head.append(icon);
    link.current = icon;
    return () => {
      document.title = title;
      icon.remove();
      link.current = null;
    };
  }, []);
  useEffect(() => {
    const update = () => {
      document.title = presenceTitle(workId, state, attention, title);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const ctx = canvas.getContext("2d");
      if (!ctx || !link.current) return;
      const style = getComputedStyle(document.documentElement);
      const warning =
        attention > 0 ||
        [
          "stale",
          "signal-lost",
          "link-down",
          "your-turn",
          "owner-turn",
          "uat-ready",
          "push-pending",
          "revert-push-pending",
        ].includes(state);
      ctx.fillStyle =
        style
          .getPropertyValue(
            !attention &&
              (state === "failed" ||
                state === "cancelled" ||
                state === "reverted")
              ? "--ink-muted"
              : warning
                ? "--warning-ink"
                : "--accent",
          )
          .trim() || "currentColor";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 29px sans-serif";
      ctx.fillText(attention > 0 ? "◆" : presenceSymbol(state), 16, 17);
      link.current.href = canvas.toDataURL("image/png");
    };
    update();
    const theme = new MutationObserver(update);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class", "style"],
    });
    return () => theme.disconnect();
  }, [workId, state, attention, title]);
}

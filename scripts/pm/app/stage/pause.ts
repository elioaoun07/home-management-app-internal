/** Pause compositor animations and audio immediately, outside the frame path. */
export function createAnimationPause(root: HTMLElement) {
  let previous = false;
  const paused = new Set<Animation>();
  return (value: boolean, vitality: number) => {
    if (value === previous) return;
    previous = value;
    if (value)
      for (const animation of root.getAnimations?.({ subtree: true }) ?? []) {
        animation.pause();
        paused.add(animation);
      }
    else {
      for (const animation of paused) animation.play();
      paused.clear();
    }
    root.dispatchEvent(
      new CustomEvent("pm-stage-life", {
        detail: { vitality: value ? 0 : vitality, tier: 0, muted: value },
      }),
    );
  };
}

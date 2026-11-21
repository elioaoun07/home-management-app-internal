/** Minimal hook-unit dispatcher, not a DOM renderer. Effects, identity and state
 * publication are observable; browser integration remains a separate gate. */
export function createHookRuntime() {
  type Slot = {
    value?: unknown;
    deps?: readonly unknown[];
    cleanup?: () => void;
  };
  let slots: Slot[] = [],
    cursor = 0,
    updates = 0;
  const effects: (() => void)[] = [];
  const changed = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
    !a ||
    a.length !== b.length ||
    a.some((value, index) => !Object.is(value, b[index]));
  const runtime = {
    render<T>(body: () => T): T {
      cursor = 0;
      const value = body();
      effects.splice(0).forEach((effect) => effect());
      return value;
    },
    get updates() {
      return updates;
    },
    unmount() {
      slots.forEach((slot) => slot.cleanup?.());
      slots = [];
      effects.length = 0;
      cursor = 0;
      updates = 0;
    },
    useState<T>(
      initial: T | (() => T),
    ): [T, (next: T | ((previous: T) => T)) => void] {
      const index = cursor++;
      if (!slots[index])
        slots[index] = {
          value:
            typeof initial === "function" ? (initial as () => T)() : initial,
        };
      return [
        slots[index].value as T,
        (next) => {
          const prior = slots[index].value as T;
          const value =
            typeof next === "function"
              ? (next as (previous: T) => T)(prior)
              : next;
          if (!Object.is(prior, value)) {
            slots[index].value = value;
            updates++;
          }
        },
      ];
    },
    useRef<T>(value: T): { current: T } {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: { current: value } };
      return slots[index].value as { current: T };
    },
    useMemo<T>(factory: () => T, deps: readonly unknown[]): T {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps))
        slots[index] = { value: factory(), deps };
      return slots[index].value as T;
    },
    useCallback<T>(callback: T, deps: readonly unknown[]): T {
      return runtime.useMemo(() => callback, deps);
    },
    useEffect(effect: () => void | (() => void), deps: readonly unknown[]) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].deps, deps)) {
        const previous = slots[index];
        slots[index] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          const cleanup = effect();
          if (typeof cleanup === "function") slots[index].cleanup = cleanup;
        });
      }
    },
  };
  return runtime;
}

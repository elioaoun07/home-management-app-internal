import { useEffect, useState } from "react";

/**
 * Hook to defer expensive computations until after initial render
 * Shows instant UI with cached data, computes heavy stuff after paint
 */
export function useDeferredValue<T>(
  factory: () => T,
  deps: any[]
): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    // Defer computation to next frame for instant initial render
    const timeoutId = setTimeout(() => {
      setValue(factory());
    }, 0);

    return () => clearTimeout(timeoutId);
  }, deps);

  return value;
}

/**
 * Hook to check if component has mounted (for instant first paint)
 */
export function useHasMounted() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted;
}

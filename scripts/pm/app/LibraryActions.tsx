import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useCommand } from "./state";
import { ErrorNotice } from "./components";
type Inverse = {
  op: string;
  body: Record<string, unknown>;
  previousPath?: "path" | "from";
};
const Context = createContext<{
  save: (steps: Inverse[], destination?: string) => void;
  busy: boolean;
}>({ save: () => {}, busy: false });
export const useFileUndo = () => useContext(Context);
// Ephemeral inverse receipts live above route transitions, like Capture's Undo.
export function LibraryActions({ children }: { children: ReactNode }) {
  const [receipt, setReceipt] = useState<{
    steps: Inverse[];
    destination?: string;
  } | null>(null);
  const command = useCommand();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!receipt || busy || command.isPending || command.error) return;
    const timer = setTimeout(() => setReceipt(null), 4000);
    return () => clearTimeout(timer);
  }, [receipt, busy, command.isPending, command.error]);
  const undo = async () => {
    if (!receipt || busy) return;
    setBusy(true);
    try {
      let path: string | undefined;
      for (const step of receipt.steps) {
        const body = { ...step.body };
        if (step.previousPath) {
          if (!path) throw Error("Inverse path unavailable");
          body[step.previousPath] = path;
        }
        const result = await command.mutateAsync({ op: step.op, body });
        path = result.path;
        const remaining = receipt.steps
          .slice(receipt.steps.indexOf(step) + 1)
          .map((next, i) =>
            i === 0 && next.previousPath
              ? {
                  ...next,
                  previousPath: undefined,
                  body: { ...next.body, [next.previousPath]: path },
                }
              : next,
          );
        if (remaining.length) setReceipt({ ...receipt, steps: remaining });
      }
      if (receipt.destination) location.hash = receipt.destination;
      setReceipt(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        save: (steps, destination) => setReceipt({ steps, destination }),
        busy,
      }}
    >
      {children}
      {receipt && (
        <div className="undo-notice" role="status">
          <span>Saved</span>
          <button
            disabled={busy || command.isPending}
            onClick={() => {
              void undo().catch(() => {});
            }}
          >
            Undo
          </button>
          <button onClick={() => setReceipt(null)}>Dismiss</button>
          <ErrorNotice error={command.error} />
        </div>
      )}
    </Context.Provider>
  );
}

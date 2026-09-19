import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { post } from "./api";
import { transport, type ConnectionState } from "./transport";
import { buildWorld } from "./model";
import type { RunSummary, World } from "./types";

export const pmKeys = {
  all: ["pm-app"] as const,
  data: ["pm-app", "data"] as const,
  runs: ["pm-app", "runs"] as const,
  mode: ["pm-app", "mode"] as const,
  capabilities: ["pm-app", "capabilities"] as const,
  run: (id: string) => ["pm-app", "run", id] as const,
  events: (id: string) => ["pm-app", "events", id] as const,
  artifact: (id: string, path: string, version?: number) =>
    ["pm-app", "artifact", id, path, version] as const,
  recommendation: (
    file: string,
    cb: number,
    provider: string,
    lane: string,
    locator: string,
  ) => ["pm-app", "recommendation", file, cb, provider, lane, locator] as const,
  questions: (id: string) => ["pm-app", "run", id, "questions"] as const,
  turns: (id: string) => ["pm-app", "run", id, "turns"] as const,
  transcript: (id: string, turn: string) =>
    ["pm-app", "run", id, "transcript", turn] as const,
  preflight: (id: string) => ["pm-app", "preflight", id] as const,
  v2session: ["pm-app", "v2", "session"] as const,
  v2runs: ["pm-app", "v2", "runs"] as const,
  v2run: (id: string) => ["pm-app", "v2", "run", id] as const,
  v2executors: ["pm-app", "v2", "executors"] as const,
  v2queue: ["pm-app", "v2", "queue"] as const,
  v2assess: (file: string, id: string) => ["pm-app", "v2", "assess", file, id] as const,
};
export const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
const WorldContext = createContext<{
  world: World;
  runs: RunSummary[];
  connected: boolean;
  connection: ConnectionState;
  readError: Error | null;
  runError: Error | null;
} | null>(null);
export const useWorld = () => {
  const context = useContext(WorldContext);
  if (!context) throw new Error("Project provider is missing");
  return context;
};
function subscribeRoute(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
export function useRoute() {
  const hash = useSyncExternalStore(
    subscribeRoute,
    () => location.hash,
    () => "#/",
  );
  return useMemo(() => {
    const raw = hash.replace(/^#/, "") || "/";
    const i = raw.indexOf("?");
    const path = i < 0 ? raw : raw.slice(0, i);
    return {
      path,
      query: new URLSearchParams(i < 0 ? "" : raw.slice(i + 1)),
      full: raw,
      parts: path
        .split("/")
        .filter(Boolean)
        .map((value) => {
          try {
            return decodeURIComponent(value);
          } catch {
            return value;
          }
        }),
    };
  }, [hash]);
}
export function go(path: string) {
  location.hash = path;
}
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "The request could not finish.";
export interface UndoSnapshot {
  path: string;
  raw: string | null;
  expectCurrent: string | null;
}
export interface CommandReply {
  undo?: UndoSnapshot[];
  raw?: string;
  state?: string;
  ok?: boolean;
}
export function useCommand() {
  return useMutation({
    // Checklist and Inbox writes go through the transport's write path; V1
    // delivery commands only exist on the local server.
    mutationFn: ({ op, body }: { op: string; body: unknown }) =>
      op.startsWith("delivery/")
        ? post<CommandReply>(op, body)
        : transport().mutate<CommandReply>(op, body),
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }),
  });
}

function ProjectData({ children }: { children: ReactNode }) {
  const source = transport();
  const data = useQuery({
    queryKey: pmKeys.data,
    queryFn: ({ signal }) => source.snapshot(signal),
    refetchInterval: 30000,
    networkMode: "always",
  });
  const [connection, setConnection] = useState(() => source.connection());
  const world = useMemo(
    () => (data.data ? buildWorld(data.data) : null),
    [data.data],
  );
  const runs = useQuery({
    queryKey: pmKeys.runs,
    queryFn: ({ signal }) => source.v1Runs(signal),
    refetchInterval: 6000,
    enabled: !!world && !world.offline && connection.online,
  });
  useEffect(() => {
    const stop = source.start();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void client.invalidateQueries({ queryKey: pmKeys.all });
      }, 180);
    };
    const unsubscribe = source.subscribe((event) => {
      if (event.type === "ui") location.reload();
      else if (event.type === "connection") {
        setConnection(source.connection());
        refresh();
      } else refresh();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      stop();
    };
  }, [source]);
  if (!world)
    return (
      <div className="launch-screen">
        <div className="loading-orbit" />
        <h1>{data.isError ? "ERA is out of reach" : "Opening your world"}</h1>
        {data.isError && (
          <>
            <p>{message(data.error)}</p>
            <button className="primary" onClick={() => void data.refetch()}>
              Try again
            </button>
          </>
        )}
      </div>
    );
  return (
    <WorldContext.Provider
      value={{
        world,
        runs: runs.data?.sessions || [],
        connected: connection.online && !world.offline && !data.isError,
        connection,
        readError: data.error,
        runError: runs.error,
      }}
    >
      {children}
    </WorldContext.Provider>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <ProjectData>{children}</ProjectData>
    </QueryClientProvider>
  );
}

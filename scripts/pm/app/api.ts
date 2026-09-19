// Thin names the views already use, each delegating to the active transport
// (local server or phone relay). See transport.ts.
import { transport } from "./transport";
import type { Snapshot, V2Session } from "./types";

export { PendingCommand, PmError } from "./transport";

export const read = <T>(path: string, signal?: AbortSignal): Promise<T> => transport().read<T>(path, signal);
export const post = <T>(path: string, body: unknown, timeoutMs = 60000): Promise<T> => transport().post<T>(path, body, timeoutMs);
export const snapshot = (signal?: AbortSignal): Promise<Snapshot> => transport().snapshot(signal);
export const v2Session = (signal?: AbortSignal): Promise<V2Session> => transport().v2Session(signal);
export const v2Pair = (code: string): Promise<V2Session> => transport().v2Pair(code);
export const v2Post = <T>(path: string, body: Record<string, unknown>, timeoutMs = 60000): Promise<T> => transport().v2Command<T>(path, body, timeoutMs);

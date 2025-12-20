/**
 * Hub Persistence Layer
 *
 * WhatsApp-style offline-first architecture:
 * 1. Cache messages and threads in localStorage
 * 2. Show cached data immediately on load
 * 3. Sync with server in background
 * 4. Apply real-time delta updates via Supabase Realtime
 * 5. Persist UI state (active view, active thread)
 */
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { HubChatThread, HubMessage, HubView } from "./hooks";

// Storage keys
const STORAGE_KEYS = {
  ACTIVE_VIEW: "hub-active-view",
  ACTIVE_THREAD: "hub-active-thread",
  THREADS_CACHE: "hub-threads-cache",
  MESSAGES_CACHE_PREFIX: "hub-messages-",
  LAST_SYNC: "hub-last-sync",
  DRAFT_PREFIX: "hub-draft-",
  DISMISSED_ALERTS: "hub-dismissed-alerts",
} as const;

// Types for cached data
interface CachedThreads {
  threads: HubChatThread[];
  household_id: string | null;
  current_user_id: string;
  cached_at: number;
}

interface CachedMessages {
  messages: HubMessage[];
  thread_id: string;
  household_id: string;
  current_user_id: string;
  cached_at: number;
}

// Type for hub view
export type { HubView };

// Max age for cache (5 minutes) - after this, we'll refresh from server
const CACHE_MAX_AGE = 5 * 60 * 1000;
// Max messages to cache per thread
const MAX_CACHED_MESSAGES = 100;

/**
 * Safe localStorage operations with SSR protection
 */
export function getStorageItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Storage might be full - try to clean up old data
    cleanupOldCache();
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Silent fail if still can't write
    }
  }
}

function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Silent fail
  }
}

/**
 * Get cached messages for a thread (for initialData in query)
 */
export function getCachedMessages(threadId: string): CachedMessages | null {
  const cacheKey = `${STORAGE_KEYS.MESSAGES_CACHE_PREFIX}${threadId}`;
  return getStorageItem<CachedMessages | null>(cacheKey, null);
}

/**
 * Get cached threads (for initialData in query)
 */
export function getCachedThreads(): CachedThreads | null {
  return getStorageItem<CachedThreads | null>(STORAGE_KEYS.THREADS_CACHE, null);
}

/**
 * Get dismissed alerts from localStorage
 */
export function getDismissedAlerts(): Set<string> {
  const dismissed = getStorageItem<string[]>(STORAGE_KEYS.DISMISSED_ALERTS, []);
  return new Set(dismissed);
}

/**
 * Save dismissed alert to localStorage
 */
export function addDismissedAlert(alertId: string): void {
  const dismissed = getDismissedAlerts();
  dismissed.add(alertId);
  setStorageItem(STORAGE_KEYS.DISMISSED_ALERTS, Array.from(dismissed));
}

/**
 * Clear old dismissed alerts (older than 7 days)
 */
export function cleanupDismissedAlerts(): void {
  // For now, just clear all since we don't store timestamps
  // In a future enhancement, we could store {id, dismissedAt} objects
  setStorageItem(STORAGE_KEYS.DISMISSED_ALERTS, []);
}

/**
 * Cleanup old cached messages to free up space
 */
function cleanupOldCache(): void {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  const now = Date.now();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEYS.MESSAGES_CACHE_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        // Remove caches older than 1 hour
        if (data.cached_at && now - data.cached_at > 60 * 60 * 1000) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Hook for persisting Hub UI state (active view, active thread)
 */
export function useHubState() {
  // Initialize from localStorage
  const [activeView, setActiveViewState] = useState<HubView>(() =>
    getStorageItem<HubView>(STORAGE_KEYS.ACTIVE_VIEW, "chat")
  );

  const [activeThreadId, setActiveThreadIdState] = useState<string | null>(() =>
    getStorageItem<string | null>(STORAGE_KEYS.ACTIVE_THREAD, null)
  );

  // Persist to localStorage on change
  const setActiveView = useCallback((view: HubView) => {
    setActiveViewState(view);
    setStorageItem(STORAGE_KEYS.ACTIVE_VIEW, view);
  }, []);

  const setActiveThreadId = useCallback((threadId: string | null) => {
    setActiveThreadIdState(threadId);
    if (threadId) {
      setStorageItem(STORAGE_KEYS.ACTIVE_THREAD, threadId);
    } else {
      removeStorageItem(STORAGE_KEYS.ACTIVE_THREAD);
    }
  }, []);

  return {
    activeView,
    setActiveView,
    activeThreadId,
    setActiveThreadId,
  };
}

/**
 * Hook for caching threads list with background sync
 */
export function useThreadsCache() {
  const queryClient = useQueryClient();

  // Load cached threads on mount and prime the query cache
  useEffect(() => {
    const cached = getStorageItem<CachedThreads | null>(
      STORAGE_KEYS.THREADS_CACHE,
      null
    );

    if (cached && cached.threads?.length > 0) {
      // Prime the query cache with cached data
      queryClient.setQueryData(["hub", "threads"], {
        threads: cached.threads,
        household_id: cached.household_id,
        current_user_id: cached.current_user_id,
      });
    }
  }, [queryClient]);

  // Function to cache threads
  const cacheThreads = useCallback(
    (data: {
      threads: HubChatThread[];
      household_id: string | null;
      current_user_id: string;
    }) => {
      const cacheData: CachedThreads = {
        ...data,
        cached_at: Date.now(),
      };
      setStorageItem(STORAGE_KEYS.THREADS_CACHE, cacheData);
    },
    []
  );

  return { cacheThreads };
}

/**
 * Hook for caching messages per thread with background sync
 */
export function useMessagesCache(threadId: string | null) {
  const queryClient = useQueryClient();

  // Load cached messages on mount and prime the query cache
  useEffect(() => {
    if (!threadId) return;

    const cacheKey = `${STORAGE_KEYS.MESSAGES_CACHE_PREFIX}${threadId}`;
    const cached = getStorageItem<CachedMessages | null>(cacheKey, null);

    if (cached && cached.messages?.length > 0) {
      // Check if cache is still fresh
      const isFresh = Date.now() - cached.cached_at < CACHE_MAX_AGE;

      // Prime the query cache with cached data
      queryClient.setQueryData(["hub", "messages", threadId], {
        messages: cached.messages,
        message_actions: [],
        thread_id: cached.thread_id,
        household_id: cached.household_id,
        current_user_id: cached.current_user_id,
        first_unread_message_id: null,
        unread_count: 0,
      });

      // If cache is stale, trigger a background refetch
      if (!isFresh) {
        queryClient.invalidateQueries({
          queryKey: ["hub", "messages", threadId],
        });
      }
    }
  }, [threadId, queryClient]);

  // Function to cache messages
  const cacheMessages = useCallback(
    (
      threadId: string,
      data: {
        messages: HubMessage[];
        thread_id: string;
        household_id: string;
        current_user_id: string;
      }
    ) => {
      const cacheKey = `${STORAGE_KEYS.MESSAGES_CACHE_PREFIX}${threadId}`;

      // Only cache the most recent messages
      const recentMessages = data.messages.slice(-MAX_CACHED_MESSAGES);

      const cacheData: CachedMessages = {
        messages: recentMessages,
        thread_id: data.thread_id,
        household_id: data.household_id,
        current_user_id: data.current_user_id,
        cached_at: Date.now(),
      };
      setStorageItem(cacheKey, cacheData);
    },
    []
  );

  // Function to add a single message to cache (for real-time updates)
  const addMessageToCache = useCallback(
    (threadId: string, message: HubMessage) => {
      const cacheKey = `${STORAGE_KEYS.MESSAGES_CACHE_PREFIX}${threadId}`;
      const cached = getStorageItem<CachedMessages | null>(cacheKey, null);

      if (cached) {
        // Check if message already exists
        const exists = cached.messages.some((m) => m.id === message.id);
        if (!exists) {
          cached.messages.push(message);
          // Keep only recent messages
          if (cached.messages.length > MAX_CACHED_MESSAGES) {
            cached.messages = cached.messages.slice(-MAX_CACHED_MESSAGES);
          }
          cached.cached_at = Date.now();
          setStorageItem(cacheKey, cached);
        }
      }
    },
    []
  );

  return { cacheMessages, addMessageToCache };
}

/**
 * Hook for managing message drafts (unsent messages)
 */
export function useDraftMessage(threadId: string | null) {
  const [draft, setDraftState] = useState<string>("");

  // Load draft on thread change
  useEffect(() => {
    if (!threadId) {
      setDraftState("");
      return;
    }

    const key = `${STORAGE_KEYS.DRAFT_PREFIX}${threadId}`;
    const savedDraft = getStorageItem<string>(key, "");
    setDraftState(savedDraft);
  }, [threadId]);

  // Save draft
  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);

      if (threadId) {
        const key = `${STORAGE_KEYS.DRAFT_PREFIX}${threadId}`;
        if (value) {
          setStorageItem(key, value);
        } else {
          removeStorageItem(key);
        }
      }
    },
    [threadId]
  );

  // Clear draft (after sending)
  const clearDraft = useCallback(() => {
    setDraftState("");
    if (threadId) {
      const key = `${STORAGE_KEYS.DRAFT_PREFIX}${threadId}`;
      removeStorageItem(key);
    }
  }, [threadId]);

  return { draft, setDraft, clearDraft };
}

/**
 * Hook to sync cache with query data
 * Call this after successful API fetches to update the cache
 */
export function useCacheSync() {
  const { cacheThreads } = useThreadsCache();

  const syncThreadsToCache = useCallback(
    (data: {
      threads: HubChatThread[];
      household_id: string | null;
      current_user_id: string;
    }) => {
      cacheThreads(data);
    },
    [cacheThreads]
  );

  const syncMessagesToCache = useCallback(
    (
      threadId: string,
      data: {
        messages: HubMessage[];
        thread_id: string;
        household_id: string;
        current_user_id: string;
      }
    ) => {
      const cacheKey = `${STORAGE_KEYS.MESSAGES_CACHE_PREFIX}${threadId}`;
      const recentMessages = data.messages.slice(-MAX_CACHED_MESSAGES);

      const cacheData: CachedMessages = {
        messages: recentMessages,
        thread_id: data.thread_id,
        household_id: data.household_id,
        current_user_id: data.current_user_id,
        cached_at: Date.now(),
      };
      setStorageItem(cacheKey, cacheData);
    },
    []
  );

  return { syncThreadsToCache, syncMessagesToCache };
}

/**
 * Hook to initialize Hub cache on app startup
 * Primes TanStack Query cache with localStorage data for instant display
 */
export function useHubCacheInit() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Load cached threads
    const cachedThreads = getStorageItem<CachedThreads | null>(
      STORAGE_KEYS.THREADS_CACHE,
      null
    );

    if (cachedThreads && cachedThreads.threads?.length > 0) {
      // Only use cache if it's not too old (30 minutes for threads)
      const isFresh = Date.now() - cachedThreads.cached_at < 30 * 60 * 1000;

      if (isFresh) {
        queryClient.setQueryData(["hub", "threads"], {
          threads: cachedThreads.threads,
          household_id: cachedThreads.household_id,
          current_user_id: cachedThreads.current_user_id,
        });
      }
    }

    // Load cached messages for the last active thread
    const activeThreadId = getStorageItem<string | null>(
      STORAGE_KEYS.ACTIVE_THREAD,
      null
    );

    if (activeThreadId) {
      const cacheKey = `${STORAGE_KEYS.MESSAGES_CACHE_PREFIX}${activeThreadId}`;
      const cachedMessages = getStorageItem<CachedMessages | null>(
        cacheKey,
        null
      );

      if (cachedMessages && cachedMessages.messages?.length > 0) {
        const isFresh = Date.now() - cachedMessages.cached_at < CACHE_MAX_AGE;

        if (isFresh) {
          queryClient.setQueryData(["hub", "messages", activeThreadId], {
            messages: cachedMessages.messages,
            message_actions: [],
            thread_id: cachedMessages.thread_id,
            household_id: cachedMessages.household_id,
            current_user_id: cachedMessages.current_user_id,
            first_unread_message_id: null,
            unread_count: 0,
          });
        }
      }
    }
  }, [queryClient]);
}

/**
 * Clear all hub cache (for logout or data reset)
 */
export function clearHubCache(): void {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith("hub-") ||
        key.startsWith(STORAGE_KEYS.MESSAGES_CACHE_PREFIX) ||
        key.startsWith(STORAGE_KEYS.DRAFT_PREFIX))
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Standalone function to add a message to localStorage cache (for real-time updates)
 * Can be called outside of React components
 */
export function addMessageToLocalCache(
  threadId: string,
  message: HubMessage
): void {
  const cacheKey = `${STORAGE_KEYS.MESSAGES_CACHE_PREFIX}${threadId}`;
  const cached = getStorageItem<CachedMessages | null>(cacheKey, null);

  if (cached) {
    // Check if message already exists
    const exists = cached.messages.some((m) => m.id === message.id);
    if (!exists) {
      cached.messages.push(message);
      // Keep only recent messages
      if (cached.messages.length > MAX_CACHED_MESSAGES) {
        cached.messages = cached.messages.slice(-MAX_CACHED_MESSAGES);
      }
      cached.cached_at = Date.now();
      setStorageItem(cacheKey, cached);
    }
  }
}

/**
 * Standalone function to update thread's last message in cache
 */
export function updateThreadLastMessageInCache(
  threadId: string,
  message: HubMessage
): void {
  const cached = getStorageItem<CachedThreads | null>(
    STORAGE_KEYS.THREADS_CACHE,
    null
  );

  if (cached && cached.threads) {
    const threadIndex = cached.threads.findIndex((t) => t.id === threadId);
    if (threadIndex >= 0) {
      cached.threads[threadIndex] = {
        ...cached.threads[threadIndex],
        last_message: {
          id: message.id,
          content: message.content,
          sender_user_id: message.sender_user_id,
          created_at: message.created_at,
        },
        last_message_at: message.created_at,
      };
      cached.cached_at = Date.now();
      setStorageItem(STORAGE_KEYS.THREADS_CACHE, cached);
    }
  }
}

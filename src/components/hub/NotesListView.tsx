// NotesListView.tsx - Special notebook-style view for notes purpose threads
"use client";

import { HubChatThread, HubMessage } from "@/features/hub/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Menu,
  Pin,
  Trash2,
  X,
} from "lucide-react";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import HTMLFlipBook from "react-pageflip";
import { toast } from "sonner";

// Topic type for notebook sections
interface NoteTopic {
  id: string;
  title: string;
  icon: string;
  color: string;
  position: number;
  created_at: string;
}

interface NoteItem {
  id: string;
  content: string;
  checked: boolean;
  checkedAt: string | null;
  checkedBy: string | null;
  createdAt: string;
  senderId: string;
  isPinned: boolean;
  pinnedAt: string | null;
  topicId: string | null;
}

// Notebook line component - defined outside to prevent re-creation on each render
const NotebookLine = ({ children }: { children: React.ReactNode }) => (
  <div className="relative min-h-[48px] flex items-center transition-all duration-200 py-2">
    {children}
  </div>
);

// Stable input component - uses React.memo to prevent re-renders when parent changes
// This is the key to keeping focus stable
const StableNoteInput = React.memo(function StableNoteInput({
  onSubmit,
  inputRef,
  onTyping,
  onFocused,
  onBlurred,
}: {
  onSubmit: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onTyping: () => void;
  onFocused: () => void;
  onBlurred: () => void;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      onFocus={onFocused}
      onBlur={onBlurred}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const value = (e.target as HTMLInputElement).value.trim();
          if (value) {
            onSubmit(value);
            (e.target as HTMLInputElement).value = "";
          }
          return;
        }

        // Track active typing so we can recover focus if flipbook remounts.
        // Ignore navigation keys.
        if (
          e.key !== "Shift" &&
          e.key !== "Control" &&
          e.key !== "Alt" &&
          e.key !== "Meta" &&
          e.key !== "Tab" &&
          e.key !== "Escape"
        ) {
          onTyping();
        }
      }}
      placeholder="Write a note..."
      className="flex-1 bg-transparent border-none text-white text-lg sm:text-xl placeholder:text-white/30 focus:outline-none font-handwriting leading-relaxed ml-2 py-2"
      style={{
        fontFamily: "'Caveat', 'Patrick Hand', cursive",
      }}
      autoComplete="off"
      enterKeyHint="send"
    />
  );
});

// react-pageflip requires pages to be defined with forwardRef
const FlipBookPage = forwardRef<
  HTMLDivElement,
  { children: React.ReactNode; isInteractive: boolean }
>(({ children, isInteractive }, ref) => (
  <div
    ref={ref}
    className={cn(
      // IMPORTANT: page-flip overwrites inline styles every animation frame via style.cssText.
      // Keep all visuals in CSS classes (not inline styles) so pages stay solid during flip.
      "w-full h-full flex flex-col notebook-page",
      !isInteractive && "pointer-events-none select-none"
    )}
  >
    {/* Paper texture grain */}
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.025]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
    {/* Subtle paper edge highlight on left */}
    <div
      className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none"
      style={{
        background:
          "linear-gradient(to bottom, transparent 5%, rgba(255,255,255,0.03) 20%, rgba(255,255,255,0.03) 80%, transparent 95%)",
      }}
    />
    {children}
  </div>
));
FlipBookPage.displayName = "FlipBookPage";

interface NotesListViewProps {
  messages: HubMessage[];
  currentUserId: string;
  threadId: string;
  thread?: HubChatThread | null;
  onAddItem: (content: string, topicId?: string) => void;
  onDeleteItem: (messageId: string) => void;
  onUpdateItem?: (messageId: string, content: string) => void;
  isLoading?: boolean;
  searchQuery?: string;
}

export function NotesListView({
  messages,
  currentUserId,
  threadId,
  thread,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  isLoading = false,
  searchQuery = "",
}: NotesListViewProps) {
  const queryClient = useQueryClient();
  const themeClasses = useThemeClasses();
  const [isClearing, setIsClearing] = useState(false);
  const [pendingToggles, setPendingToggles] = useState<Map<string, number>>(
    new Map()
  );
  const noteInputRef = useRef<HTMLInputElement>(null);
  const pageEndRef = useRef<HTMLDivElement>(null);
  const lastSubmitAtRef = useRef<number>(0);
  const focusRetryTimersRef = useRef<number[]>([]);
  const lastTypingAtRef = useRef<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const editDraftRef = useRef<string>("");

  // Topics state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topics, setTopics] = useState<NoteTopic[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [isFlipping, setIsFlipping] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipBookRef = useRef<any>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Swipe gutters: keep page flip animation, but don't let PageFlip hijack clicks/taps
  // (inputs need native pointer events to focus/type).
  const swipeStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    triggered: boolean;
    direction: "prev" | "next";
  } | null>(null);

  const triggerFlip = useCallback((direction: "prev" | "next") => {
    try {
      const api = flipBookRef.current?.pageFlip?.();
      if (!api) return;

      if (direction === "prev") api.flipPrev?.();
      else api.flipNext?.();

      // Keep local state in sync even if onFlip doesn't fire
      setTimeout(() => {
        try {
          setCurrentPageIndex(api.getCurrentPageIndex?.() ?? 0);
        } catch {
          // ignore
        }
      }, 0);
    } catch {
      // ignore
    }
  }, []);

  const onGutterPointerDown = useCallback(
    (direction: "prev" | "next") => (e: React.PointerEvent<HTMLDivElement>) => {
      // Only react to primary pointer
      if (e.button !== 0) return;

      swipeStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        triggered: false,
        direction,
      };

      // Capture pointer so we can detect swipe reliably
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [swipeStateRef]
  );

  const onGutterPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = swipeStateRef.current;
      if (!state || state.pointerId !== e.pointerId || state.triggered) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      // Ignore if user is mostly scrolling vertically
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return;

      // Trigger after a deliberate horizontal swipe
      if (Math.abs(dx) >= 30) {
        state.triggered = true;
        // Typical gesture: swipe left => next, swipe right => prev
        if (dx < 0) triggerFlip("next");
        else triggerFlip("prev");
      }
    },
    [triggerFlip]
  );

  const onGutterPointerUpOrCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = swipeStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;
      swipeStateRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    []
  );

  // Fetch topics for this thread
  const fetchTopics = useCallback(async () => {
    setIsLoadingTopics(true);
    try {
      const res = await fetch(`/api/hub/topics?thread_id=${threadId}`);
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || []);
      }
    } catch (error) {
      console.error("Failed to fetch topics:", error);
    } finally {
      setIsLoadingTopics(false);
    }
  }, [threadId]);

  // Load topics on mount
  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // Create new topic
  const createTopic = async () => {
    if (!newTopicTitle.trim()) return;
    setIsCreatingTopic(true);
    try {
      const res = await fetch("/api/hub/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          title: newTopicTitle.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTopics((prev) => [...prev, data.topic]);
        setNewTopicTitle("");
        toast.success("Topic created");
        // Switch to new topic with animation
        handleTopicSwitch(data.topic.id);
      }
    } catch (error) {
      console.error("Failed to create topic:", error);
      toast.error("Failed to create topic");
    } finally {
      setIsCreatingTopic(false);
    }
  };

  // Handle topic switch with react-pageflip animation
  const handleTopicSwitch = (topicId: string | null) => {
    if (isFlipping) return;

    const targetPageIndex = topicId
      ? Math.max(0, topics.findIndex((t) => t.id === topicId) + 1)
      : 0;

    try {
      // Use turnToPage (not flip) to navigate to a specific page index
      flipBookRef.current?.pageFlip?.()?.turnToPage?.(targetPageIndex);
    } catch {
      // ignore
    }

    setCurrentPageIndex(targetPageIndex);

    setSidebarOpen(false);
  };

  const handleFlip = useCallback((e: { data: number }) => {
    setCurrentPageIndex(e.data);
  }, []);

  const handleChangeState = useCallback((e: { data: string }) => {
    // states include: user_fold, fold_corner, flipping, read
    setIsFlipping(e.data !== "read");
  }, []);

  // Derive active topic from current page index
  useEffect(() => {
    if (currentPageIndex === 0) {
      setActiveTopic(null);
      return;
    }

    const topic = topics[currentPageIndex - 1];
    setActiveTopic(topic?.id ?? null);
  }, [currentPageIndex, topics]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Helper to highlight search terms
  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const parts = text.split(
      new RegExp(
        `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi"
      )
    );
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-yellow-400 text-black px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const focusAndScrollToLastLine = useCallback(() => {
    if (editingId) return;
    // Wait for DOM updates from optimistic insert + react-pageflip layout.
    requestAnimationFrame(() => {
      pageEndRef.current?.scrollIntoView({ block: "end" });
      requestAnimationFrame(() => {
        // preventScroll keeps us anchored after scrollIntoView.
        try {
          noteInputRef.current?.focus({ preventScroll: true });
        } catch {
          noteInputRef.current?.focus();
        }
      });
    });
  }, [editingId]);

  const clearFocusRetryTimers = useCallback(() => {
    for (const t of focusRetryTimersRef.current) {
      window.clearTimeout(t);
    }
    focusRetryTimersRef.current = [];
  }, []);

  const ensureNoteInputFocused = useCallback(
    (opts?: { scroll?: boolean }) => {
      if (editingId) return;
      const scroll = opts?.scroll ?? true;

      if (scroll) {
        pageEndRef.current?.scrollIntoView({ block: "end" });
      }

      const input = noteInputRef.current;
      if (!input) return;
      if (document.activeElement === input) return;

      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
    },
    [editingId]
  );

  const kickFocusToLastLine = useCallback(
    (reason: "submit" | "messages" | "page" | "typing" = "submit") => {
      if (editingId) return;
      clearFocusRetryTimers();

      // Some flipbook updates remount the page DOM; retry a few times.
      const delays =
        reason === "submit"
          ? [0, 16, 60, 140, 260, 420, 800, 1400, 2200]
          : reason === "typing"
            ? [0, 16, 80, 200, 500]
            : [0, 60, 180, 420, 800, 1400, 2200];
      for (const d of delays) {
        const timer = window.setTimeout(() => {
          // Keep scroll behavior only on the first attempt.
          ensureNoteInputFocused({ scroll: d === 0 });
        }, d);
        focusRetryTimersRef.current.push(timer);
      }
    },
    [clearFocusRetryTimers, editingId, ensureNoteInputFocused]
  );

  useEffect(() => {
    return () => {
      clearFocusRetryTimers();
    };
  }, [clearFocusRetryTimers]);

  // Filter items based on search query
  const filterItems = (itemsList: NoteItem[]) => {
    if (!searchQuery.trim()) return itemsList;
    return itemsList.filter((item) =>
      item.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Auto-focus and scroll to the last line when opening or switching pages.
  useEffect(() => {
    const timer = setTimeout(() => {
      // Use the more robust focus kicker here too.
      kickFocusToLastLine("page");
    }, 120);
    return () => clearTimeout(timer);
  }, [currentPageIndex, activeTopic, kickFocusToLastLine]);

  // After messages change, if we just submitted, re-focus the input.
  // This covers flipbook DOM rebuilds on optimistic insert.
  useLayoutEffect(() => {
    if (editingId) return;
    const elapsed = Date.now() - lastSubmitAtRef.current;
    if (elapsed < 1200) {
      kickFocusToLastLine("messages");
    }
  }, [messages, editingId, kickFocusToLastLine]);

  const handleNoteTyping = useCallback(() => {
    lastTypingAtRef.current = Date.now();
  }, []);

  const handleNoteFocused = useCallback(() => {
    // Consider focus as typing activity (helps guard blur recovery).
    lastTypingAtRef.current = Date.now();
  }, []);

  const handleNoteBlurred = useCallback(() => {
    if (editingId) return;

    // If the input blurs while the user is actively typing, steal focus back.
    // This specifically targets flipbook/topic remounts that happen shortly after.
    const elapsed = Date.now() - lastTypingAtRef.current;
    if (elapsed < 2500) {
      kickFocusToLastLine("typing");
    }
  }, [editingId, kickFocusToLastLine]);

  // Parse messages into note items (all topics)
  const allItems: NoteItem[] = messages
    .filter(
      (msg) =>
        msg.message_type === "text" &&
        msg.content &&
        !msg.deleted_at &&
        !msg.archived_at
    )
    .map((msg) => ({
      id: msg.id,
      content: msg.content || "",
      checked: !!msg.checked_at,
      checkedAt: msg.checked_at || null,
      checkedBy: msg.checked_by || null,
      createdAt: msg.created_at,
      senderId: msg.sender_user_id,
      isPinned: !!(msg as any).pinned_at,
      pinnedAt: (msg as any).pinned_at || null,
      topicId: (msg as any).topic_id || null,
    }))
    .sort((a, b) => {
      // Pinned items first, then unchecked, then checked
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      // Within same pinned status, unchecked items first
      if (a.checked !== b.checked) {
        return a.checked ? 1 : -1;
      }
      // Within same checked status, sort by creation date
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const getListsForTopic = useCallback(
    (topicId: string | null) => {
      const topicItems = allItems.filter((item) =>
        topicId === null ? item.topicId === null : item.topicId === topicId
      );

      const applySearch = (itemsList: NoteItem[]) => {
        if (!searchQuery.trim()) return itemsList;
        const query = searchQuery.toLowerCase();
        return itemsList.filter((item) =>
          item.content.toLowerCase().includes(query)
        );
      };

      const pinnedItems = applySearch(
        topicItems.filter((item) => item.isPinned && !item.checked)
      );
      const uncheckedItems = applySearch(
        topicItems.filter((item) => !item.isPinned && !item.checked)
      );
      const checkedItemsList = applySearch(
        topicItems.filter((item) => item.checked)
      );

      const hasSearchResults =
        searchQuery.trim() &&
        (pinnedItems.length > 0 ||
          uncheckedItems.length > 0 ||
          checkedItemsList.length > 0);

      return {
        topicItems,
        pinnedItems,
        uncheckedItems,
        checkedItemsList,
        hasSearchResults,
      };
    },
    [allItems, searchQuery]
  );

  // Current page lists (drives header actions, etc.)
  const { pinnedItems, uncheckedItems, checkedItemsList, hasSearchResults } =
    getListsForTopic(activeTopic);

  // Delete handler with logging
  const handleDelete = useCallback(
    (messageId: string, e?: React.MouseEvent) => {
      console.log("[NotesListView] Delete clicked for:", messageId);
      e?.stopPropagation();
      e?.preventDefault();
      onDeleteItem(messageId);
    },
    [onDeleteItem]
  );

  // Stable callback for submitting notes - memoized so StableNoteInput doesn't re-render
  const handleSubmitNote = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      lastSubmitAtRef.current = Date.now();

      // Fire the real mutation (parent already owns the server call).
      onAddItem(trimmed, activeTopic || undefined);

      // Keep cursor on the new last line.
      kickFocusToLastLine("submit");
    },
    [activeTopic, kickFocusToLastLine, onAddItem]
  );

  // Start editing a note
  const startEditing = (item: NoteItem) => {
    setEditingId(item.id);
    setEditingContent(item.content);
    editDraftRef.current = item.content;
  };

  // Save edited note
  const saveEdit = useCallback(async () => {
    const nextContent = editDraftRef.current.trim();
    if (!editingId || !nextContent) {
      setEditingId(null);
      return;
    }

    const queryKey = ["hub", "messages", threadId];
    const originalContent = allItems.find((i) => i.id === editingId)?.content;

    // Optimistic update
    queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        messages: old.messages.map((msg) =>
          msg.id === editingId ? { ...msg, content: nextContent } : msg
        ),
      };
    });

    setEditingId(null);

    // Call update API
    if (onUpdateItem) {
      onUpdateItem(editingId, nextContent);
    } else {
      // Direct API call if no handler provided
      try {
        const res = await fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_content",
            message_id: editingId,
            content: nextContent,
          }),
        });

        if (!res.ok) {
          // Rollback on error
          queryClient.setQueryData<{ messages: HubMessage[] }>(
            queryKey,
            (old) => {
              if (!old) return old;
              return {
                ...old,
                messages: old.messages.map((msg) =>
                  msg.id === editingId
                    ? { ...msg, content: originalContent ?? null }
                    : msg
                ),
              };
            }
          );
          toast.error("Failed to update note");
        }
      } catch (error) {
        console.error("Failed to update note:", error);
      }
    }
  }, [editingId, threadId, queryClient, onUpdateItem, allItems]);

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  // Toggle check state via API with instant optimistic UI
  const toggleCheck = useCallback(
    async (itemId: string) => {
      const queryKey = ["hub", "messages", threadId];

      // Track pending toggle count for this item
      setPendingToggles((prev) => {
        const newMap = new Map(prev);
        newMap.set(itemId, (newMap.get(itemId) || 0) + 1);
        return newMap;
      });

      // Get current state from cache to determine toggle direction
      const currentData = queryClient.getQueryData<{ messages: HubMessage[] }>(
        queryKey
      );
      const currentMessage = currentData?.messages.find((m) => m.id === itemId);
      const shouldCheck = !currentMessage?.checked_at;

      // Optimistically update UI immediately - no delay
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg.id === itemId
              ? {
                  ...msg,
                  checked_at: shouldCheck ? new Date().toISOString() : null,
                  checked_by: shouldCheck ? currentUserId : null,
                }
              : msg
          ),
        };
      });

      try {
        // Fire and forget - don't await or refetch
        fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "toggle_check",
            message_id: itemId,
          }),
        }).then((res) => {
          if (!res.ok) {
            console.error("Failed to toggle check");
            // Silently rollback on error
            queryClient.setQueryData<{ messages: HubMessage[] }>(
              queryKey,
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  messages: old.messages.map((msg) =>
                    msg.id === itemId
                      ? {
                          ...msg,
                          checked_at: shouldCheck
                            ? null
                            : new Date().toISOString(),
                          checked_by: shouldCheck ? null : currentUserId,
                        }
                      : msg
                  ),
                };
              }
            );
          }
        });
      } finally {
        // Clear pending toggle after a short delay
        setTimeout(() => {
          setPendingToggles((prev) => {
            const newMap = new Map(prev);
            const count = newMap.get(itemId) || 0;
            if (count <= 1) {
              newMap.delete(itemId);
            } else {
              newMap.set(itemId, count - 1);
            }
            return newMap;
          });
        }, 100);
      }
    },
    [queryClient, threadId, currentUserId]
  );

  // Toggle pin state via API with instant optimistic UI
  const togglePin = useCallback(
    async (itemId: string) => {
      const queryKey = ["hub", "messages", threadId];

      // Get current state from cache to determine toggle direction
      const currentData = queryClient.getQueryData<{ messages: HubMessage[] }>(
        queryKey
      );
      const currentMessage = currentData?.messages.find((m) => m.id === itemId);
      const shouldPin = !(currentMessage as any)?.pinned_at;

      // Optimistically update UI immediately
      queryClient.setQueryData<{ messages: HubMessage[] }>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg.id === itemId
              ? {
                  ...msg,
                  pinned_at: shouldPin ? new Date().toISOString() : null,
                }
              : msg
          ),
        };
      });

      try {
        // Fire and forget
        fetch("/api/hub/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "toggle_pin",
            message_id: itemId,
          }),
        }).then((res) => {
          if (!res.ok) {
            console.error("Failed to toggle pin");
            // Silently rollback on error
            queryClient.setQueryData<{ messages: HubMessage[] }>(
              queryKey,
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  messages: old.messages.map((msg) =>
                    msg.id === itemId
                      ? {
                          ...msg,
                          pinned_at: shouldPin
                            ? null
                            : new Date().toISOString(),
                        }
                      : msg
                  ),
                };
              }
            );
          }
        });
      } catch (error) {
        console.error("Failed to toggle pin:", error);
      }
    },
    [queryClient, threadId]
  );

  // Clear all checked items (archive them)
  const handleClearChecked = useCallback(async () => {
    if (checkedItemsList.length === 0 || isClearing) return;

    setIsClearing(true);

    try {
      const res = await fetch("/api/hub/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_checked",
          thread_id: threadId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to clear items");
      }

      const data = await res.json();
      toast.success(`Cleared ${data.archivedCount} notes`);

      // Refresh the messages
      queryClient.invalidateQueries({
        queryKey: ["hub", "messages", threadId],
      });
    } catch (error) {
      console.error("Failed to clear checked items:", error);
      toast.error("Failed to clear notes");
    } finally {
      setIsClearing(false);
    }
  }, [checkedItemsList.length, isClearing, queryClient, threadId]);

  const renderTopicPage = useCallback(
    (topicId: string | null, isInteractive: boolean) => {
      const { pinnedItems, uncheckedItems, checkedItemsList } =
        getListsForTopic(topicId);

      return (
        <div
          className={cn(
            "w-full h-full flex flex-col relative dark-paper",
            themeClasses.bgPage
          )}
        >
          {/* Subtle paper grain texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative flex-1 min-h-0 overflow-y-auto">
            {/* Content container - full width on mobile, centered on desktop */}
            <div className="relative w-full max-w-3xl mx-auto">
              {/* Left margin line - hidden on mobile, visible on larger screens */}
              <div
                className="absolute hidden sm:block left-8 top-0 bottom-0 w-[2px] opacity-30"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent 0%, #ef4444 10%, #ef4444 90%, transparent 100%)",
                }}
              />

              {/* Notes List - full width with minimal padding on mobile */}
              <div className="pb-32 px-3 sm:px-4 sm:pl-12">
                {/* Loading skeleton */}
                {isLoading ? (
                  <div className="space-y-0">
                    {[1, 2, 3, 4].map((i) => (
                      <NotebookLine key={i}>
                        <div className="flex items-center gap-3 py-3 px-4 animate-pulse">
                          <div className="w-5 h-5 rounded border-2 border-white/10" />
                          <div className="h-4 bg-white/10 rounded w-3/4 ml-14" />
                        </div>
                      </NotebookLine>
                    ))}
                    <p
                      className="text-center text-xs text-white/30 mt-6 font-handwriting"
                      style={{
                        fontFamily: "'Caveat', 'Patrick Hand', cursive",
                      }}
                    >
                      Loading your notes...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Empty state / Notes list */}
                    {uncheckedItems.length === 0 &&
                    pinnedItems.length === 0 &&
                    checkedItemsList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <span className="text-5xl mb-3">📝</span>
                        <p
                          className="text-xl text-white/50 font-handwriting"
                          style={{
                            fontFamily: "'Caveat', 'Patrick Hand', cursive",
                          }}
                        >
                          Your notebook is empty
                        </p>
                        <p
                          className="text-lg text-white/30 mt-1 font-handwriting"
                          style={{
                            fontFamily: "'Caveat', 'Patrick Hand', cursive",
                          }}
                        >
                          Start writing below
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Pinned notes - Always at top */}
                        {pinnedItems.length > 0 && (
                          <>
                            <div
                              className={cn(
                                "px-4 py-2 text-base font-handwriting flex items-center gap-2",
                                themeClasses.textFaint
                              )}
                            >
                              <Pin className="w-3.5 h-3.5" />
                              Pinned
                            </div>
                            {pinnedItems.map((item) => (
                              <NotebookLine key={item.id}>
                                <div className="flex items-center w-full group px-3">
                                  <button
                                    onClick={() => toggleCheck(item.id)}
                                    className={cn(
                                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
                                      themeClasses.border,
                                      themeClasses.borderHover,
                                      themeClasses.bgHover
                                    )}
                                  />

                                  <button
                                    onClick={() => togglePin(item.id)}
                                    className={cn(
                                      "ml-2 p-1 rounded transition-all",
                                      themeClasses.text,
                                      themeClasses.bgHover
                                    )}
                                    title="Unpin note"
                                  >
                                    <Pin className="w-4 h-4 fill-current" />
                                  </button>

                                  {editingId === item.id ? (
                                    <input
                                      ref={editInputRef}
                                      type="text"
                                      defaultValue={editingContent}
                                      onChange={(e) => {
                                        editDraftRef.current = e.target.value;
                                      }}
                                      onKeyDown={handleEditKeyPress}
                                      onBlur={saveEdit}
                                      className="flex-1 bg-transparent border-none text-white focus:outline-none text-lg sm:text-xl font-handwriting leading-relaxed ml-2 py-1"
                                      style={{
                                        fontFamily:
                                          "'Caveat', 'Patrick Hand', cursive",
                                      }}
                                    />
                                  ) : (
                                    <span
                                      onClick={() => startEditing(item)}
                                      className="flex-1 text-white text-lg sm:text-xl font-handwriting leading-relaxed ml-2 py-1 cursor-text hover:bg-white/5 rounded px-1 -mx-1 transition-colors break-words"
                                      style={{
                                        fontFamily:
                                          "'Caveat', 'Patrick Hand', cursive",
                                      }}
                                    >
                                      {highlightText(item.content)}
                                    </span>
                                  )}

                                  <button
                                    onClick={(e) => handleDelete(item.id, e)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-all ml-2"
                                    title="Delete note"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </NotebookLine>
                            ))}
                            <div className="h-4" />
                          </>
                        )}

                        {/* Unchecked notes */}
                        {uncheckedItems.map((item) => (
                          <NotebookLine key={item.id}>
                            <div className="flex items-center w-full group px-3">
                              <button
                                onClick={() => toggleCheck(item.id)}
                                className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
                                  themeClasses.border,
                                  themeClasses.borderHover,
                                  themeClasses.bgHover
                                )}
                              />

                              <button
                                onClick={() => togglePin(item.id)}
                                className={cn(
                                  "ml-2 p-1 opacity-0 group-hover:opacity-100 rounded transition-all",
                                  themeClasses.textMuted,
                                  themeClasses.textHover,
                                  themeClasses.bgHover
                                )}
                                title="Pin note"
                              >
                                <Pin className="w-4 h-4" />
                              </button>

                              {editingId === item.id ? (
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  defaultValue={editingContent}
                                  onChange={(e) => {
                                    editDraftRef.current = e.target.value;
                                  }}
                                  onKeyDown={handleEditKeyPress}
                                  onBlur={saveEdit}
                                  className="flex-1 bg-transparent border-none text-white focus:outline-none text-lg sm:text-xl font-handwriting leading-relaxed ml-2 py-1"
                                  style={{
                                    fontFamily:
                                      "'Caveat', 'Patrick Hand', cursive",
                                  }}
                                />
                              ) : (
                                <span
                                  onClick={() => startEditing(item)}
                                  className="flex-1 text-white text-lg sm:text-xl font-handwriting leading-relaxed ml-2 py-1 cursor-text hover:bg-white/5 rounded px-1 -mx-1 transition-colors break-words"
                                  style={{
                                    fontFamily:
                                      "'Caveat', 'Patrick Hand', cursive",
                                  }}
                                >
                                  {highlightText(item.content)}
                                </span>
                              )}

                              <button
                                onClick={(e) => handleDelete(item.id, e)}
                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-all ml-2"
                                title="Delete note"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </NotebookLine>
                        ))}

                        {/* Checked notes - with strikethrough */}
                        {checkedItemsList.length > 0 && (
                          <>
                            <div className="flex items-center justify-between py-4 mt-4 border-t border-amber-200/10 px-4">
                              <span
                                className="text-base text-white/40 font-handwriting"
                                style={{
                                  fontFamily:
                                    "'Caveat', 'Patrick Hand', cursive",
                                }}
                              >
                                Completed ({checkedItemsList.length})
                              </span>
                              <button
                                onClick={handleClearChecked}
                                disabled={isClearing}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                  isClearing
                                    ? "bg-white/5 text-white/30 cursor-not-allowed"
                                    : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                                )}
                              >
                                <Archive className="w-3.5 h-3.5" />
                                {isClearing ? "Clearing..." : "Clear done"}
                              </button>
                            </div>

                            {checkedItemsList.map((item) => (
                              <NotebookLine key={item.id}>
                                <div className="flex items-center w-full group opacity-50 px-3">
                                  <button
                                    onClick={() => toggleCheck(item.id)}
                                    className="w-5 h-5 rounded border-2 border-emerald-400/50 bg-emerald-400/20 flex items-center justify-center transition-all flex-shrink-0"
                                  >
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  </button>
                                  <div className="w-6 ml-2" />

                                  {editingId === item.id ? (
                                    <input
                                      ref={editInputRef}
                                      type="text"
                                      defaultValue={editingContent}
                                      onChange={(e) => {
                                        editDraftRef.current = e.target.value;
                                      }}
                                      onKeyDown={handleEditKeyPress}
                                      onBlur={saveEdit}
                                      className="flex-1 bg-transparent border-none text-white/60 focus:outline-none text-lg sm:text-xl font-handwriting leading-relaxed ml-2 py-1"
                                      style={{
                                        fontFamily:
                                          "'Caveat', 'Patrick Hand', cursive",
                                      }}
                                    />
                                  ) : (
                                    <span
                                      onClick={() => startEditing(item)}
                                      className="flex-1 text-white/60 text-lg sm:text-xl font-handwriting leading-relaxed line-through decoration-white/40 decoration-2 ml-2 py-1 cursor-text hover:bg-white/5 rounded px-1 -mx-1 transition-colors break-words"
                                      style={{
                                        fontFamily:
                                          "'Caveat', 'Patrick Hand', cursive",
                                      }}
                                    >
                                      {highlightText(item.content)}
                                    </span>
                                  )}

                                  <button
                                    onClick={(e) => handleDelete(item.id, e)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-all ml-2"
                                    title="Delete note"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </NotebookLine>
                            ))}
                          </>
                        )}
                      </>
                    )}

                    {/* Inline input is ALWAYS the last line (doesn't swap branches) */}
                    {isInteractive && (
                      <>
                        <NotebookLine>
                          <div className="flex items-center w-full px-3">
                            <div className="w-5 h-5 flex-shrink-0" />
                            <div className="w-6 ml-2 flex-shrink-0" />
                            <StableNoteInput
                              inputRef={noteInputRef}
                              onSubmit={handleSubmitNote}
                              onTyping={handleNoteTyping}
                              onFocused={handleNoteFocused}
                              onBlurred={handleNoteBlurred}
                            />
                          </div>
                        </NotebookLine>
                        <div ref={pageEndRef} />
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    },
    [
      editInputRef,
      editingContent,
      editingId,
      getListsForTopic,
      handleClearChecked,
      handleDelete,
      handleEditKeyPress,
      handleSubmitNote,
      highlightText,
      isClearing,
      isLoading,
      noteInputRef,
      saveEdit,
      startEditing,
      toggleCheck,
      togglePin,
      themeClasses,
    ]
  );

  return (
    <div className="flex h-full w-full relative overflow-hidden">
      {/* Book Index Sidebar - Slides in from left like a book's table of contents */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Index page backdrop with futuristic engraving texture */}
        <div
          className="absolute inset-0 book-index-sidebar shadow-2xl border-r"
          style={{
            borderColor: themeClasses.text.includes("pink")
              ? "rgba(236, 72, 153, 0.15)"
              : "rgba(6, 182, 212, 0.15)",
            boxShadow: `
              inset -20px 0 30px rgba(0, 0, 0, 0.4),
              8px 0 30px rgba(0, 0, 0, 0.6),
              0 0 60px ${themeClasses.text.includes("pink") ? "rgba(236, 72, 153, 0.12)" : "rgba(6, 182, 212, 0.12)"}
            `,
          }}
        />

        {/* Index page content */}
        <div className="relative flex flex-col h-full p-5">
          {/* Index Title - Futuristic engraved header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex-1">
              <h2 className="book-index-title text-2xl">✦ Index ✦</h2>
              <p
                className="text-xs mt-1 font-handwriting tracking-wide"
                style={{
                  fontFamily: "'Caveat', 'Patrick Hand', cursive",
                  color: themeClasses.text.includes("pink")
                    ? "rgba(251, 191, 36, 0.6)"
                    : "rgba(6, 182, 212, 0.6)",
                }}
              >
                Table of Contents
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-all"
              style={{
                color: themeClasses.text.includes("pink")
                  ? "rgba(251, 191, 36, 0.6)"
                  : "rgba(6, 182, 212, 0.6)",
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* All Notes - First index entry */}
          <button
            onClick={() => handleTopicSwitch(null)}
            className={cn(
              "book-index-entry flex items-center py-3 transition-all text-left group",
              activeTopic === null && "active"
            )}
          >
            <span className="text-base mr-2">📒</span>
            <span
              className="font-handwriting text-lg"
              style={{ fontFamily: "'Caveat', 'Patrick Hand', cursive" }}
            >
              All Notes
            </span>
            <span className="book-index-leader" />
            <span className="book-index-page-num" style={{ color: "#8b7355" }}>
              1
            </span>
          </button>

          {/* Decorative chapter divider */}
          <div className="flex items-center gap-2 my-4">
            <div
              className="flex-1 h-px"
              style={{
                background: themeClasses.text.includes("pink")
                  ? "linear-gradient(to right, transparent, rgba(236, 72, 153, 0.3), transparent)"
                  : "linear-gradient(to right, transparent, rgba(6, 182, 212, 0.3), transparent)",
              }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{
                color: themeClasses.text.includes("pink")
                  ? "rgba(251, 191, 36, 0.5)"
                  : "rgba(6, 182, 212, 0.5)",
              }}
            >
              Chapters
            </span>
            <div
              className="flex-1 h-px"
              style={{
                background: themeClasses.text.includes("pink")
                  ? "linear-gradient(to right, transparent, rgba(236, 72, 153, 0.3), transparent)"
                  : "linear-gradient(to right, transparent, rgba(6, 182, 212, 0.3), transparent)",
              }}
            />
          </div>

          {/* Topics List - Index entries */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-hide">
            {isLoadingTopics ? (
              <div className="flex items-center justify-center py-8">
                <div
                  className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: themeClasses.text.includes("pink")
                      ? "rgba(236, 72, 153, 0.2)"
                      : "rgba(6, 182, 212, 0.2)",
                    borderTopColor: themeClasses.text.includes("pink")
                      ? "#ec4899"
                      : "#06b6d4",
                  }}
                />
              </div>
            ) : topics.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-3xl mb-2 block">📖</span>
                <p
                  className="text-base font-handwriting"
                  style={{
                    fontFamily: "'Caveat', 'Patrick Hand', cursive",
                    color: themeClasses.text.includes("pink")
                      ? "rgba(251, 191, 36, 0.6)"
                      : "rgba(6, 182, 212, 0.6)",
                  }}
                >
                  No chapters yet
                </p>
                <p
                  className="text-sm font-handwriting mt-1"
                  style={{
                    fontFamily: "'Caveat', 'Patrick Hand', cursive",
                    color: themeClasses.text.includes("pink")
                      ? "rgba(236, 72, 153, 0.4)"
                      : "rgba(6, 182, 212, 0.4)",
                  }}
                >
                  Add one below
                </p>
              </div>
            ) : (
              topics.map((topic, index) => (
                <button
                  key={topic.id}
                  onClick={() => handleTopicSwitch(topic.id)}
                  className={cn(
                    "book-index-entry flex items-center py-2.5 transition-all text-left w-full group",
                    activeTopic === topic.id && "active"
                  )}
                >
                  <span className="text-base mr-2">{topic.icon}</span>
                  <span
                    className="font-handwriting text-lg truncate"
                    style={{ fontFamily: "'Caveat', 'Patrick Hand', cursive" }}
                  >
                    {topic.title}
                  </span>
                  <span className="book-index-leader" />
                  <span
                    className="book-index-page-num"
                    style={{
                      color: themeClasses.text.includes("pink")
                        ? "rgba(251, 191, 36, 0.5)"
                        : "rgba(6, 182, 212, 0.5)",
                    }}
                  >
                    {index + 2}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Add New Chapter - Styled like futuristic engraving */}
          <div
            className="mt-4 pt-4"
            style={{
              borderTop: themeClasses.text.includes("pink")
                ? "1px solid rgba(236, 72, 153, 0.15)"
                : "1px solid rgba(6, 182, 212, 0.15)",
            }}
          >
            <p
              className="text-xs mb-2 font-handwriting"
              style={{
                fontFamily: "'Caveat', 'Patrick Hand', cursive",
                color: themeClasses.text.includes("pink")
                  ? "rgba(251, 191, 36, 0.6)"
                  : "rgba(6, 182, 212, 0.6)",
              }}
            >
              ✎ Add new chapter...
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTopic()}
                placeholder="Chapter title..."
                className="flex-1 rounded-lg px-3 py-2.5 text-base font-handwriting focus:outline-none transition-colors"
                style={{
                  fontFamily: "'Caveat', 'Patrick Hand', cursive",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: themeClasses.text.includes("pink")
                    ? "1px solid rgba(236, 72, 153, 0.2)"
                    : "1px solid rgba(6, 182, 212, 0.2)",
                  color: themeClasses.text.includes("pink")
                    ? "rgba(251, 191, 36, 0.9)"
                    : "rgba(6, 182, 212, 0.9)",
                }}
              />
              <button
                onClick={createTopic}
                disabled={isCreatingTopic || !newTopicTitle.trim()}
                className="px-3 py-2 rounded-lg transition-all font-handwriting text-sm"
                style={{
                  fontFamily: "'Caveat', 'Patrick Hand', cursive",
                  background: newTopicTitle.trim()
                    ? themeClasses.text.includes("pink")
                      ? "rgba(236, 72, 153, 0.2)"
                      : "rgba(6, 182, 212, 0.2)"
                    : "rgba(0, 0, 0, 0.3)",
                  color: newTopicTitle.trim()
                    ? themeClasses.text.includes("pink")
                      ? "#fbbf24"
                      : "#06b6d4"
                    : themeClasses.text.includes("pink")
                      ? "rgba(236, 72, 153, 0.4)"
                      : "rgba(6, 182, 212, 0.4)",
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar overlay - click to close */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main notebook area */}
      <div className="flex flex-col flex-1 h-full relative z-10">
        {/* Topic Navigation Bar */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 bg-slate-900/80 border-b",
            themeClasses.border
          )}
        >
          {/* Menu button to open sidebar */}
          <button
            onClick={() => setSidebarOpen(true)}
            className={cn(
              "p-2 rounded-lg hover:bg-white/10 text-white/70 transition-all",
              themeClasses.textHover
            )}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Current topic indicator */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">
              {activeTopic
                ? topics.find((t) => t.id === activeTopic)?.icon || "📄"
                : "📒"}
            </span>
            <span
              className="font-handwriting text-lg text-white truncate"
              style={{ fontFamily: "'Caveat', 'Patrick Hand', cursive" }}
            >
              {activeTopic
                ? topics.find((t) => t.id === activeTopic)?.title ||
                  "Loading..."
                : "All Notes"}
            </span>
          </div>

          {/* Page navigation arrows */}
          {topics.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => triggerFlip("prev")}
                disabled={currentPageIndex <= 0}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => triggerFlip("next")}
                disabled={currentPageIndex >= topics.length}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Jaw-dropping realistic page flip (react-pageflip / StPageFlip) */}
        <div className="flex-1 min-h-0 w-full notebook-flipbook-container relative">
          <HTMLFlipBook
            ref={flipBookRef}
            className="w-full h-full notebook-flipbook"
            style={{ width: "100%", height: "100%" }}
            startPage={0}
            startZIndex={20}
            width={360}
            height={640}
            size="stretch"
            minWidth={320}
            maxWidth={1400}
            minHeight={420}
            maxHeight={2400}
            autoSize={true}
            showCover={false}
            usePortrait={true}
            drawShadow={true}
            // Max shadow helps the page feel "solid" rather than see-through.
            maxShadowOpacity={1}
            // Slightly slower feels heavier/more paper-like.
            flippingTime={650}
            // Shorter swipe distance makes the gesture feel decisive.
            swipeDistance={10}
            mobileScrollSupport={true}
            clickEventForward={true}
            // Disable built-in mouse/touch flipping so inputs can receive events.
            // We re-enable swipe via edge gutters that trigger flipNext/flipPrev.
            useMouseEvents={false}
            showPageCorners={true}
            disableFlipByClick={true}
            onFlip={handleFlip}
            onChangeState={handleChangeState}
          >
            <FlipBookPage isInteractive={currentPageIndex === 0}>
              {renderTopicPage(null, currentPageIndex === 0)}
            </FlipBookPage>
            {topics.map((topic, idx) => (
              <FlipBookPage
                key={topic.id}
                isInteractive={currentPageIndex === idx + 1}
              >
                {renderTopicPage(topic.id, currentPageIndex === idx + 1)}
              </FlipBookPage>
            ))}
          </HTMLFlipBook>

          {/* Swipe gutters: swipe on edges to flip pages (animation preserved) */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute inset-y-0 left-0 w-10 pointer-events-auto"
              style={{ touchAction: "pan-y" }}
              onPointerDown={onGutterPointerDown("prev")}
              onPointerMove={onGutterPointerMove}
              onPointerUp={onGutterPointerUpOrCancel}
              onPointerCancel={onGutterPointerUpOrCancel}
            />
            <div
              className="absolute inset-y-0 right-0 w-10 pointer-events-auto"
              style={{ touchAction: "pan-y" }}
              onPointerDown={onGutterPointerDown("next")}
              onPointerMove={onGutterPointerMove}
              onPointerUp={onGutterPointerUpOrCancel}
              onPointerCancel={onGutterPointerUpOrCancel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

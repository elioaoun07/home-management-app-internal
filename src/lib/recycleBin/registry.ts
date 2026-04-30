// src/lib/recycleBin/registry.ts
//
// Central registry for the Recycle Bin. To add a new module, append one entry.
// Everything else (API, UI, search, filters, cron purge) is driven from here.

import type { RecycleBinModule, RecycleBinRow } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtDate = (v: unknown): string => {
  if (!v || typeof v !== "string") return "";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return v;
  }
};

const fmtAmount = (v: unknown): string => {
  if (v == null) return "";
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// ---------------------------------------------------------------------------
// Module entries
// ---------------------------------------------------------------------------

const transactionsModule: RecycleBinModule = {
  id: "transactions",
  label: "Transactions",
  icon: "DollarSign",
  table: "transactions",
  deletedAtColumn: "deleted_at",
  scope: "user",
  selectColumns:
    "id,user_id,date,amount,description,account_id,category_id,subcategory_id,is_draft,is_private,deleted_at",
  searchColumns: ["description"],
  filterFields: [
    { key: "date", label: "Date", kind: "dateRange", column: "date" },
    { key: "amount", label: "Amount", kind: "numericRange", column: "amount" },
  ],
  baseFilter: (q) => q.eq("is_draft", false),
  formatRow: (row): RecycleBinRow => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      title: (r.description as string) || "Transaction",
      subtitle: fmtDate(r.date),
      meta: fmtAmount(r.amount),
      deletedAt: String(r.deleted_at ?? ""),
      raw: r,
    };
  },
  invalidateKeys: [
    ["transactions"],
    ["account-balance"],
    ["analytics"],
    ["dashboard-transactions"],
  ],
};

const draftsModule: RecycleBinModule = {
  id: "drafts",
  label: "Drafts",
  icon: "FileText",
  table: "transactions",
  deletedAtColumn: "deleted_at",
  scope: "user",
  selectColumns:
    "id,user_id,date,amount,description,account_id,category_id,is_draft,deleted_at",
  searchColumns: ["description"],
  filterFields: [
    { key: "date", label: "Date", kind: "dateRange", column: "date" },
    { key: "amount", label: "Amount", kind: "numericRange", column: "amount" },
  ],
  baseFilter: (q) => q.eq("is_draft", true),
  formatRow: (row): RecycleBinRow => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      title: (r.description as string) || "Draft",
      subtitle: fmtDate(r.date),
      meta: fmtAmount(r.amount),
      deletedAt: String(r.deleted_at ?? ""),
      raw: r,
    };
  },
  invalidateKeys: [["drafts"], ["transactions"]],
};

const transfersModule: RecycleBinModule = {
  id: "transfers",
  label: "Transfers",
  icon: "ArrowLeftRight",
  table: "transfers",
  deletedAtColumn: "deleted_at",
  scope: "user",
  selectColumns:
    "id,user_id,from_account_id,to_account_id,amount,description,date,transfer_type,fee_amount,returned_amount,deleted_at",
  searchColumns: ["description"],
  filterFields: [
    { key: "date", label: "Date", kind: "dateRange", column: "date" },
    { key: "amount", label: "Amount", kind: "numericRange", column: "amount" },
    {
      key: "transfer_type",
      label: "Type",
      kind: "enum",
      column: "transfer_type",
      options: [
        { value: "self", label: "Self" },
        { value: "household", label: "Household" },
      ],
    },
  ],
  formatRow: (row): RecycleBinRow => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      title: (r.description as string) || "Transfer",
      subtitle: fmtDate(r.date),
      meta: fmtAmount(r.amount),
      deletedAt: String(r.deleted_at ?? ""),
      raw: r,
    };
  },
  invalidateKeys: [["transfers"], ["account-balance"]],
};

const itemsModule: RecycleBinModule = {
  id: "items",
  label: "Items",
  icon: "ListTodo",
  table: "items",
  deletedAtColumn: "deleted_at",
  scope: "user",
  selectColumns:
    "id,user_id,type,title,description,priority,status,categories,created_at,deleted_at",
  searchColumns: ["title", "description"],
  filterFields: [
    {
      key: "type",
      label: "Type",
      kind: "enum",
      column: "type",
      options: [
        { value: "reminder", label: "Reminder" },
        { value: "task", label: "Task" },
        { value: "event", label: "Event" },
      ],
    },
    {
      key: "priority",
      label: "Priority",
      kind: "enum",
      column: "priority",
      options: [
        { value: "low", label: "Low" },
        { value: "normal", label: "Normal" },
        { value: "high", label: "High" },
      ],
    },
    {
      key: "created_at",
      label: "Created",
      kind: "dateRange",
      column: "created_at",
    },
  ],
  formatRow: (row): RecycleBinRow => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      title: (r.title as string) || "Untitled",
      subtitle: (r.type as string) ?? "",
      meta: (r.priority as string) ?? "",
      deletedAt: String(r.deleted_at ?? ""),
      raw: r,
    };
  },
  invalidateKeys: [["items"]],
};

const recipesModule: RecycleBinModule = {
  id: "recipes",
  label: "Recipes",
  icon: "ChefHat",
  table: "recipes",
  deletedAtColumn: "deleted_at",
  scope: "user",
  selectColumns:
    "id,user_id,name,description,category,cuisine,difficulty,tags,ingredients,deleted_at",
  searchColumns: ["name", "description", "category", "cuisine"],
  filterFields: [
    {
      key: "difficulty",
      label: "Difficulty",
      kind: "enum",
      column: "difficulty",
      options: [
        { value: "easy", label: "Easy" },
        { value: "medium", label: "Medium" },
        { value: "hard", label: "Hard" },
      ],
    },
    { key: "category", label: "Category", kind: "text", column: "category" },
  ],
  formatRow: (row): RecycleBinRow => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      title: (r.name as string) || "Recipe",
      subtitle:
        [r.category, r.cuisine].filter(Boolean).join(" · ") || undefined,
      meta: (r.difficulty as string) ?? "",
      deletedAt: String(r.deleted_at ?? ""),
      raw: r,
    };
  },
  invalidateKeys: [["recipes"]],
};

const catalogueModule: RecycleBinModule = {
  id: "catalogue",
  label: "Catalogue",
  icon: "Boxes",
  table: "catalogue_items",
  deletedAtColumn: "deleted_at",
  scope: "user",
  selectColumns:
    "id,user_id,module_id,category_id,name,description,notes,status,priority,tags,deleted_at",
  searchColumns: ["name", "description", "notes"],
  filterFields: [
    {
      key: "priority",
      label: "Priority",
      kind: "enum",
      column: "priority",
      options: [
        { value: "low", label: "Low" },
        { value: "normal", label: "Normal" },
        { value: "high", label: "High" },
      ],
    },
  ],
  formatRow: (row): RecycleBinRow => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      title: (r.name as string) || "Catalogue item",
      subtitle: (r.description as string) || undefined,
      meta: (r.priority as string) ?? "",
      deletedAt: String(r.deleted_at ?? ""),
      raw: r,
    };
  },
  invalidateKeys: [["catalogue"]],
};

const futurePurchasesModule: RecycleBinModule = {
  id: "future-purchases",
  label: "Future Purchases",
  icon: "ShoppingBag",
  table: "future_purchases",
  deletedAtColumn: "deleted_at",
  scope: "user",
  selectColumns:
    "id,user_id,name,description,target_amount,current_saved,urgency,target_date,status,deleted_at",
  searchColumns: ["name", "description"],
  filterFields: [
    {
      key: "status",
      label: "Status",
      kind: "enum",
      column: "status",
      options: [
        { value: "active", label: "Active" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
        { value: "paused", label: "Paused" },
      ],
    },
    {
      key: "target_date",
      label: "Target date",
      kind: "dateRange",
      column: "target_date",
    },
  ],
  formatRow: (row): RecycleBinRow => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      title: (r.name as string) || "Future purchase",
      subtitle: (r.description as string) || undefined,
      meta: fmtAmount(r.target_amount),
      deletedAt: String(r.deleted_at ?? ""),
      raw: r,
    };
  },
  invalidateKeys: [["future-purchases"]],
};

const hubThreadsModule: RecycleBinModule = {
  id: "hub-threads",
  label: "Chat Threads",
  icon: "MessageSquare",
  table: "hub_chat_threads",
  deletedAtColumn: "deleted_at",
  scope: "household",
  selectColumns:
    "id,household_id,created_by,title,description,purpose,deleted_at",
  searchColumns: ["title", "description"],
  filterFields: [
    {
      key: "purpose",
      label: "Purpose",
      kind: "enum",
      column: "purpose",
      options: [
        { value: "general", label: "General" },
        { value: "budget", label: "Budget" },
        { value: "shopping", label: "Shopping" },
        { value: "reminder", label: "Reminder" },
        { value: "travel", label: "Travel" },
        { value: "health", label: "Health" },
        { value: "notes", label: "Notes" },
        { value: "other", label: "Other" },
      ],
    },
  ],
  formatRow: (row): RecycleBinRow => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      title: (r.title as string) || "Thread",
      subtitle: (r.description as string) || undefined,
      meta: (r.purpose as string) ?? "",
      deletedAt: String(r.deleted_at ?? ""),
      raw: r,
    };
  },
  invalidateKeys: [["hub-threads"]],
};

const hubMessagesModule: RecycleBinModule = {
  id: "hub-messages",
  label: "Chat Messages",
  icon: "MessageCircle",
  table: "hub_messages",
  deletedAtColumn: "deleted_at",
  scope: "household",
  selectColumns:
    "id,household_id,sender_user_id,thread_id,message_type,content,created_at,deleted_at",
  searchColumns: ["content"],
  filterFields: [
    {
      key: "created_at",
      label: "Sent",
      kind: "dateRange",
      column: "created_at",
    },
  ],
  formatRow: (row): RecycleBinRow => {
    const r = row as Record<string, unknown>;
    const content = (r.content as string) || "";
    return {
      id: String(r.id),
      title: content.length > 80 ? `${content.slice(0, 80)}…` : content,
      subtitle: (r.message_type as string) || "text",
      meta: fmtDate(r.created_at),
      deletedAt: String(r.deleted_at ?? ""),
      raw: r,
    };
  },
  invalidateKeys: [["hub-messages"]],
};

// ---------------------------------------------------------------------------
// Public registry
// ---------------------------------------------------------------------------

export const RECYCLE_BIN_MODULES: RecycleBinModule[] = [
  transactionsModule,
  transfersModule,
  itemsModule,
  catalogueModule,
  recipesModule,
  hubThreadsModule,
  hubMessagesModule,
  futurePurchasesModule,
  draftsModule,
];

export function getRecycleBinModule(id: string): RecycleBinModule | undefined {
  return RECYCLE_BIN_MODULES.find((m) => m.id === id);
}

/** Public-facing summary of modules (for client UI). */
export const RECYCLE_BIN_MODULE_SUMMARIES = RECYCLE_BIN_MODULES.map((m) => ({
  id: m.id,
  label: m.label,
  icon: m.icon,
  filterFields: m.filterFields,
}));

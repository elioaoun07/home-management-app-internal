export const tripKeys = {
  all: ["trips"] as const,

  lists: () => [...tripKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...tripKeys.lists(), filters ?? {}] as const,

  detail: (id: string) => [...tripKeys.all, "detail", id] as const,

  places: (tripId: string) => [...tripKeys.all, "places", tripId] as const,
  packing: (tripId: string) => [...tripKeys.all, "packing", tripId] as const,
  packingDeleted: (tripId: string) => [...tripKeys.all, "packing-deleted", tripId] as const,
  packingCheckpoint: (tripId: string) => [...tripKeys.all, "packing-checkpoint", tripId] as const,
  packingCategories: (tripId: string) => [...tripKeys.all, "packing-categories", tripId] as const,
  documents: (tripId: string) => [...tripKeys.all, "documents", tripId] as const,
  documentUrls: (paths: string[]) => [...tripKeys.all, "document-urls", paths] as const,

  templates: () => [...tripKeys.all, "templates"] as const,
};

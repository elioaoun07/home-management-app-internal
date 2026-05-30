export const tripKeys = {
  all: ["trips"] as const,

  lists: () => [...tripKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...tripKeys.lists(), filters ?? {}] as const,

  detail: (id: string) => [...tripKeys.all, "detail", id] as const,

  places: (tripId: string) => [...tripKeys.all, "places", tripId] as const,
  packing: (tripId: string) => [...tripKeys.all, "packing", tripId] as const,

  templates: () => [...tripKeys.all, "templates"] as const,
};

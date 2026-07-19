// src/features/outfits/queryKeys.ts
export const outfitKeys = {
  all: ["outfits"] as const,

  items: () => [...outfitKeys.all, "items"] as const,
  itemList: (filters?: Record<string, unknown>) =>
    [...outfitKeys.items(), filters ?? {}] as const,

  outfits: () => [...outfitKeys.all, "list"] as const,

  profile: () => [...outfitKeys.all, "profile"] as const,

  signedUrls: (paths: string[]) =>
    [...outfitKeys.all, "signed-urls", paths] as const,
};

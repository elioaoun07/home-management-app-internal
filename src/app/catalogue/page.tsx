"use client";

import WebCatalogue from "@/components/web/WebCatalogue";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CatalogueContent({ stickyTopClass }: { stickyTopClass: string }) {
  const params = useSearchParams();
  const section = params.get("section");
  return (
    <WebCatalogue
      initialSection={section === "chores" ? "chores" : undefined}
      initialItemId={params.get("item") ?? undefined}
      stickyTopClass={stickyTopClass}
    />
  );
}

export default function CataloguePage() {
  // The fixed standalone header (h-16) only renders in the mobile layout.
  const { viewMode } = useViewMode();
  const underHeader = viewMode === "mobile";
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div
        className={cn("container mx-auto px-4 pb-24", underHeader ? "pt-16" : "py-6")}
      >
        <Suspense>
          <CatalogueContent stickyTopClass={underHeader ? "top-16" : "top-0"} />
        </Suspense>
      </div>
    </main>
  );
}

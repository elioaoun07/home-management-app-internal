"use client";

import WebCatalogue from "@/components/web/WebCatalogue";

export default function CataloguePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div className="container mx-auto px-4 py-6 pb-24">
        <WebCatalogue />
      </div>
    </main>
  );
}

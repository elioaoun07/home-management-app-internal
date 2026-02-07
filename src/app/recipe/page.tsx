"use client";

import WebRecipes from "@/components/web/WebRecipes";

export default function RecipePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div className="container mx-auto px-4 py-6 pb-24">
        <WebRecipes />
      </div>
    </main>
  );
}

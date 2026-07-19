// src/app/outfits/page.tsx
// Thin route wrapper — pages are thin; real UI lives in components/.
import OutfitsPage from "@/components/outfits/OutfitsPage";

export default function OutfitsRoute() {
  return <OutfitsPage />;
}

"use client";

// Re-exports the DeceptionBox scene for standalone testing at /temp
import DeceptionBoxScene from "@/components/guest/DeceptionBoxScene";

export default function TempPage() {
  return (
    <DeceptionBoxScene
      onBeginInvestigation={() => alert("Navigate to portal")}
    />
  );
}

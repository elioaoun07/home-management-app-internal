"use client";

import FitnessPage from "@/components/fitness/FitnessPage";
import { Suspense } from "react";

export default function FitnessClient() {
  return (
    <Suspense fallback={null}>
      <FitnessPage />
    </Suspense>
  );
}

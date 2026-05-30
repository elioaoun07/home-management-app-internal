"use client";

import { TripDetail } from "@/components/trips/TripDetail";
import { use } from "react";

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TripDetail tripId={id} />;
}

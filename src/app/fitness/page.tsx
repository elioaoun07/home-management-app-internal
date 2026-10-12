// src/app/fitness/page.tsx
// Thin route wrapper — Hard Rule: pages are thin; real UI lives in components/.
import FitnessClient from "./FitnessClient";

export default function FitnessPage() {
  return <FitnessClient />;
}

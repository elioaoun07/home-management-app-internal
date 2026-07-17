// src/app/healthcare/page.tsx
// Thin route wrapper — Hard Rule: pages are thin; real UI lives in components/.
import HealthcareClient from "./HealthcareClient";

export default function HealthcarePage() {
  return <HealthcareClient />;
}

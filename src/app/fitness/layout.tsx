import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fitness • Home Manager",
  description: "Imported PT plans, workout logging, recovery and progress",
};

export default function FitnessLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

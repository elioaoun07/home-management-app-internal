import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outfits • Home Manager",
  description:
    "Wardrobe catalog, paper-doll outfit builder, weekly outfit planner and wear log",
};

export default function OutfitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

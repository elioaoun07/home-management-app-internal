import {
  BillIcon,
  CoffeeIcon,
  DollarSignIcon,
  EducationIcon,
  EntertainmentIcon,
  FoodIcon,
  GiftIcon,
  HealthIcon,
  HomeIcon,
  IncomeIcon,
  ShoppingBagIcon,
  TransportIcon,
} from "@/components/icons/FuturisticIcons";
import React from "react";

export type IconComponent = React.FC<{ className?: string; size?: number }>;

/**
 * Maps category names/slugs to their corresponding futuristic SVG icons
 */
export function getCategoryIcon(
  categoryName?: string,
  categorySlug?: string
): IconComponent {
  const name = (categoryName || "").toLowerCase();
  const slug = (categorySlug || "").toLowerCase();

  // Income categories
  if (
    name.includes("income") ||
    slug.includes("income") ||
    name.includes("salary") ||
    name.includes("bonus") ||
    name.includes("freelance") ||
    name.includes("investment")
  ) {
    return IncomeIcon;
  }

  // Food & Dining
  if (
    name.includes("food") ||
    slug.includes("food") ||
    name.includes("dining") ||
    slug.includes("dining") ||
    name.includes("restaurant") ||
    slug.includes("restaurant")
  ) {
    return FoodIcon;
  }

  // Coffee specific
  if (
    name.includes("coffee") ||
    slug.includes("coffee") ||
    name.includes("café") ||
    name.includes("cafe")
  ) {
    return CoffeeIcon;
  }

  // Transport
  if (
    name.includes("transport") ||
    slug.includes("transport") ||
    name.includes("taxi") ||
    name.includes("fuel") ||
    name.includes("parking") ||
    name.includes("bus") ||
    name.includes("transit") ||
    slug.includes("taxi") ||
    slug.includes("fuel") ||
    slug.includes("parking")
  ) {
    return TransportIcon;
  }

  // Shopping & Retail
  if (
    name.includes("shopping") ||
    slug.includes("shopping") ||
    name.includes("groceries") ||
    slug.includes("groceries") ||
    name.includes("clothes") ||
    name.includes("electronics")
  ) {
    return ShoppingBagIcon;
  }

  // Bills & Utilities
  if (
    name.includes("bill") ||
    slug.includes("bill") ||
    name.includes("utilities") ||
    slug.includes("utilities") ||
    name.includes("electric") ||
    name.includes("water") ||
    name.includes("internet") ||
    name.includes("phone") ||
    slug.includes("electric") ||
    slug.includes("water")
  ) {
    return BillIcon;
  }

  // Home & Housing
  if (
    name.includes("home") ||
    slug.includes("home") ||
    name.includes("rent") ||
    name.includes("mortgage") ||
    name.includes("housing") ||
    slug.includes("housing")
  ) {
    return HomeIcon;
  }

  // Health & Medical
  if (
    name.includes("health") ||
    slug.includes("health") ||
    name.includes("medical") ||
    name.includes("pharmacy") ||
    name.includes("doctor") ||
    name.includes("hospital")
  ) {
    return HealthIcon;
  }

  // Entertainment
  if (
    name.includes("entertainment") ||
    slug.includes("entertainment") ||
    name.includes("movie") ||
    name.includes("gaming") ||
    name.includes("subscription") ||
    slug.includes("subscription")
  ) {
    return EntertainmentIcon;
  }

  // Education
  if (
    name.includes("education") ||
    slug.includes("education") ||
    name.includes("school") ||
    name.includes("course") ||
    name.includes("learning") ||
    name.includes("training")
  ) {
    return EducationIcon;
  }

  // Gifts & Donations
  if (
    name.includes("gift") ||
    slug.includes("gift") ||
    name.includes("donation") ||
    slug.includes("donation") ||
    name.includes("charity")
  ) {
    return GiftIcon;
  }

  // Default fallback
  return DollarSignIcon;
}

/**
 * Gets the appropriate glow color class for a category
 */
export function getCategoryGlowClass(categoryColor?: string): string {
  if (!categoryColor) return "drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]";

  // Map common category colors to glow effects
  const colorMap: Record<string, string> = {
    green: "drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]",
    blue: "drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]",
    cyan: "drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]",
    red: "drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]",
    yellow: "drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]",
    orange: "drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]",
    purple: "drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]",
    pink: "drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]",
  };

  const normalizedColor = categoryColor.toLowerCase();
  return (
    colorMap[normalizedColor] || "drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
  );
}

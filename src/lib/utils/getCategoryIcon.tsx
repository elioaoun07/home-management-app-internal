import {
  AIIcon,
  AppliancesIcon,
  BankFeesIcon,
  BillIcon,
  BooksIcon,
  ClothesIcon,
  CloudIcon,
  CodeIcon,
  CoffeeIcon,
  DatesIcon,
  DeliveryIcon,
  DoctorIcon,
  DollarSignIcon,
  DonationsIcon,
  EducationIcon,
  ElectricityIcon,
  ElectronicsIcon,
  EntertainmentIcon,
  FitnessIcon,
  FlightsIcon,
  FoodIcon,
  FuelIcon,
  GamesIcon,
  GeneratorIcon,
  GiftIcon,
  GroceriesIcon,
  HealthIcon,
  HotelsIcon,
  HouseholdIcon,
  IncomeIcon,
  InsuranceIcon,
  InternetIcon,
  LensesIcon,
  MaintenanceIcon,
  MidisIcon,
  MoviesIcon,
  MusicIcon,
  OutingIcon,
  ParkingIcon,
  PharmacyIcon,
  PhoneIcon,
  PoGIcon,
  PublicTransitIcon,
  RentIcon,
  RestaurantIcon,
  ShoppingBagIcon,
  StreamingIcon,
  SubscriptionIcon,
  TaxiIcon,
  TransportIcon,
  TravelIcon,
  TuitionIcon,
  UtilitiesIcon,
  WaterIcon,
} from "@/components/icons/FuturisticIcons";
import React from "react";

export type IconComponent = React.FC<{ className?: string; size?: number }>;

/**
 * Maps category names/slugs to their corresponding futuristic SVG icons
 * Supports both parent categories and subcategories
 */
export function getCategoryIcon(
  categoryName?: string,
  categorySlug?: string
): IconComponent {
  const name = (categoryName || "").toLowerCase();
  const slug = (categorySlug || "").toLowerCase();

  // ============================================
  // SUBCATEGORIES (check first for specificity)
  // ============================================

  // Food subcategories
  if (name.includes("groceries") || slug.includes("groceries")) {
    return GroceriesIcon;
  }
  if (
    name.includes("restaurant") ||
    slug.includes("restaurant") ||
    name.includes("dining")
  ) {
    return RestaurantIcon;
  }
  if (
    name.includes("coffee") ||
    slug.includes("coffee") ||
    name.includes("café") ||
    name.includes("cafe")
  ) {
    return CoffeeIcon;
  }
  if (
    name.includes("midis") ||
    slug.includes("midis") ||
    name.includes("lunch")
  ) {
    return MidisIcon;
  }
  if (
    name.includes("delivery") ||
    slug.includes("delivery") ||
    name.includes("takeout") ||
    name.includes("toters") ||
    name.includes("talabat")
  ) {
    return DeliveryIcon;
  }

  // Transport subcategories
  if (
    name.includes("fuel") ||
    slug.includes("fuel") ||
    name.includes("gas") ||
    name.includes("petrol")
  ) {
    return FuelIcon;
  }
  if (
    name.includes("taxi") ||
    slug.includes("taxi") ||
    name.includes("uber") ||
    name.includes("bolt") ||
    name.includes("careem")
  ) {
    return TaxiIcon;
  }
  if (name.includes("parking") || slug.includes("parking")) {
    return ParkingIcon;
  }
  if (
    name.includes("public") ||
    slug.includes("public") ||
    name.includes("bus") ||
    name.includes("metro") ||
    name.includes("transit")
  ) {
    return PublicTransitIcon;
  }

  // Shopping subcategories
  if (
    name.includes("clothes") ||
    slug.includes("clothes") ||
    name.includes("clothing") ||
    name.includes("fashion")
  ) {
    return ClothesIcon;
  }
  if (
    name.includes("electronics") ||
    slug.includes("electronics") ||
    name.includes("tech") ||
    name.includes("gadget")
  ) {
    return ElectronicsIcon;
  }
  if (
    name.includes("lenses") ||
    slug.includes("lenses") ||
    name.includes("glasses") ||
    name.includes("contacts") ||
    name.includes("eyewear")
  ) {
    return LensesIcon;
  }

  // Bills subcategories
  if (
    name.includes("electricity") ||
    slug.includes("electricity") ||
    name.includes("electric")
  ) {
    return ElectricityIcon;
  }
  if (name.includes("water") || slug.includes("water")) {
    return WaterIcon;
  }
  if (
    name.includes("internet") ||
    slug.includes("internet") ||
    name.includes("wifi")
  ) {
    return InternetIcon;
  }
  if (
    name.includes("phone") ||
    slug.includes("phone") ||
    name.includes("mobile")
  ) {
    return PhoneIcon;
  }
  if (
    name.includes("generator") ||
    slug.includes("generator") ||
    name.includes("moteur")
  ) {
    return GeneratorIcon;
  }
  if (name.includes("utilities") || slug.includes("utilities")) {
    return UtilitiesIcon;
  }
  if (name.includes("insurance") || slug.includes("insurance")) {
    return InsuranceIcon;
  }
  if (
    name.includes("bank fee") ||
    slug.includes("bank-fee") ||
    name.includes("bank charge") ||
    name.includes("bankfee") ||
    name.includes("service charge") ||
    name.includes("account fee")
  ) {
    return BankFeesIcon;
  }

  // Health subcategories
  if (
    name.includes("pharmacy") ||
    slug.includes("pharmacy") ||
    name.includes("medicine") ||
    name.includes("drug")
  ) {
    return PharmacyIcon;
  }
  if (
    name.includes("doctor") ||
    slug.includes("doctor") ||
    name.includes("clinic") ||
    name.includes("hospital")
  ) {
    return DoctorIcon;
  }
  if (
    name.includes("fitness") ||
    slug.includes("fitness") ||
    name.includes("gym") ||
    name.includes("workout")
  ) {
    return FitnessIcon;
  }

  // Entertainment subcategories
  if (
    name.includes("movie") ||
    slug.includes("movie") ||
    name.includes("cinema") ||
    name.includes("film")
  ) {
    return MoviesIcon;
  }
  if (
    name.includes("game") ||
    slug.includes("game") ||
    name.includes("gaming")
  ) {
    return GamesIcon;
  }
  if (
    name.includes("music") ||
    slug.includes("music") ||
    name.includes("spotify") ||
    name.includes("concert")
  ) {
    return MusicIcon;
  }
  if (
    name.includes("outing") ||
    slug.includes("outing") ||
    name.includes("hangout") ||
    name.includes("social")
  ) {
    return OutingIcon;
  }
  if (
    name.includes("dates") ||
    slug.includes("dates") ||
    name.includes("date") ||
    name.includes("romantic")
  ) {
    return DatesIcon;
  }

  // Travel subcategories
  if (
    name.includes("flight") ||
    slug.includes("flight") ||
    name.includes("airline") ||
    name.includes("plane")
  ) {
    return FlightsIcon;
  }
  if (
    name.includes("hotel") ||
    slug.includes("hotel") ||
    name.includes("accommodation") ||
    name.includes("airbnb")
  ) {
    return HotelsIcon;
  }

  // Household subcategories
  if (
    name.includes("rent") ||
    slug.includes("rent") ||
    name.includes("mortgage")
  ) {
    return RentIcon;
  }
  if (
    name.includes("maintenance") ||
    slug.includes("maintenance") ||
    name.includes("repair") ||
    name.includes("fix")
  ) {
    return MaintenanceIcon;
  }
  if (
    name.includes("appliance") ||
    slug.includes("appliance") ||
    name.includes("washer") ||
    name.includes("dryer") ||
    name.includes("refrigerator") ||
    name.includes("dishwasher")
  ) {
    return AppliancesIcon;
  }

  // Community / Religious
  if (
    name.includes("pog") ||
    slug.includes("pog") ||
    name.includes("church") ||
    name.includes("community") ||
    name.includes("religious") ||
    name.includes("tithe")
  ) {
    return PoGIcon;
  }

  // Education subcategories
  if (
    name.includes("tuition") ||
    slug.includes("tuition") ||
    name.includes("school") ||
    name.includes("university")
  ) {
    return TuitionIcon;
  }
  if (
    name.includes("book") ||
    slug.includes("book") ||
    name.includes("course") ||
    name.includes("learning")
  ) {
    return BooksIcon;
  }

  // Gifts & Charity subcategories
  if (
    name.includes("donation") ||
    slug.includes("donation") ||
    name.includes("charity") ||
    name.includes("zakat")
  ) {
    return DonationsIcon;
  }

  // Subscription subcategories
  if (
    name.includes("netflix") ||
    slug.includes("netflix") ||
    name.includes("streaming") ||
    name.includes("disney") ||
    name.includes("hbo")
  ) {
    return StreamingIcon;
  }
  if (
    name.includes("chatgpt") ||
    slug.includes("chatgpt") ||
    name.includes("openai") ||
    name.includes("ai")
  ) {
    return AIIcon;
  }
  if (
    name.includes("github") ||
    slug.includes("github") ||
    name.includes("copilot") ||
    name.includes("code")
  ) {
    return CodeIcon;
  }
  if (
    name.includes("googleone") ||
    slug.includes("googleone") ||
    name.includes("google one") ||
    name.includes("cloud") ||
    name.includes("icloud") ||
    name.includes("storage")
  ) {
    return CloudIcon;
  }

  // ============================================
  // PARENT CATEGORIES
  // ============================================

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

  // Food (parent)
  if (name.includes("food") || slug.includes("food")) {
    return FoodIcon;
  }

  // Transport (parent)
  if (name.includes("transport") || slug.includes("transport")) {
    return TransportIcon;
  }

  // Shopping (parent)
  if (name.includes("shopping") || slug.includes("shopping")) {
    return ShoppingBagIcon;
  }

  // Bills (parent)
  if (name.includes("bill") || slug.includes("bill")) {
    return BillIcon;
  }

  // Subscription (parent)
  if (name.includes("subscription") || slug.includes("subscription")) {
    return SubscriptionIcon;
  }

  // Health (parent)
  if (
    name.includes("health") ||
    slug.includes("health") ||
    name.includes("medical")
  ) {
    return HealthIcon;
  }

  // Entertainment (parent)
  if (name.includes("entertainment") || slug.includes("entertainment")) {
    return EntertainmentIcon;
  }

  // Travel (parent)
  if (
    name.includes("travel") ||
    slug.includes("travel") ||
    name.includes("vacation") ||
    name.includes("trip")
  ) {
    return TravelIcon;
  }

  // Household (parent)
  if (
    name.includes("household") ||
    slug.includes("household") ||
    name.includes("home") ||
    slug.includes("home") ||
    name.includes("housing")
  ) {
    return HouseholdIcon;
  }

  // Education (parent)
  if (
    name.includes("education") ||
    slug.includes("education") ||
    name.includes("training")
  ) {
    return EducationIcon;
  }

  // Gifts & Charity (parent)
  if (name.includes("gift") || slug.includes("gift")) {
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

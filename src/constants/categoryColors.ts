/**
 * Unified Category Color Mapping
 * Single source of truth for business category colors used across:
 * - Map markers
 * - Pie charts
 * - PDF exports
 * - Any future visualizations
 */

export const CATEGORY_COLORS: Record<string, string> = {
  // === Base Categories ===
  food_and_drink: "#f37129", // Ginkgo orange
  shopping: "#0feaa6", // Ginkgo green
  health: "#034744", // Ginkgo dark teal
  education: "#162e54", // Ginkgo navy
  entertainment: "#ec4899", // Pink for better visibility
  transportation: "#06b6d4", // Cyan for better visibility
  finance: "#8b5cf6", // Purple for better visibility
  government: "#9e765f", // Brown
  other: "#6b7280", // Gray for uncategorized
  retail: "#0feaa6", // Map retail to green
  restaurant: "#f37129", // Map restaurant to orange
  service: "#034744", // Map service to dark teal

  // === All Categories from Comprehensive Mapping ===
  beauty_salon: "#e11d48", // Rose
  professional_services: "#3b82f6", // Blue
  tattoo_and_piercing: "#a855f7", // Purple
  community_services_non_profits: "#22c55e", // Green
  landmark_and_historical_building: "#8b5cf6", // Violet
  automotive_repair: "#047857", // Dark green
  coffee_shop: "#78350f", // Dark brown
  counseling_and_mental_health: "#831843", // Dark pink
  gym: "#047857", // Emerald
  art_gallery: "#fb923c", // Light orange
  beauty_and_spa: "#db2777", // Pink
  caterer: "#f97316", // Orange
  bakery: "#ea580c", // Dark orange
  advertising_agency: "#f59e0b", // Amber
  brewery: "#ca8a04", // Amber
  bicycle_shop: "#9333ea", // Violet
  carpet_store: "#7c3aed", // Purple
  chiropractor: "#4338ca", // Indigo
  massage: "#15803d", // Green
  plumbing: "#365314", // Olive
  printing_services: "#6366f1", // Indigo
  real_estate_agent: "#422006", // Dark brown
  thai_restaurant: "#7c2d12", // Rust
  asian_restaurant: "#db2777", // Pink
  bank_credit_union: "#c026d3", // Fuchsia
  distillery: "#1e40af", // Blue
  engineering_services: "#1e3a8a", // Navy
  fashion_accessories_store: "#0c4a6e", // Dark blue
  flowers_and_gifts_shop: "#075985", // Sky blue
  furniture_store: "#0e7490", // Dark cyan
  grocery_store: "#0d9488", // Teal

  // === Additional Common Categories ===
  bar: "#dc2626", // Red
  winery: "#7c2d12", // Brown
  contractor: "#0891b2", // Dark cyan
  electrician: "#0e7490", // Teal
  appliance_repair_service: "#059669", // Emerald
  auto_glass_service: "#10b981", // Green
  hardware_store: "#84cc16", // Lime
  theatre: "#ec4899", // Pink
  topic_concert_venue: "#f43f5e", // Rose
  naturopathic_holistic: "#14b8a6", // Teal
  event_photography: "#f87171", // Light red
  acupuncture: "#c084fc", // Light purple
  arts_and_crafts: "#fbbf24", // Yellow
  bartender: "#a78bfa", // Light violet
  building_supply_store: "#94a3b8", // Slate
  clothing_store: "#93c5fd", // Light blue
  construction_services: "#6ee7b7", // Light green
  fast_food_restaurant: "#fed7aa", // Light orange

  // === More Common Business Types ===
  doctor: "#8b5cf6", // Violet
  spas: "#be123c", // Crimson
  american_restaurant: "#ea580c", // Dark orange
  chinese_restaurant: "#dc2626", // Red
  sushi_restaurant: "#0891b2", // Cyan
  wig_store: "#a855f7", // Purple
  antique_store: "#92400e", // Dark orange
  apartments: "#6b7280", // Gray
  property_management: "#374151", // Dark gray
  mattress_store: "#7c3aed", // Purple
  hotel: "#ec4899", // Pink
  funeral_services_and_cemeteries: "#4b5563", // Gray
  cannabis_clinic: "#22c55e", // Green
  cannabis_dispensary: "#16a34a", // Dark green
  child_care_and_day_care: "#fbbf24", // Yellow
  clothing_rental: "#d946ef", // Magenta
  community_services_non_profit: "#10b981", // Green (variation)
  arms: "#991b1b", // Dark red
  boxing_class: "#dc2626", // Red
  buffet_restaurant: "#f97316", // Orange
  cafe: "#78350f", // Dark brown

  // === Generic Fallbacks ===
  bank: "#1f2937", // Dark gray
  credit_union: "#374151", // Gray
  spa: "#be123c", // Crimson
  repair: "#0891b2", // Cyan
  shop: "#10b981", // Green
  store: "#84cc16", // Lime
  services: "#3b82f6", // Blue

  // === Extended Categories for Better Coverage ===
  dental_office: "#7c3aed", // Purple
  medical_office: "#8b5cf6", // Violet
  law_office: "#6366f1", // Indigo
  insurance_agency: "#3b82f6", // Blue
  motel: "#f43f5e", // Rose
  gas_station: "#dc2626", // Red
  pharmacy: "#059669", // Emerald
  pet_store: "#22c55e", // Green
  florist: "#84cc16", // Lime
  shoe_store: "#a855f7", // Purple
  jewelry_store: "#fbbf24", // Yellow
  electronics_store: "#06b6d4", // Cyan
  sporting_goods_store: "#10b981", // Green
  toy_store: "#f472b6", // Light pink
  book_store: "#8b5cf6", // Violet
  music_store: "#ec4899", // Pink
  gift_shop: "#f59e0b", // Amber
  thrift_store: "#78350f", // Dark brown
  laundromat: "#0891b2", // Cyan
  dry_cleaner: "#06b6d4", // Light cyan
  nail_salon: "#f9a8d4", // Light pink
  hair_salon: "#e879f9", // Light purple
  tanning_salon: "#fbbf24", // Yellow
  fitness_center: "#22c55e", // Green
  dance_studio: "#f472b6", // Light pink
  martial_arts: "#dc2626", // Red
  yoga_studio: "#84cc16", // Lime
  daycare: "#fed7aa", // Light orange
  senior_center: "#a78bfa", // Light violet
  library: "#8b5cf6", // Violet
  post_office: "#6366f1", // Indigo
  fire_station: "#dc2626", // Red
  police_station: "#1e40af", // Blue
  hospital: "#f43f5e", // Rose
  clinic: "#ec4899", // Pink
  veterinary_clinic: "#22c55e", // Green
  church: "#8b5cf6", // Violet
  mosque: "#6366f1", // Indigo
  synagogue: "#3b82f6", // Blue
  temple: "#a855f7", // Purple
  cemetery: "#6b7280", // Gray
  park: "#22c55e", // Green
  movie_theater: "#ec4899", // Pink
  casino: "#dc2626", // Red
  bowling_alley: "#f59e0b", // Amber
  golf_course: "#84cc16", // Lime
  stadium: "#3b82f6", // Blue
  arena: "#8b5cf6", // Violet
  amusement_park: "#f472b6", // Light pink
  zoo: "#22c55e", // Green
  museum: "#8b5cf6", // Violet
  gallery: "#fb923c", // Light orange
  convention_center: "#3b82f6", // Blue

  // === Variations and Aliases ===
  auto_repair: "#047857", // Same as automotive_repair
  car_repair: "#047857", // Alias
  vehicle_repair: "#047857", // Alias
  beauty_spa: "#db2777", // Variation
  spa_salon: "#be123c", // Variation
  health_spa: "#14b8a6", // Variation
  nail_spa: "#f9a8d4", // Variation
  day_spa: "#e11d48", // Variation
  medical_spa: "#8b5cf6", // Variation
  wellness_center: "#22c55e", // Variation
  fitness_gym: "#047857", // Variation
  workout_gym: "#22c55e", // Variation
  sports_gym: "#10b981", // Variation
  family_restaurant: "#f37129", // Variation
  fine_dining: "#7c2d12", // Variation
  casual_dining: "#ea580c", // Variation
  quick_service: "#fed7aa", // Variation
  coffee_house: "#78350f", // Variation
  coffee_bar: "#92400e", // Variation
  espresso_bar: "#713f12", // Variation
  internet_cafe: "#422006", // Variation
  juice_bar: "#84cc16", // Variation
  smoothie_bar: "#22c55e", // Variation
  wine_bar: "#7c2d12", // Variation
  cocktail_bar: "#dc2626", // Variation
  sports_bar: "#1e40af", // Variation
  neighborhood_bar: "#92400e", // Variation
  dive_bar: "#422006", // Variation
  lounge: "#8b5cf6", // Variation
  nightclub: "#ec4899", // Variation
  dance_club: "#f472b6", // Variation
};

/**
 * Get color for a business category
 * @param category - The category name (case-insensitive)
 * @returns Hex color string
 */
export function getCategoryColor(category: string): string {
  if (!category) return CATEGORY_COLORS.other;

  const normalizedCategory = category.toLowerCase().replace(/\s+/g, "_");
  return CATEGORY_COLORS[normalizedCategory] || CATEGORY_COLORS.other;
}

/**
 * Get all unique colors used in the category mapping
 * Useful for generating fallback palettes
 */
export function getAllCategoryColors(): string[] {
  return [...new Set(Object.values(CATEGORY_COLORS))];
}

/**
 * Get category color mapping for specific categories
 * @param categories - Array of category names
 * @returns Object mapping category names to colors
 */
export function getCategoryColorMapping(
  categories: string[]
): Record<string, string> {
  const mapping: Record<string, string> = {};
  categories.forEach((category) => {
    mapping[category] = getCategoryColor(category);
  });
  return mapping;
}

// Budget calculation utilities based on Overture-first model
// Incorporates service intensity, frontage estimates, and tunable parameters

export interface BudgetParameters {
  // Category enable/disable flags
  cleaning_enabled: boolean;
  safety_enabled: boolean;
  marketing_enabled: boolean;
  assets_enabled: boolean;

  // Cleaning & Safety labor (annualized)
  clean_loaded_rate: number; // Fully-loaded hourly cost per cleaner
  clean_hours_per_shift: number;
  clean_shifts_per_day: number;
  clean_days_per_week: number;
  frontage_ft_per_cleaner_hour: number; // Productivity (linear ft swept per hour)
  avg_frontage_ft_per_business: number; // Fallback to estimate total frontage
  intensity_weight_clean: number; // Multiplier from service intensity (0.8-1.5)
  supervisor_ratio: number; // Cleaners per 1 supervisor
  supervisor_loaded_rate: number;

  // Safety/Hospitality
  safety_loaded_rate: number;
  safety_hours_per_day: number;
  safety_days_per_week: number;
  intensity_weight_safety: number;

  // Streetscape asset inventory (annualized)
  feet_per_trash_can: number;
  trash_can_unit_cost: number;
  trash_can_life_years: number;
  feet_per_planter: number;
  planter_unit_cost: number;
  planter_life_years: number;
  feet_per_banner: number;
  banner_unit_cost: number;
  banner_life_years: number;

  // Marketing budget
  marketing_base_annual: number;
  marketing_per_business: number;
  marketing_night_economy_multiplier: number;
  events_per_year: number;
  cost_per_event: number;

  // General
  min_category_count: number;
  admin_overhead_pct: number;
}

// Default values based on industry standards
export const DEFAULT_BUDGET_PARAMS: BudgetParameters = {
  // Category enable/disable flags
  cleaning_enabled: true,
  safety_enabled: true,
  marketing_enabled: true,
  assets_enabled: true,

  // Cleaning
  clean_loaded_rate: 32,
  clean_hours_per_shift: 8,
  clean_shifts_per_day: 1,
  clean_days_per_week: 6,
  frontage_ft_per_cleaner_hour: 900,
  avg_frontage_ft_per_business: 22,
  intensity_weight_clean: 1.0,
  supervisor_ratio: 8,
  supervisor_loaded_rate: 48,

  // Safety
  safety_loaded_rate: 40,
  safety_hours_per_day: 16,
  safety_days_per_week: 6,
  intensity_weight_safety: 1.0,

  // Assets
  feet_per_trash_can: 450,
  trash_can_unit_cost: 950,
  trash_can_life_years: 10,
  feet_per_planter: 600,
  planter_unit_cost: 300,
  planter_life_years: 5,
  feet_per_banner: 900,
  banner_unit_cost: 180,
  banner_life_years: 3,

  // Marketing
  marketing_base_annual: 25000,
  marketing_per_business: 60,
  marketing_night_economy_multiplier: 0.25,
  events_per_year: 6,
  cost_per_event: 5000,

  // General
  min_category_count: 3,
  admin_overhead_pct: 0.12,
};

// Category weights for service intensity calculations
export const CATEGORY_WEIGHTS = {
  food: { clean_weight: 1.3, night_weight: 1.4 },
  bar: { clean_weight: 1.3, night_weight: 1.4 },
  cafe: { clean_weight: 1.2, night_weight: 1.3 },
  restaurant: { clean_weight: 1.3, night_weight: 1.4 },
  entertainment: { clean_weight: 1.2, night_weight: 1.5 },
  retail: { clean_weight: 1.0, night_weight: 1.0 },
  shopping: { clean_weight: 1.0, night_weight: 1.0 },
  service: { clean_weight: 0.95, night_weight: 0.9 },
  services: { clean_weight: 0.95, night_weight: 0.9 },
  lodging: { clean_weight: 1.1, night_weight: 1.2 },
  hotel: { clean_weight: 1.1, night_weight: 1.2 },
  other: { clean_weight: 1.0, night_weight: 1.0 },
};

// Calculate service intensity from business mix
export function calculateServiceIntensity(
  categoryBreakdown: Record<string, number>
) {
  let totalWeightedClean = 0;
  let totalWeightedNight = 0;
  let totalBusinesses = 0;

  for (const [category, count] of Object.entries(categoryBreakdown)) {
    const weights =
      CATEGORY_WEIGHTS[category.toLowerCase()] || CATEGORY_WEIGHTS.other;
    totalWeightedClean += count * weights.clean_weight;
    totalWeightedNight += count * weights.night_weight;
    totalBusinesses += count;
  }

  return {
    cleanIntensity:
      totalBusinesses > 0 ? totalWeightedClean / totalBusinesses : 1.0,
    nightIntensity:
      totalBusinesses > 0 ? totalWeightedNight / totalBusinesses : 1.0,
  };
}

// Calculate cleaning costs
export function calculateCleaningCost(
  params: BudgetParameters,
  frontageEstimate: number,
  cleanIntensity: number
): number {
  if (!params.cleaning_enabled) return 0;

  const cleanerHoursPerDay =
    (frontageEstimate / params.frontage_ft_per_cleaner_hour) *
    params.intensity_weight_clean *
    cleanIntensity;

  const cleanersNeeded = Math.ceil(
    cleanerHoursPerDay / params.clean_hours_per_shift
  );
  const supervisorsNeeded = Math.ceil(cleanersNeeded / params.supervisor_ratio);

  const cleanerCost =
    cleanersNeeded *
    params.clean_hours_per_shift *
    params.clean_days_per_week *
    52 *
    params.clean_loaded_rate;

  const supervisorCost =
    supervisorsNeeded *
    params.clean_hours_per_shift *
    params.clean_days_per_week *
    52 *
    params.supervisor_loaded_rate;

  return cleanerCost + supervisorCost;
}

// Calculate safety/hospitality costs
export function calculateSafetyCost(
  params: BudgetParameters,
  nightIntensity: number
): number {
  if (!params.safety_enabled) return 0;

  const baselineFTE = Math.ceil(params.safety_hours_per_day / 8.0);
  const adjustedFTE =
    baselineFTE * nightIntensity * params.intensity_weight_safety;

  return (
    adjustedFTE *
    8 *
    params.safety_days_per_week *
    52 *
    params.safety_loaded_rate
  );
}

// Calculate streetscape assets cost (annualized)
export function calculateAssetsCost(
  params: BudgetParameters,
  frontageEstimate: number
): number {
  if (!params.assets_enabled) return 0;

  const trashCans = Math.ceil(frontageEstimate / params.feet_per_trash_can);
  const planters = Math.ceil(frontageEstimate / params.feet_per_planter);
  const banners = Math.ceil(frontageEstimate / params.feet_per_banner);

  const trashCanCost =
    (trashCans * params.trash_can_unit_cost) / params.trash_can_life_years;
  const planterCost =
    (planters * params.planter_unit_cost) / params.planter_life_years;
  const bannerCost =
    (banners * params.banner_unit_cost) / params.banner_life_years;

  return trashCanCost + planterCost + bannerCost;
}

// Calculate marketing costs
export function calculateMarketingCost(
  params: BudgetParameters,
  businessCount: number,
  nightIntensity: number
): number {
  if (!params.marketing_enabled) return 0;

  const baseCost = params.marketing_base_annual;
  const perBusinessCost = businessCount * params.marketing_per_business;
  const nightEconomyBonus =
    params.marketing_night_economy_multiplier *
    nightIntensity *
    params.marketing_base_annual *
    0.15;
  const eventsCost = params.events_per_year * params.cost_per_event;

  return baseCost + perBusinessCost + nightEconomyBonus + eventsCost;
}

// Main budget calculation function
export function calculateBudget(
  params: BudgetParameters,
  businessCount: number,
  areaAcres: number,
  perimeterFt: number,
  categoryBreakdown: Record<string, number>
) {
  // Estimate frontage (can be refined with actual storefront data)
  const frontageEstimate = businessCount * params.avg_frontage_ft_per_business;

  // Calculate service intensity
  const { cleanIntensity, nightIntensity } =
    calculateServiceIntensity(categoryBreakdown);

  // Calculate individual service costs
  const cleaningCost = calculateCleaningCost(
    params,
    frontageEstimate,
    cleanIntensity
  );
  const safetyCost = calculateSafetyCost(params, nightIntensity);
  const assetsCost = calculateAssetsCost(params, frontageEstimate);
  const marketingCost = calculateMarketingCost(
    params,
    businessCount,
    nightIntensity
  );

  // Calculate totals
  const subtotal = cleaningCost + safetyCost + assetsCost + marketingCost;
  const adminOverhead = subtotal * params.admin_overhead_pct;
  const total = subtotal + adminOverhead;

  return {
    cleaning: Math.round(cleaningCost),
    safety: Math.round(safetyCost),
    assets: Math.round(assetsCost),
    marketing: Math.round(marketingCost),
    subtotal: Math.round(subtotal),
    adminOverhead: Math.round(adminOverhead),
    total: Math.round(total),

    // Additional metrics
    costPerBusiness: businessCount > 0 ? Math.round(total / businessCount) : 0,
    costPerAcre: areaAcres > 0 ? Math.round(total / areaAcres) : 0,
    cleanIntensity: Math.round(cleanIntensity * 100) / 100,
    nightIntensity: Math.round(nightIntensity * 100) / 100,
    frontageEstimate: Math.round(frontageEstimate),

    // Staffing estimates
    cleanersNeeded: params.cleaning_enabled
      ? Math.ceil(
          ((frontageEstimate / params.frontage_ft_per_cleaner_hour) *
            params.intensity_weight_clean *
            cleanIntensity) /
            params.clean_hours_per_shift
        )
      : 0,
    supervisorsNeeded: params.cleaning_enabled
      ? Math.ceil(
          Math.ceil(
            ((frontageEstimate / params.frontage_ft_per_cleaner_hour) *
              params.intensity_weight_clean *
              cleanIntensity) /
              params.clean_hours_per_shift
          ) / params.supervisor_ratio
        )
      : 0,
    safetyFTE: params.safety_enabled
      ? Math.ceil(params.safety_hours_per_day / 8.0) * nightIntensity
      : 0,
  };
}

// Determine place typology based on business mix
export function determinePlaceTypology(
  categoryBreakdown: Record<string, number>,
  totalPlaces: number
) {
  if (totalPlaces === 0) return "Low Density";

  const percentages = Object.entries(categoryBreakdown).map(([cat, count]) => ({
    category: cat,
    percentage: (count / totalPlaces) * 100,
  }));

  // Sort by percentage
  percentages.sort((a, b) => b.percentage - a.percentage);

  // Determine typology based on dominant categories
  const topCategory = percentages[0];

  if (topCategory.percentage > 40) {
    // Dominant single category
    if (
      topCategory.category === "retail" ||
      topCategory.category === "shopping"
    ) {
      return "Retail Core";
    } else if (
      topCategory.category === "food" ||
      topCategory.category === "restaurant"
    ) {
      return "Dining District";
    } else if (
      topCategory.category === "service" ||
      topCategory.category === "services"
    ) {
      return "Service Hub";
    } else if (topCategory.category === "entertainment") {
      return "Entertainment Zone";
    }
  }

  // Check for diverse mix
  const topThree = percentages.slice(0, 3);
  const topThreeTotal = topThree.reduce((sum, cat) => sum + cat.percentage, 0);

  if (topThreeTotal < 70 && percentages.length >= 5) {
    return "Diverse Business Mix";
  }

  // Check for specific combinations
  const foodPercentage =
    (categoryBreakdown.food || 0) + (categoryBreakdown.restaurant || 0);
  const retailPercentage =
    (categoryBreakdown.retail || 0) + (categoryBreakdown.shopping || 0);

  if (foodPercentage > 25 && retailPercentage > 25) {
    return "Mixed-Use District";
  }

  return "General Commercial";
}

// Service demand indicators based on business mix and density
export function getServiceDemandIndicators(
  businessCount: number,
  areaAcres: number,
  categoryBreakdown: Record<string, number>,
  cleanIntensity: number,
  nightIntensity: number
) {
  const density = businessCount / areaAcres;
  const foodPercentage =
    (((categoryBreakdown.food || 0) + (categoryBreakdown.restaurant || 0)) /
      businessCount) *
    100;
  const retailPercentage =
    (((categoryBreakdown.retail || 0) + (categoryBreakdown.shopping || 0)) /
      businessCount) *
    100;
  const entertainmentPercentage =
    ((categoryBreakdown.entertainment || 0) / businessCount) * 100;

  return {
    cleaning: {
      priority:
        cleanIntensity > 1.15
          ? "High"
          : cleanIntensity > 1.05
          ? "Medium"
          : "Standard",
      needs: [
        density > 50 && "High-frequency sidewalk cleaning",
        foodPercentage > 30 && "Enhanced waste management",
        retailPercentage > 40 && "Window cleaning program",
        cleanIntensity > 1.2 && "Additional cleaning shifts",
      ].filter(Boolean),
    },
    safety: {
      priority:
        nightIntensity > 1.2
          ? "High"
          : nightIntensity > 1.1
          ? "Medium"
          : "Standard",
      needs: [
        nightIntensity > 1.3 && "Evening/night patrols",
        density > 75 && "Daytime ambassadors",
        entertainmentPercentage > 20 && "Weekend coverage",
        businessCount > 100 && "Security camera network",
      ].filter(Boolean),
    },
    marketing: {
      priority:
        businessCount > 75
          ? "High"
          : businessCount > 35
          ? "Medium"
          : "Standard",
      needs: [
        "District branding and wayfinding",
        entertainmentPercentage > 15 && "Night economy promotion",
        retailPercentage > 35 && "Seasonal shopping campaigns",
        foodPercentage > 25 && "Restaurant week events",
      ].filter(Boolean),
    },
  };
}

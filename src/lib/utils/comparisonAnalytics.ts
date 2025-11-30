import {
  differenceInDays,
  format,
  getMonth,
  getYear,
  parseISO,
  subMonths,
  subYears,
} from "date-fns";

type Transaction = {
  id: string;
  date: string;
  amount: number;
  category?: string | null;
  account_id?: string;
};

type Account = {
  id: string;
  name: string;
  type: "income" | "expense";
  country_code?: string | null;
  location_name?: string | null;
};

// ==================== PERIOD COMPARISONS ====================

export type ComparisonResult = {
  currentTotal: number;
  previousTotal: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
};

/**
 * Compare spending between two date ranges
 */
export function comparePeriods(
  transactions: Transaction[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): ComparisonResult {
  const currentTxs = transactions.filter((t) => {
    const date = parseISO(t.date);
    return date >= currentStart && date <= currentEnd;
  });

  const previousTxs = transactions.filter((t) => {
    const date = parseISO(t.date);
    return date >= previousStart && date <= previousEnd;
  });

  const currentTotal = currentTxs.reduce((sum, t) => sum + t.amount, 0);
  const previousTotal = previousTxs.reduce((sum, t) => sum + t.amount, 0);
  const change = currentTotal - previousTotal;
  const changePercent =
    previousTotal > 0
      ? (change / previousTotal) * 100
      : currentTotal > 0
        ? 100
        : 0;

  return {
    currentTotal,
    previousTotal,
    change,
    changePercent,
    trend: changePercent > 5 ? "up" : changePercent < -5 ? "down" : "stable",
  };
}

/**
 * Month over Month comparison
 */
export function getMonthOverMonth(
  transactions: Transaction[]
): ComparisonResult {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const previousMonthStart = subMonths(currentMonthStart, 1);
  const previousMonthEnd = new Date(
    previousMonthStart.getFullYear(),
    previousMonthStart.getMonth() + 1,
    0
  );

  return comparePeriods(
    transactions,
    currentMonthStart,
    currentMonthEnd,
    previousMonthStart,
    previousMonthEnd
  );
}

/**
 * Year over Year comparison
 */
export function getYearOverYear(transactions: Transaction[]): ComparisonResult {
  const now = new Date();
  const currentYearStart = new Date(now.getFullYear(), 0, 1);
  const currentYearEnd = new Date(now.getFullYear(), 11, 31);
  const previousYearStart = subYears(currentYearStart, 1);
  const previousYearEnd = subYears(currentYearEnd, 1);

  return comparePeriods(
    transactions,
    currentYearStart,
    currentYearEnd,
    previousYearStart,
    previousYearEnd
  );
}

/**
 * Compare same month of previous year (e.g., Nov 2025 vs Nov 2024)
 */
export function getSameMonthLastYear(
  transactions: Transaction[]
): ComparisonResult {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const previousYearMonthStart = subYears(currentMonthStart, 1);
  const previousYearMonthEnd = new Date(
    previousYearMonthStart.getFullYear(),
    previousYearMonthStart.getMonth() + 1,
    0
  );

  return comparePeriods(
    transactions,
    currentMonthStart,
    currentMonthEnd,
    previousYearMonthStart,
    previousYearMonthEnd
  );
}

// ==================== SEASONAL ANALYSIS ====================

export type Season = "winter" | "spring" | "summer" | "fall";

export function getSeason(date: Date): Season {
  const month = getMonth(date);
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

export type SeasonalSpending = {
  season: Season;
  total: number;
  avgPerMonth: number;
  transactionCount: number;
  topCategories: { category: string; amount: number }[];
};

export function getSeasonalAnalysis(
  transactions: Transaction[]
): SeasonalSpending[] {
  const seasons: Record<
    Season,
    {
      total: number;
      count: number;
      months: Set<string>;
      categories: Record<string, number>;
    }
  > = {
    winter: { total: 0, count: 0, months: new Set(), categories: {} },
    spring: { total: 0, count: 0, months: new Set(), categories: {} },
    summer: { total: 0, count: 0, months: new Set(), categories: {} },
    fall: { total: 0, count: 0, months: new Set(), categories: {} },
  };

  transactions.forEach((t) => {
    const date = parseISO(t.date);
    const season = getSeason(date);
    const monthKey = format(date, "yyyy-MM");

    seasons[season].total += t.amount;
    seasons[season].count += 1;
    seasons[season].months.add(monthKey);

    const cat = t.category || "Uncategorized";
    seasons[season].categories[cat] =
      (seasons[season].categories[cat] || 0) + t.amount;
  });

  return (["winter", "spring", "summer", "fall"] as Season[]).map((season) => {
    const data = seasons[season];
    const monthCount = Math.max(1, data.months.size);
    const topCategories = Object.entries(data.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    return {
      season,
      total: data.total,
      avgPerMonth: data.total / monthCount,
      transactionCount: data.count,
      topCategories,
    };
  });
}

export function getCurrentSeasonComparison(
  transactions: Transaction[]
): ComparisonResult & { season: Season } {
  const now = new Date();
  const currentSeason = getSeason(now);
  const currentYear = getYear(now);

  // Get current season date range
  const seasonMonths: Record<Season, [number, number]> = {
    winter: [11, 1], // Dec, Jan, Feb (spanning years)
    spring: [2, 4], // Mar, Apr, May
    summer: [5, 7], // Jun, Jul, Aug
    fall: [8, 10], // Sep, Oct, Nov
  };

  const [startMonth, endMonth] = seasonMonths[currentSeason];

  // Current season
  const currentSeasonStart =
    currentSeason === "winter" && now.getMonth() <= 1
      ? new Date(currentYear - 1, 11, 1)
      : new Date(currentYear, startMonth, 1);
  const currentSeasonEnd =
    currentSeason === "winter" && now.getMonth() >= 11
      ? new Date(currentYear + 1, 1, 28)
      : new Date(currentYear, endMonth + 1, 0);

  // Previous year same season
  const previousSeasonStart = subYears(currentSeasonStart, 1);
  const previousSeasonEnd = subYears(currentSeasonEnd, 1);

  return {
    ...comparePeriods(
      transactions,
      currentSeasonStart,
      currentSeasonEnd,
      previousSeasonStart,
      previousSeasonEnd
    ),
    season: currentSeason,
  };
}

// ==================== TIME SERIES DATA ====================

export type TimeSeriesPoint = {
  date: string;
  label: string;
  amount: number;
  count: number;
};

/**
 * Get daily spending time series
 */
export function getDailySpending(
  transactions: Transaction[],
  days: number = 30
): TimeSeriesPoint[] {
  const now = new Date();
  const data: Record<string, { amount: number; count: number }> = {};

  // Initialize all days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = format(date, "yyyy-MM-dd");
    data[key] = { amount: 0, count: 0 };
  }

  // Fill with transaction data
  transactions.forEach((t) => {
    if (data[t.date]) {
      data[t.date].amount += t.amount;
      data[t.date].count += 1;
    }
  });

  return Object.entries(data).map(([date, values]) => ({
    date,
    label: format(parseISO(date), "MMM d"),
    ...values,
  }));
}

/**
 * Get monthly spending time series
 */
export function getMonthlySpending(
  transactions: Transaction[],
  months: number = 12
): TimeSeriesPoint[] {
  const now = new Date();
  const data: Record<string, { amount: number; count: number }> = {};

  // Initialize all months
  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const key = format(date, "yyyy-MM");
    data[key] = { amount: 0, count: 0 };
  }

  // Fill with transaction data
  transactions.forEach((t) => {
    const key = t.date.substring(0, 7); // yyyy-MM
    if (data[key]) {
      data[key].amount += t.amount;
      data[key].count += 1;
    }
  });

  return Object.entries(data).map(([date, values]) => ({
    date,
    label: format(parseISO(date + "-01"), "MMM yy"),
    ...values,
  }));
}

// ==================== TRIP / LOCATION ANALYTICS ====================

export type CountrySpending = {
  countryCode: string;
  countryName: string;
  locationName?: string;
  accountName: string;
  accountId: string;
  total: number;
  transactionCount: number;
  avgPerTransaction: number;
  dates: { first: string; last: string };
  topCategories: { category: string; amount: number }[];
};

// ISO 3166-1 alpha-2 to country name mapping
export const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AD: "Andorra",
  AO: "Angola",
  AG: "Antigua",
  AR: "Argentina",
  AM: "Armenia",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BY: "Belarus",
  BE: "Belgium",
  BZ: "Belize",
  BJ: "Benin",
  BT: "Bhutan",
  BO: "Bolivia",
  BA: "Bosnia",
  BW: "Botswana",
  BR: "Brazil",
  BN: "Brunei",
  BG: "Bulgaria",
  BF: "Burkina Faso",
  BI: "Burundi",
  KH: "Cambodia",
  CM: "Cameroon",
  CA: "Canada",
  CV: "Cape Verde",
  CF: "Central African Republic",
  TD: "Chad",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  KM: "Comoros",
  CG: "Congo",
  CR: "Costa Rica",
  HR: "Croatia",
  CU: "Cuba",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  DJ: "Djibouti",
  DM: "Dominica",
  DO: "Dominican Republic",
  EC: "Ecuador",
  EG: "Egypt",
  SV: "El Salvador",
  GQ: "Equatorial Guinea",
  ER: "Eritrea",
  EE: "Estonia",
  ET: "Ethiopia",
  FJ: "Fiji",
  FI: "Finland",
  FR: "France",
  GA: "Gabon",
  GM: "Gambia",
  GE: "Georgia",
  DE: "Germany",
  GH: "Ghana",
  GR: "Greece",
  GD: "Grenada",
  GT: "Guatemala",
  GN: "Guinea",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HT: "Haiti",
  HN: "Honduras",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IR: "Iran",
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",
  JM: "Jamaica",
  JP: "Japan",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KI: "Kiribati",
  KP: "North Korea",
  KR: "South Korea",
  KW: "Kuwait",
  KG: "Kyrgyzstan",
  LA: "Laos",
  LV: "Latvia",
  LB: "Lebanon",
  LS: "Lesotho",
  LR: "Liberia",
  LY: "Libya",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",
  MK: "Macedonia",
  MG: "Madagascar",
  MW: "Malawi",
  MY: "Malaysia",
  MV: "Maldives",
  ML: "Mali",
  MT: "Malta",
  MH: "Marshall Islands",
  MR: "Mauritania",
  MU: "Mauritius",
  MX: "Mexico",
  FM: "Micronesia",
  MD: "Moldova",
  MC: "Monaco",
  MN: "Mongolia",
  ME: "Montenegro",
  MA: "Morocco",
  MZ: "Mozambique",
  MM: "Myanmar",
  NA: "Namibia",
  NR: "Nauru",
  NP: "Nepal",
  NL: "Netherlands",
  NZ: "New Zealand",
  NI: "Nicaragua",
  NE: "Niger",
  NG: "Nigeria",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PW: "Palau",
  PS: "Palestine",
  PA: "Panama",
  PG: "Papua New Guinea",
  PY: "Paraguay",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  QA: "Qatar",
  RO: "Romania",
  RU: "Russia",
  RW: "Rwanda",
  KN: "Saint Kitts",
  LC: "Saint Lucia",
  VC: "Saint Vincent",
  WS: "Samoa",
  SM: "San Marino",
  ST: "Sao Tome",
  SA: "Saudi Arabia",
  SN: "Senegal",
  RS: "Serbia",
  SC: "Seychelles",
  SL: "Sierra Leone",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  SB: "Solomon Islands",
  SO: "Somalia",
  ZA: "South Africa",
  SS: "South Sudan",
  ES: "Spain",
  LK: "Sri Lanka",
  SD: "Sudan",
  SR: "Suriname",
  SZ: "Eswatini",
  SE: "Sweden",
  CH: "Switzerland",
  SY: "Syria",
  TW: "Taiwan",
  TJ: "Tajikistan",
  TZ: "Tanzania",
  TH: "Thailand",
  TL: "Timor-Leste",
  TG: "Togo",
  TO: "Tonga",
  TT: "Trinidad",
  TN: "Tunisia",
  TR: "Turkey",
  TM: "Turkmenistan",
  TV: "Tuvalu",
  UG: "Uganda",
  UA: "Ukraine",
  AE: "UAE",
  GB: "United Kingdom",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VU: "Vanuatu",
  VA: "Vatican",
  VE: "Venezuela",
  VN: "Vietnam",
  YE: "Yemen",
  ZM: "Zambia",
  ZW: "Zimbabwe",
};

/**
 * Get spending by country for trip tracking
 * Location data comes from accounts, not transactions
 */
export function getSpendingByCountry(
  transactions: Transaction[],
  accounts: Account[] | undefined
): CountrySpending[] {
  if (!accounts) return [];

  // Create a map of account_id to account for quick lookup
  const accountMap = new Map<string, Account>();
  accounts.forEach((acc) => {
    if (acc.country_code) {
      accountMap.set(acc.id, acc);
    }
  });

  // Group transactions by account (for accounts with country_code)
  const byAccount: Record<
    string,
    {
      account: Account;
      total: number;
      count: number;
      dates: string[];
      categories: Record<string, number>;
    }
  > = {};

  transactions.forEach((t) => {
    const accountId = t.account_id;
    if (!accountId) return;

    const account = accountMap.get(accountId);
    if (!account || !account.country_code) return;

    if (!byAccount[accountId]) {
      byAccount[accountId] = {
        account,
        total: 0,
        count: 0,
        dates: [],
        categories: {},
      };
    }

    byAccount[accountId].total += t.amount;
    byAccount[accountId].count += 1;
    byAccount[accountId].dates.push(t.date);

    const cat = t.category || "Uncategorized";
    byAccount[accountId].categories[cat] =
      (byAccount[accountId].categories[cat] || 0) + t.amount;
  });

  return Object.entries(byAccount)
    .map(([accountId, data]) => {
      const sortedDates = data.dates.sort();
      const topCategories = Object.entries(data.categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, amount]) => ({ category, amount }));

      return {
        countryCode: data.account.country_code!,
        countryName:
          COUNTRY_NAMES[data.account.country_code!] ||
          data.account.country_code!,
        locationName: data.account.location_name || undefined,
        accountName: data.account.name,
        accountId,
        total: data.total,
        transactionCount: data.count,
        avgPerTransaction: data.total / data.count,
        dates: {
          first: sortedDates[0],
          last: sortedDates[sortedDates.length - 1],
        },
        topCategories,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * Get trip timeline (visits grouped by account with country)
 * Each trip account represents a single trip
 */
export type Trip = {
  countryCode: string;
  countryName: string;
  locationName?: string;
  accountName: string;
  accountId: string;
  startDate: string;
  endDate: string;
  duration: number;
  totalSpent: number;
  transactionCount: number;
};

export function getTripTimeline(
  transactions: Transaction[],
  accounts: Account[] | undefined
): Trip[] {
  if (!accounts) return [];

  // Create a map of account_id to account for quick lookup
  const accountMap = new Map<string, Account>();
  accounts.forEach((acc) => {
    if (acc.country_code) {
      accountMap.set(acc.id, acc);
    }
  });

  // Group transactions by account (for accounts with country_code)
  const byAccount: Record<
    string,
    {
      account: Account;
      dates: string[];
      totalSpent: number;
      count: number;
    }
  > = {};

  transactions.forEach((t) => {
    const accountId = t.account_id;
    if (!accountId) return;

    const account = accountMap.get(accountId);
    if (!account || !account.country_code) return;

    if (!byAccount[accountId]) {
      byAccount[accountId] = {
        account,
        dates: [],
        totalSpent: 0,
        count: 0,
      };
    }

    byAccount[accountId].dates.push(t.date);
    byAccount[accountId].totalSpent += t.amount;
    byAccount[accountId].count += 1;
  });

  // Convert to Trip array
  const trips: Trip[] = Object.entries(byAccount)
    .filter(([_, data]) => data.dates.length > 0)
    .map(([accountId, data]) => {
      const sortedDates = [...data.dates].sort();
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];

      return {
        countryCode: data.account.country_code!,
        countryName:
          COUNTRY_NAMES[data.account.country_code!] ||
          data.account.country_code!,
        locationName: data.account.location_name || undefined,
        accountName: data.account.name,
        accountId,
        startDate,
        endDate,
        duration: differenceInDays(parseISO(endDate), parseISO(startDate)) + 1,
        totalSpent: data.totalSpent,
        transactionCount: data.count,
      };
    });

  // Sort by most recent trip first
  return trips.sort((a, b) => b.endDate.localeCompare(a.endDate));
}

// ==================== ADVANCED INSIGHTS ====================

export type SpendingPattern = {
  type: "consistent" | "variable" | "spiky";
  coefficient: number; // coefficient of variation
  description: string;
};

export function analyzeSpendingPattern(
  transactions: Transaction[]
): SpendingPattern {
  const dailyTotals: Record<string, number> = {};
  transactions.forEach((t) => {
    dailyTotals[t.date] = (dailyTotals[t.date] || 0) + t.amount;
  });

  const values = Object.values(dailyTotals);
  if (values.length < 2) {
    return {
      type: "consistent",
      coefficient: 0,
      description: "Not enough data",
    };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;

  if (cv < 0.5) {
    return {
      type: "consistent",
      coefficient: cv,
      description: "Steady spending pattern",
    };
  } else if (cv < 1.0) {
    return {
      type: "variable",
      coefficient: cv,
      description: "Moderate spending fluctuations",
    };
  } else {
    return {
      type: "spiky",
      coefficient: cv,
      description: "High spending volatility",
    };
  }
}

export type BudgetForecast = {
  projectedMonthEnd: number;
  dailyAverage: number;
  daysRemaining: number;
  suggestedDailyBudget: number | null;
  onTrack: boolean;
  message: string;
};

export function forecastMonthEnd(
  transactions: Transaction[],
  monthlyBudget?: number
): BudgetForecast {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  const monthTransactions = transactions.filter((t) => {
    const date = parseISO(t.date);
    return date >= monthStart && date <= now;
  });

  const currentTotal = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
  const dailyAverage = currentTotal / dayOfMonth;
  const projectedMonthEnd = dailyAverage * daysInMonth;

  let suggestedDailyBudget: number | null = null;
  let onTrack = true;
  let message = "";

  if (monthlyBudget) {
    const remaining = monthlyBudget - currentTotal;
    suggestedDailyBudget =
      remaining > 0 ? remaining / Math.max(1, daysRemaining) : 0;
    onTrack = projectedMonthEnd <= monthlyBudget;

    if (onTrack) {
      message = `On track! Projected ${((projectedMonthEnd / monthlyBudget) * 100).toFixed(0)}% of budget`;
    } else {
      const overBy = projectedMonthEnd - monthlyBudget;
      message = `Projected to exceed budget by $${overBy.toFixed(0)}`;
    }
  } else {
    message = `Projected month-end: $${projectedMonthEnd.toFixed(0)}`;
  }

  return {
    projectedMonthEnd,
    dailyAverage,
    daysRemaining,
    suggestedDailyBudget,
    onTrack,
    message,
  };
}

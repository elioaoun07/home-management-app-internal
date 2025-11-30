"use client";

import { cn } from "@/lib/utils";
import { type CountrySpending } from "@/lib/utils/comparisonAnalytics";
import { format, parseISO } from "date-fns";
import { Globe, MapPin, Plane } from "lucide-react";
import { memo, useMemo, useState } from "react";

type WorldMapProps = {
  spending: CountrySpending[];
  onCountryClick?: (countryCode: string) => void;
  className?: string;
};

// Simplified world map SVG paths - major countries
// These are simplified paths for the most commonly visited countries
const COUNTRY_PATHS: Record<
  string,
  { path: string; center: [number, number] }
> = {
  US: {
    path: "M168 120 L168 115 L175 110 L182 108 L190 108 L198 110 L205 115 L210 122 L215 130 L218 140 L216 148 L210 154 L200 158 L188 160 L175 158 L165 152 L160 145 L160 135 L163 127 Z",
    center: [188, 135],
  },
  CA: {
    path: "M150 60 L155 55 L175 50 L200 50 L220 55 L235 65 L240 80 L235 95 L225 105 L210 108 L190 105 L170 105 L155 100 L145 90 L142 75 Z",
    center: [195, 80],
  },
  MX: {
    path: "M155 165 L165 160 L180 162 L192 168 L198 178 L195 188 L185 195 L172 195 L160 190 L152 180 L150 170 Z",
    center: [175, 178],
  },
  BR: {
    path: "M270 240 L285 230 L305 230 L320 240 L328 260 L325 285 L315 305 L295 315 L275 310 L260 295 L255 275 L260 255 Z",
    center: [290, 270],
  },
  AR: {
    path: "M260 315 L275 310 L285 320 L288 340 L285 365 L275 385 L265 395 L255 388 L250 365 L252 340 Z",
    center: [270, 355],
  },
  GB: {
    path: "M440 90 L445 85 L452 82 L458 85 L462 92 L460 100 L455 105 L448 108 L440 105 L436 98 Z",
    center: [449, 95],
  },
  FR: {
    path: "M445 115 L455 110 L468 112 L478 120 L480 132 L475 142 L465 148 L452 145 L442 138 L440 125 Z",
    center: [460, 128],
  },
  DE: {
    path: "M475 100 L485 95 L498 97 L505 105 L505 118 L498 126 L485 128 L475 122 L472 112 Z",
    center: [490, 112],
  },
  IT: {
    path: "M485 135 L492 130 L502 135 L505 148 L500 165 L490 178 L480 175 L478 160 L482 145 Z",
    center: [490, 155],
  },
  ES: {
    path: "M420 135 L435 130 L450 132 L458 142 L455 155 L445 162 L430 160 L418 152 L415 142 Z",
    center: [438, 145],
  },
  PT: {
    path: "M408 138 L415 135 L420 140 L420 155 L415 162 L408 160 L405 150 Z",
    center: [412, 148],
  },
  NL: {
    path: "M465 90 L472 88 L478 90 L480 98 L475 102 L468 102 L463 98 Z",
    center: [472, 95],
  },
  BE: {
    path: "M460 100 L468 98 L475 100 L476 108 L470 112 L462 110 L458 105 Z",
    center: [468, 105],
  },
  CH: {
    path: "M475 118 L482 115 L490 118 L492 125 L488 130 L480 130 L474 125 Z",
    center: [483, 123],
  },
  AT: {
    path: "M492 115 L502 112 L512 115 L515 122 L510 128 L498 128 L490 123 Z",
    center: [503, 120],
  },
  PL: {
    path: "M505 90 L520 85 L535 88 L540 100 L535 110 L520 112 L505 108 L502 98 Z",
    center: [520, 98],
  },
  RU: {
    path: "M550 40 L620 30 L700 35 L750 50 L780 70 L790 100 L780 120 L750 125 L700 120 L650 115 L600 105 L560 95 L540 75 L545 55 Z",
    center: [670, 80],
  },
  CN: {
    path: "M680 130 L720 125 L760 130 L790 150 L795 180 L780 205 L745 215 L705 210 L675 195 L660 170 L665 145 Z",
    center: [730, 170],
  },
  JP: {
    path: "M810 145 L820 140 L830 145 L835 158 L830 172 L820 178 L810 175 L805 162 Z",
    center: [820, 160],
  },
  KR: {
    path: "M795 155 L805 150 L812 155 L815 168 L810 178 L800 180 L792 172 Z",
    center: [803, 165],
  },
  IN: {
    path: "M640 180 L665 170 L690 175 L705 195 L700 225 L680 250 L650 255 L630 240 L625 215 L630 195 Z",
    center: [665, 215],
  },
  TH: {
    path: "M720 210 L732 205 L742 212 L745 228 L738 245 L725 250 L715 242 L712 225 Z",
    center: [728, 228],
  },
  VN: {
    path: "M745 205 L755 200 L762 210 L760 235 L752 255 L742 250 L738 230 L742 215 Z",
    center: [750, 228],
  },
  SG: {
    path: "M735 270 L742 268 L748 272 L748 278 L742 282 L735 278 Z",
    center: [742, 275],
  },
  ID: {
    path: "M740 285 L780 280 L820 285 L840 295 L835 308 L810 315 L770 312 L745 305 L738 295 Z",
    center: [790, 298],
  },
  PH: {
    path: "M785 225 L795 220 L805 225 L808 242 L800 258 L788 255 L782 240 Z",
    center: [795, 240],
  },
  AU: {
    path: "M760 340 L810 330 L860 340 L890 365 L885 400 L860 425 L810 435 L765 420 L745 390 L750 360 Z",
    center: [820, 380],
  },
  NZ: {
    path: "M895 420 L905 415 L915 420 L918 435 L910 450 L898 448 L892 435 Z",
    center: [905, 432],
  },
  ZA: {
    path: "M510 360 L535 350 L560 355 L575 375 L570 400 L550 415 L525 412 L505 395 L502 375 Z",
    center: [538, 382],
  },
  EG: {
    path: "M530 175 L550 170 L565 178 L568 198 L560 215 L542 218 L528 208 L525 190 Z",
    center: [548, 195],
  },
  AE: {
    path: "M595 195 L612 190 L625 198 L625 212 L615 220 L600 218 L592 208 Z",
    center: [608, 205],
  },
  SA: {
    path: "M555 195 L585 185 L605 195 L610 220 L595 245 L565 250 L545 235 L545 215 Z",
    center: [575, 218],
  },
  TR: {
    path: "M535 135 L570 130 L595 138 L598 152 L585 162 L555 165 L535 158 L530 148 Z",
    center: [565, 148],
  },
  GR: {
    path: "M518 142 L530 138 L540 145 L538 160 L528 168 L515 165 L512 152 Z",
    center: [526, 153],
  },
  IL: {
    path: "M555 175 L562 172 L568 178 L565 195 L558 200 L552 195 L550 182 Z",
    center: [560, 186],
  },
  MA: {
    path: "M405 165 L425 160 L440 168 L442 185 L432 198 L412 195 L402 182 Z",
    center: [422, 178],
  },
  NG: {
    path: "M470 235 L492 228 L510 238 L512 260 L498 275 L475 272 L465 255 Z",
    center: [488, 252],
  },
  KE: {
    path: "M560 265 L575 260 L588 270 L585 292 L572 302 L558 298 L552 280 Z",
    center: [570, 282],
  },
  SE: {
    path: "M490 55 L500 48 L512 52 L518 68 L512 85 L498 88 L488 78 L485 65 Z",
    center: [502, 68],
  },
  NO: {
    path: "M470 40 L485 32 L502 38 L505 55 L495 70 L478 72 L465 62 L462 48 Z",
    center: [485, 52],
  },
  FI: {
    path: "M530 45 L545 38 L560 45 L565 65 L555 82 L540 85 L528 75 L525 58 Z",
    center: [545, 62],
  },
  DK: {
    path: "M475 85 L485 82 L492 88 L490 98 L482 102 L472 98 Z",
    center: [482, 92],
  },
  IE: {
    path: "M420 88 L432 82 L442 88 L442 100 L432 108 L420 105 L415 95 Z",
    center: [430, 95],
  },
  CZ: {
    path: "M495 102 L508 98 L518 105 L515 115 L505 118 L495 112 Z",
    center: [506, 108],
  },
  HU: {
    path: "M510 115 L525 112 L535 120 L532 130 L520 132 L508 125 Z",
    center: [520, 122],
  },
  RO: {
    path: "M525 125 L545 120 L560 128 L558 142 L542 148 L525 142 Z",
    center: [542, 135],
  },
  UA: {
    path: "M540 95 L575 88 L600 98 L605 115 L590 128 L555 125 L535 115 Z",
    center: [570, 108],
  },
};

// Country coordinates for markers (simplified for demonstration)
const COUNTRY_MARKERS: Record<string, [number, number]> = {
  US: [188, 135],
  CA: [195, 80],
  MX: [175, 178],
  BR: [290, 270],
  AR: [270, 355],
  GB: [449, 95],
  FR: [460, 128],
  DE: [490, 112],
  IT: [490, 155],
  ES: [438, 145],
  PT: [412, 148],
  NL: [472, 95],
  BE: [468, 105],
  CH: [483, 123],
  AT: [503, 120],
  PL: [520, 98],
  RU: [670, 80],
  CN: [730, 170],
  JP: [820, 160],
  KR: [803, 165],
  IN: [665, 215],
  TH: [728, 228],
  VN: [750, 228],
  SG: [742, 275],
  ID: [790, 298],
  PH: [795, 240],
  AU: [820, 380],
  NZ: [905, 432],
  ZA: [538, 382],
  EG: [548, 195],
  AE: [608, 205],
  SA: [575, 218],
  TR: [565, 148],
  GR: [526, 153],
  IL: [560, 186],
  MA: [422, 178],
  NG: [488, 252],
  KE: [570, 282],
  SE: [502, 68],
  NO: [485, 52],
  FI: [545, 62],
  DK: [482, 92],
  IE: [430, 95],
  CZ: [506, 108],
  HU: [520, 122],
  RO: [542, 135],
  UA: [570, 108],
};

export const WorldMap = memo(function WorldMap({
  spending,
  onCountryClick,
  className,
}: WorldMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const spendingByCode = useMemo(() => {
    const map: Record<string, CountrySpending> = {};
    spending.forEach((s) => {
      map[s.countryCode] = s;
    });
    return map;
  }, [spending]);

  const maxSpending = useMemo(() => {
    return Math.max(...spending.map((s) => s.total), 1);
  }, [spending]);

  const getCountryColor = (code: string) => {
    const data = spendingByCode[code];
    if (!data) return "rgba(255,255,255,0.05)";
    const intensity = Math.min(1, data.total / maxSpending);
    // Color scale from light blue to deep purple
    const r = Math.round(59 + (139 - 59) * intensity);
    const g = Math.round(130 - 80 * intensity);
    const b = Math.round(246 - 50 * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const handleMouseMove = (e: React.MouseEvent, code: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top - 60 });
    setHoveredCountry(code);
  };

  const hoveredData = hoveredCountry ? spendingByCode[hoveredCountry] : null;

  return (
    <div className={cn("relative", className)}>
      {/* Map header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">
            Travel Expenses Map
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>
            {spending.length} trip{spending.length !== 1 ? "s" : ""}
          </span>
          <span>•</span>
          <span>
            ${spending.reduce((sum, s) => sum + s.total, 0).toFixed(0)} total
          </span>
        </div>
      </div>

      {/* SVG Map */}
      <div className="relative bg-slate-900/50 rounded-xl p-2 overflow-hidden">
        <svg
          viewBox="0 0 900 500"
          className="w-full h-auto"
          style={{ maxHeight: "300px" }}
        >
          {/* Background */}
          <rect width="900" height="500" fill="transparent" />

          {/* World outline (simplified) */}
          <path
            d="M50 250 Q100 200 200 200 Q300 180 400 190 Q500 180 600 200 Q700 190 800 220 Q850 250 850 280 Q800 320 700 340 Q600 380 500 360 Q400 380 300 360 Q200 340 100 300 Q50 280 50 250 Z"
            fill="rgba(255,255,255,0.02)"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />

          {/* Country shapes */}
          {Object.entries(COUNTRY_PATHS).map(([code, { path }]) => {
            const hasData = !!spendingByCode[code];
            const isHovered = hoveredCountry === code;

            return (
              <path
                key={code}
                d={path}
                fill={getCountryColor(code)}
                stroke={
                  isHovered
                    ? "#fff"
                    : hasData
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(255,255,255,0.1)"
                }
                strokeWidth={isHovered ? 2 : 1}
                className="cursor-pointer transition-all duration-200"
                style={{
                  filter: isHovered
                    ? "brightness(1.3) drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))"
                    : "none",
                }}
                onMouseMove={(e) => handleMouseMove(e as any, code)}
                onMouseLeave={() => setHoveredCountry(null)}
                onClick={() => onCountryClick?.(code)}
              />
            );
          })}

          {/* Spending markers */}
          {spending.map((s) => {
            const pos = COUNTRY_MARKERS[s.countryCode];
            if (!pos) return null;

            const size = Math.max(
              4,
              Math.min(12, (s.total / maxSpending) * 12 + 4)
            );

            return (
              <g key={s.countryCode}>
                <circle
                  cx={pos[0]}
                  cy={pos[1]}
                  r={size}
                  fill="rgba(59, 130, 246, 0.6)"
                  stroke="white"
                  strokeWidth="1"
                  className="animate-pulse"
                />
                <circle
                  cx={pos[0]}
                  cy={pos[1]}
                  r={size + 4}
                  fill="none"
                  stroke="rgba(59, 130, 246, 0.3)"
                  strokeWidth="1"
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredData && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: Math.min(tooltipPos.x, 250),
              top: Math.max(tooltipPos.y, 0),
            }}
          >
            <div className="bg-slate-900/95 border border-blue-500/30 rounded-lg p-3 shadow-xl min-w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-white">
                  {hoveredData.countryName}
                </span>
              </div>
              {hoveredData.locationName && (
                <p className="text-xs text-slate-400 mb-2 ml-6">
                  {hoveredData.locationName}
                </p>
              )}
              <div className="text-xs text-blue-300 mb-2 bg-blue-500/10 px-2 py-1 rounded">
                📁 {hoveredData.accountName}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Spent:</span>
                  <span className="font-bold text-emerald-400">
                    ${hoveredData.total.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transactions:</span>
                  <span className="text-white">
                    {hoveredData.transactionCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg/Transaction:</span>
                  <span className="text-white">
                    ${hoveredData.avgPerTransaction.toFixed(0)}
                  </span>
                </div>
                {hoveredData.dates && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trip Dates:</span>
                    <span className="text-white">
                      {format(parseISO(hoveredData.dates.first), "MMM d")} -{" "}
                      {format(parseISO(hoveredData.dates.last), "MMM d, yy")}
                    </span>
                  </div>
                )}
              </div>
              {hoveredData.topCategories.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <span className="text-[10px] text-slate-500">
                    Top categories:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {hoveredData.topCategories.slice(0, 2).map((cat, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded"
                      >
                        {cat.category}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500/30" />
          <span className="text-[10px] text-slate-500">Low</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500/60" />
          <span className="text-[10px] text-slate-500">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-[10px] text-slate-500">High</span>
        </div>
      </div>

      {/* No data state */}
      {spending.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 rounded-xl">
          <Plane className="w-8 h-8 text-slate-600 mb-2" />
          <p className="text-slate-400 text-sm">
            No travel expenses tracked yet
          </p>
          <p className="text-slate-500 text-xs mt-1 text-center px-4">
            Create a trip account with a country code (e.g., "Trip - France"
            with FR)
          </p>
        </div>
      )}
    </div>
  );
});

// ==================== TRIP TIMELINE COMPONENT ====================

type Trip = {
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

type TripTimelineProps = {
  trips: Trip[];
  className?: string;
};

export const TripTimeline = memo(function TripTimeline({
  trips,
  className,
}: TripTimelineProps) {
  if (trips.length === 0) {
    return (
      <div className={cn("text-center py-6", className)}>
        <Plane className="w-6 h-6 text-slate-600 mx-auto mb-2" />
        <p className="text-slate-500 text-xs">No trips recorded</p>
        <p className="text-slate-600 text-[10px] mt-1">
          Create trip accounts with country codes
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {trips.slice(0, 5).map((trip, i) => (
        <div
          key={trip.accountId}
          className="relative flex items-start gap-3 pl-4"
        >
          {/* Timeline line */}
          {i < Math.min(trips.length, 5) - 1 && (
            <div className="absolute left-[7px] top-6 w-0.5 h-full bg-gradient-to-b from-blue-500/50 to-transparent" />
          )}

          {/* Timeline dot */}
          <div className="w-4 h-4 rounded-full bg-blue-500/30 border-2 border-blue-500 flex-shrink-0 mt-0.5" />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-white text-sm truncate">
                  {trip.accountName}
                </span>
              </div>
              <span className="text-sm font-bold text-emerald-400 flex-shrink-0">
                ${trip.totalSpent.toFixed(0)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                {trip.countryCode}
              </span>
              {trip.locationName && (
                <span className="text-[10px] text-slate-500">
                  {trip.locationName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
              <span>
                {format(parseISO(trip.startDate), "MMM d")} -{" "}
                {format(parseISO(trip.endDate), "MMM d, yy")}
              </span>
              <span>•</span>
              <span>
                {trip.duration} day{trip.duration > 1 ? "s" : ""}
              </span>
              <span>•</span>
              <span>{trip.transactionCount} tx</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

export default WorldMap;

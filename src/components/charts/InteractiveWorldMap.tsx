"use client";

import { cn } from "@/lib/utils";
import { type CountrySpending } from "@/lib/utils/comparisonAnalytics";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ChevronDown, Globe, MapPin, Plane } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

// GeoJSON URL for world map
const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country code to numeric ISO mapping (for matching with TopoJSON)
const COUNTRY_ISO_MAP: Record<string, string> = {
  "004": "AF",
  "008": "AL",
  "012": "DZ",
  "020": "AD",
  "024": "AO",
  "028": "AG",
  "032": "AR",
  "051": "AM",
  "036": "AU",
  "040": "AT",
  "031": "AZ",
  "044": "BS",
  "048": "BH",
  "050": "BD",
  "052": "BB",
  "112": "BY",
  "056": "BE",
  "084": "BZ",
  "204": "BJ",
  "064": "BT",
  "068": "BO",
  "070": "BA",
  "072": "BW",
  "076": "BR",
  "096": "BN",
  "100": "BG",
  "854": "BF",
  "108": "BI",
  "116": "KH",
  "120": "CM",
  "124": "CA",
  "132": "CV",
  "140": "CF",
  "148": "TD",
  "152": "CL",
  "156": "CN",
  "170": "CO",
  "174": "KM",
  "178": "CG",
  "188": "CR",
  "191": "HR",
  "192": "CU",
  "196": "CY",
  "203": "CZ",
  "208": "DK",
  "262": "DJ",
  "212": "DM",
  "214": "DO",
  "218": "EC",
  "818": "EG",
  "222": "SV",
  "226": "GQ",
  "232": "ER",
  "233": "EE",
  "231": "ET",
  "242": "FJ",
  "246": "FI",
  "250": "FR",
  "266": "GA",
  "270": "GM",
  "268": "GE",
  "276": "DE",
  "288": "GH",
  "300": "GR",
  "308": "GD",
  "320": "GT",
  "324": "GN",
  "624": "GW",
  "328": "GY",
  "332": "HT",
  "340": "HN",
  "348": "HU",
  "352": "IS",
  "356": "IN",
  "360": "ID",
  "364": "IR",
  "368": "IQ",
  "372": "IE",
  "376": "IL",
  "380": "IT",
  "388": "JM",
  "392": "JP",
  "400": "JO",
  "398": "KZ",
  "404": "KE",
  "296": "KI",
  "408": "KP",
  "410": "KR",
  "414": "KW",
  "417": "KG",
  "418": "LA",
  "428": "LV",
  "422": "LB",
  "426": "LS",
  "430": "LR",
  "434": "LY",
  "438": "LI",
  "440": "LT",
  "442": "LU",
  "807": "MK",
  "450": "MG",
  "454": "MW",
  "458": "MY",
  "462": "MV",
  "466": "ML",
  "470": "MT",
  "584": "MH",
  "478": "MR",
  "480": "MU",
  "484": "MX",
  "583": "FM",
  "498": "MD",
  "492": "MC",
  "496": "MN",
  "499": "ME",
  "504": "MA",
  "508": "MZ",
  "104": "MM",
  "516": "NA",
  "520": "NR",
  "524": "NP",
  "528": "NL",
  "554": "NZ",
  "558": "NI",
  "562": "NE",
  "566": "NG",
  "578": "NO",
  "512": "OM",
  "586": "PK",
  "585": "PW",
  "275": "PS",
  "591": "PA",
  "598": "PG",
  "600": "PY",
  "604": "PE",
  "608": "PH",
  "616": "PL",
  "620": "PT",
  "634": "QA",
  "642": "RO",
  "643": "RU",
  "646": "RW",
  "659": "KN",
  "662": "LC",
  "670": "VC",
  "882": "WS",
  "674": "SM",
  "678": "ST",
  "682": "SA",
  "686": "SN",
  "688": "RS",
  "690": "SC",
  "694": "SL",
  "702": "SG",
  "703": "SK",
  "705": "SI",
  "090": "SB",
  "706": "SO",
  "710": "ZA",
  "728": "SS",
  "724": "ES",
  "144": "LK",
  "729": "SD",
  "740": "SR",
  "748": "SZ",
  "752": "SE",
  "756": "CH",
  "760": "SY",
  "158": "TW",
  "762": "TJ",
  "834": "TZ",
  "764": "TH",
  "626": "TL",
  "768": "TG",
  "776": "TO",
  "780": "TT",
  "788": "TN",
  "792": "TR",
  "795": "TM",
  "798": "TV",
  "800": "UG",
  "804": "UA",
  "784": "AE",
  "826": "GB",
  "840": "US",
  "858": "UY",
  "860": "UZ",
  "548": "VU",
  "336": "VA",
  "862": "VE",
  "704": "VN",
  "887": "YE",
  "894": "ZM",
  "716": "ZW",
};

// Reverse mapping: ISO Alpha-2 to numeric
const ISO_TO_NUMERIC: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_ISO_MAP).map(([num, alpha]) => [alpha, num])
);

// Country center coordinates for zoom
const COUNTRY_CENTERS: Record<string, [number, number]> = {
  US: [-98, 39],
  CA: [-106, 56],
  MX: [-102, 23],
  BR: [-55, -10],
  AR: [-64, -34],
  GB: [-2, 54],
  FR: [2, 46],
  DE: [10, 51],
  IT: [12, 42],
  ES: [-4, 40],
  PT: [-8, 39],
  NL: [5, 52],
  BE: [4, 50],
  CH: [8, 47],
  AT: [14, 47],
  PL: [19, 52],
  RU: [100, 60],
  CN: [105, 35],
  JP: [138, 36],
  KR: [128, 36],
  IN: [78, 22],
  TH: [101, 15],
  VN: [108, 16],
  SG: [104, 1],
  ID: [120, -2],
  PH: [122, 12],
  AU: [134, -25],
  NZ: [174, -41],
  ZA: [25, -29],
  EG: [30, 27],
  AE: [54, 24],
  SA: [45, 24],
  TR: [35, 39],
  GR: [22, 39],
  IL: [35, 31],
  MA: [-6, 32],
  NG: [8, 10],
  KE: [38, 1],
  SE: [18, 62],
  NO: [10, 62],
  FI: [26, 64],
  DK: [10, 56],
  IE: [-8, 53],
  CZ: [15, 50],
  HU: [20, 47],
  RO: [25, 46],
  UA: [32, 49],
  LB: [35.5, 33.9],
};

type Transaction = {
  id: string;
  date: string;
  category: string | null;
  amount: number;
  description: string | null;
  category_color?: string;
};

type MapControlRef = {
  zoomToCountry: (code: string) => void;
  zoomOut: () => void;
} | null;

type InteractiveWorldMapProps = {
  spending: CountrySpending[];
  transactions?: Transaction[];
  onCountryClick?: (countryCode: string) => void;
  className?: string;
  zoomToCountryRef?: React.MutableRefObject<MapControlRef>;
};

export const InteractiveWorldMap = memo(function InteractiveWorldMap({
  spending,
  transactions = [],
  onCountryClick,
  className,
  zoomToCountryRef,
}: InteractiveWorldMapProps) {
  const [position, setPosition] = useState<{
    coordinates: [number, number];
    zoom: number;
  }>({
    coordinates: [32, 35], // Start centered on Lebanon/Middle East
    zoom: 5,
  });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<CountrySpending | null>(
    null
  );
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Aggregate spending by country code (merge multiple accounts with same country)
  const spendingByCode = useMemo(() => {
    const map: Record<string, CountrySpending & { accountIds: string[] }> = {};
    spending.forEach((s) => {
      if (!map[s.countryCode]) {
        map[s.countryCode] = {
          ...s,
          accountIds: [s.accountId],
        };
      } else {
        // Merge totals for same country
        map[s.countryCode].total += s.total;
        map[s.countryCode].transactionCount += s.transactionCount;
        map[s.countryCode].accountIds.push(s.accountId);
        // Recalculate average
        map[s.countryCode].avgPerTransaction =
          map[s.countryCode].total / map[s.countryCode].transactionCount;
      }
    });
    return map;
  }, [spending]);

  // Count unique countries
  const uniqueCountryCount = Object.keys(spendingByCode).length;

  const maxSpending = useMemo(() => {
    const totals = Object.values(spendingByCode).map((s) => s.total);
    return Math.max(...totals, 1);
  }, [spendingByCode]);

  // Get transactions for selected country
  const selectedCountryData = selectedCountry
    ? spendingByCode[selectedCountry]
    : null;
  const selectedCountryTransactions = useMemo(() => {
    if (!selectedCountryData) return [];
    // Filter transactions by ALL account_ids for this country
    const accountIds = selectedCountryData.accountIds || [
      selectedCountryData.accountId,
    ];
    return transactions.filter((t: any) => accountIds.includes(t.account_id));
  }, [selectedCountryData, transactions]);

  const getCountryColor = useCallback(
    (geoId: string) => {
      const alpha2 = COUNTRY_ISO_MAP[geoId];
      if (!alpha2) return "rgba(30, 41, 59, 0.6)"; // slate-800 for countries without data

      const data = spendingByCode[alpha2];
      if (!data) return "rgba(30, 41, 59, 0.6)"; // no spending data

      const intensity = Math.min(1, data.total / maxSpending);

      // Color scale from blue (low) -> cyan (medium) -> emerald (high)
      // Using solid, vibrant colors for countries with spending
      if (intensity < 0.33) {
        // Low spending - blue shades
        const opacity = 0.5 + intensity * 1.5;
        return `rgba(59, 130, 246, ${opacity})`; // blue-500
      } else if (intensity < 0.66) {
        // Medium spending - cyan shades
        const opacity = 0.6 + (intensity - 0.33) * 1.2;
        return `rgba(34, 211, 238, ${opacity})`; // cyan-400
      } else {
        // High spending - emerald/green shades
        const opacity = 0.7 + (intensity - 0.66) * 0.9;
        return `rgba(16, 185, 129, ${opacity})`; // emerald-500
      }
    },
    [spendingByCode, maxSpending]
  );

  const handleCountryClick = useCallback(
    (geo: any) => {
      const geoId = geo.id || geo.properties?.iso_a3_eh;
      const alpha2 = COUNTRY_ISO_MAP[geoId];

      if (!alpha2) return;

      const center = COUNTRY_CENTERS[alpha2];
      if (center && spendingByCode[alpha2]) {
        setPosition({
          coordinates: center,
          zoom: 4,
        });
        setSelectedCountry(alpha2);
        onCountryClick?.(alpha2);
      }
    },
    [spendingByCode, onCountryClick]
  );

  const handleReset = useCallback(() => {
    setPosition({ coordinates: [36, 33], zoom: 5 }); // Reset to Lebanon/Middle East view
    setSelectedCountry(null);
  }, []);

  // Zoom to a specific country
  const zoomToCountry = useCallback((countryCode: string) => {
    const center = COUNTRY_CENTERS[countryCode];
    if (center) {
      setPosition({
        coordinates: center,
        zoom: 12, // Close zoom to see the country clearly
      });
    }
  }, []);

  // Zoom out to default view
  const zoomOut = useCallback(() => {
    setPosition({ coordinates: [36, 33], zoom: 5 }); // Back to Middle East overview
  }, []);

  // Expose zoom controls via ref for external control
  if (zoomToCountryRef) {
    zoomToCountryRef.current = { zoomToCountry, zoomOut };
  }

  const handleMoveEnd = useCallback(
    (pos: { coordinates: [number, number]; zoom: number }) => {
      setPosition(pos);
    },
    []
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, geo: any) => {
      const geoId = geo.id || geo.properties?.iso_a3_eh;
      const alpha2 = COUNTRY_ISO_MAP[geoId];
      if (alpha2 && spendingByCode[alpha2]) {
        setHoveredCountry(alpha2);
        setTooltipContent(spendingByCode[alpha2]);
        setTooltipPos({ x: e.clientX, y: e.clientY });
      }
    },
    [spendingByCode]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredCountry(null);
    setTooltipContent(null);
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {selectedCountry ? (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to World</span>
            </button>
          ) : (
            <>
              <Globe className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">
                Travel Expenses Map
              </h3>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {selectedCountry && selectedCountryData ? (
            <span className="text-blue-400 font-medium">
              {selectedCountryData.countryName}
            </span>
          ) : (
            <>
              <span>
                {uniqueCountryCount} destination
                {uniqueCountryCount !== 1 ? "s" : ""}
              </span>
              <span>•</span>
              <span>
                $
                {Object.values(spendingByCode)
                  .reduce((sum, s) => sum + s.total, 0)
                  .toFixed(0)}{" "}
                total
              </span>
            </>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl overflow-hidden border border-slate-800/50">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 120,
            center: [0, 30],
          }}
          style={{
            width: "100%",
            height: selectedCountry ? "250px" : "320px",
          }}
        >
          <ZoomableGroup
            center={position.coordinates}
            zoom={position.zoom}
            onMoveEnd={handleMoveEnd}
            minZoom={1}
            maxZoom={20}
            translateExtent={[
              [-1000, -500],
              [1000, 500],
            ]}
            style={{
              transition: "all 0.5s ease-out",
            }}
          >
            {/* Ocean background */}
            <rect
              x={-1000}
              y={-1000}
              width={3000}
              height={3000}
              fill="#0f172a"
            />

            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo: any) => {
                  const geoId = geo.id;
                  const alpha2 = COUNTRY_ISO_MAP[geoId];
                  const isHovered = alpha2 === hoveredCountry;
                  const isSelected = alpha2 === selectedCountry;
                  const hasData = alpha2 && !!spendingByCode[alpha2];
                  const countryData = alpha2 ? spendingByCode[alpha2] : null;

                  // Calculate stroke color based on spending
                  let strokeColor = "rgba(148, 163, 184, 0.15)";
                  if (isSelected) {
                    strokeColor = "#22d3ee";
                  } else if (isHovered && hasData) {
                    strokeColor = "#60a5fa";
                  } else if (hasData) {
                    strokeColor = "rgba(255, 255, 255, 0.4)";
                  }

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryColor(geoId)}
                      stroke={strokeColor}
                      strokeWidth={
                        isSelected
                          ? 2
                          : isHovered && hasData
                            ? 1.5
                            : hasData
                              ? 0.8
                              : 0.2
                      }
                      style={{
                        default: {
                          outline: "none",
                          transition: "all 0.25s ease",
                          filter: hasData
                            ? "drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))"
                            : "none",
                        },
                        hover: {
                          fill: hasData
                            ? countryData &&
                              countryData.total / maxSpending > 0.66
                              ? "#10b981"
                              : countryData &&
                                  countryData.total / maxSpending > 0.33
                                ? "#22d3ee"
                                : "#3b82f6"
                            : "rgba(51, 65, 85, 0.9)",
                          outline: "none",
                          cursor: hasData ? "pointer" : "default",
                          filter: hasData
                            ? "drop-shadow(0 0 12px rgba(59, 130, 246, 0.5)) brightness(1.2)"
                            : "none",
                        },
                        pressed: {
                          fill: "#2563eb",
                          outline: "none",
                        },
                      }}
                      onMouseEnter={(e: React.MouseEvent<SVGPathElement>) =>
                        handleMouseEnter(e as any, geo)
                      }
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleCountryClick(geo)}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button
            onClick={() =>
              setPosition((p) => ({ ...p, zoom: Math.min(20, p.zoom * 1.5) }))
            }
            className="w-7 h-7 bg-slate-800/80 hover:bg-slate-700 rounded flex items-center justify-center text-white text-sm font-bold transition-colors"
          >
            +
          </button>
          <button
            onClick={() =>
              setPosition((p) => ({ ...p, zoom: Math.max(1, p.zoom / 1.5) }))
            }
            className="w-7 h-7 bg-slate-800/80 hover:bg-slate-700 rounded flex items-center justify-center text-white text-sm font-bold transition-colors"
          >
            −
          </button>
          <button
            onClick={handleReset}
            className="w-7 h-7 bg-slate-800/80 hover:bg-slate-700 rounded flex items-center justify-center text-slate-400 hover:text-white text-xs transition-colors mt-1"
            title="Reset view"
          >
            ⌂
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500/40" />
            <span className="text-[10px] text-slate-400">Low</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500/70" />
            <span className="text-[10px] text-slate-400">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-slate-400">High</span>
          </div>
        </div>

        {/* Tooltip */}
        {tooltipContent && !selectedCountry && (
          <div
            className="fixed z-[100] pointer-events-none transform -translate-x-1/2"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y - 120,
            }}
          >
            <div className="bg-slate-900/95 border border-blue-500/30 rounded-lg p-3 shadow-2xl min-w-[180px]">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-white text-sm">
                  {tooltipContent.countryName}
                </span>
              </div>
              {tooltipContent.locationName && (
                <p className="text-xs text-slate-400 mb-2 ml-5">
                  {tooltipContent.locationName}
                </p>
              )}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total:</span>
                  <span className="font-bold text-emerald-400">
                    ${tooltipContent.total.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transactions:</span>
                  <span className="text-white">
                    {tooltipContent.transactionCount}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-blue-400 mt-2 text-center">
                Click to see details
              </p>
            </div>
          </div>
        )}

        {/* No data overlay */}
        {spending.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
            <Plane className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm font-medium">
              No travel expenses tracked
            </p>
            <p className="text-slate-500 text-xs mt-1 text-center px-8">
              Create a trip account with a country code to start tracking
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

// Separate Trip Details Panel Component for placement on the right side
type TripDetailsPanelProps = {
  spending: CountrySpending[];
  transactions?: Transaction[];
  onZoomToCountry?: (countryCode: string) => void;
  onZoomOut?: () => void;
  className?: string;
};

// Group spending by country code (merge partner accounts)
type GroupedCountry = {
  countryCode: string;
  countryName: string;
  total: number;
  transactionCount: number;
  accounts: CountrySpending[];
};

export const TripDetailsPanel = memo(function TripDetailsPanel({
  spending,
  transactions = [],
  onZoomToCountry,
  onZoomOut,
  className,
}: TripDetailsPanelProps) {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  // Group spending by country code
  const groupedByCountry = useMemo(() => {
    const groups: Record<string, GroupedCountry> = {};

    spending.forEach((s) => {
      if (!groups[s.countryCode]) {
        groups[s.countryCode] = {
          countryCode: s.countryCode,
          countryName: s.countryName,
          total: 0,
          transactionCount: 0,
          accounts: [],
        };
      }
      groups[s.countryCode].total += s.total;
      groups[s.countryCode].transactionCount += s.transactionCount;
      groups[s.countryCode].accounts.push(s);
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [spending]);

  // Get transactions for a country (all accounts with that country code)
  const getCountryTransactions = useCallback(
    (countryCode: string) => {
      const accountIds = spending
        .filter((s) => s.countryCode === countryCode)
        .map((s) => s.accountId);
      return transactions.filter((t: any) => accountIds.includes(t.account_id));
    },
    [spending, transactions]
  );

  const handleCountryClick = useCallback(
    (countryCode: string) => {
      // Toggle expansion
      if (expandedCountry === countryCode) {
        setExpandedCountry(null);
        // Zoom out when deselecting
        onZoomOut?.();
      } else {
        setExpandedCountry(countryCode);
        // Zoom to country
        onZoomToCountry?.(countryCode);
      }
    },
    [expandedCountry, onZoomToCountry, onZoomOut]
  );

  if (groupedByCountry.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8",
          className
        )}
      >
        <Plane className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-slate-400 text-sm">No trip data</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Globe className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Trip Details</h3>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3 flex-shrink-0">
        <div className="bg-slate-800/30 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-white">
            {groupedByCountry.length}
          </p>
          <p className="text-[10px] text-slate-500">Countries</p>
        </div>
        <div className="bg-slate-800/30 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-emerald-400">
            ${groupedByCountry.reduce((sum, c) => sum + c.total, 0).toFixed(0)}
          </p>
          <p className="text-[10px] text-slate-500">Total Spent</p>
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-[10px] text-slate-500 mb-2 flex-shrink-0">
        {groupedByCountry.reduce((sum, c) => sum + c.transactionCount, 0)}{" "}
        transactions • {groupedByCountry.length} accounts
      </p>

      {/* Countries List - Scrollable area takes remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-2 scrollbar-thin space-y-2">
        {groupedByCountry.map((country) => {
          const isExpanded = expandedCountry === country.countryCode;
          const countryTx = getCountryTransactions(country.countryCode);

          return (
            <div
              key={country.countryCode}
              className="bg-slate-800/30 rounded-lg overflow-hidden"
            >
              {/* Country Header - Clickable to expand and zoom */}
              <button
                onClick={() => handleCountryClick(country.countryCode)}
                className="w-full flex items-center justify-between p-2.5 bg-gradient-to-r from-slate-800/50 to-slate-800/30 hover:from-blue-500/20 hover:to-cyan-500/10 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                      {country.countryName}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {country.transactionCount} transactions
                      {country.accounts.length > 1 &&
                        ` • ${country.accounts.length} accounts`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      ${country.total.toFixed(0)}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-slate-500 transition-transform duration-300",
                      isExpanded && "rotate-180"
                    )}
                  />
                </div>
              </button>

              {/* Expandable Transactions List */}
              <div
                className={cn(
                  "transition-all duration-300 ease-in-out",
                  isExpanded
                    ? "max-h-[500px] opacity-100 overflow-y-auto"
                    : "max-h-0 opacity-0 overflow-hidden"
                )}
              >
                <div className="px-2 pb-3 pt-1 space-y-1">
                  {countryTx
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .slice(0, 8)
                    .map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: tx.category_color || "#3b82f6",
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-300 truncate">
                              {tx.category || "Uncategorized"}
                            </p>
                            <p className="text-[9px] text-slate-600 truncate">
                              {format(parseISO(tx.date), "MMM d")}
                              {tx.description && ` • ${tx.description}`}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400 ml-2 flex-shrink-0">
                          ${tx.amount.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  {countryTx.length > 8 && (
                    <p className="text-[10px] text-slate-600 text-center pt-1">
                      +{countryTx.length - 8} more transactions
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default InteractiveWorldMap;

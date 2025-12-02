"use client";

import { cn } from "@/lib/utils";
import { memo, useEffect, useMemo, useRef, useState } from "react";

// ==================== ANIMATED VALUE HOOK ====================

function useAnimatedValue(targetValue: number, duration: number = 800) {
  const [value, setValue] = useState(targetValue);
  const prevValue = useRef(targetValue);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevValue.current;
    const endValue = targetValue;
    const startTime = performance.now();

    if (startValue === endValue) return;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutExpo = 1 - Math.pow(2, -10 * progress);

      const currentValue = startValue + (endValue - startValue) * easeOutExpo;
      setValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setValue(endValue);
        prevValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration]);

  return value;
}

// ==================== MINI LINE CHART ====================

type LineChartPoint = {
  label: string;
  value: number;
};

type MiniLineChartProps = {
  data: LineChartPoint[];
  height?: number;
  color?: string;
  gradientId?: string;
  showArea?: boolean;
  showDots?: boolean;
  showLabels?: boolean;
  className?: string;
};

export const MiniLineChart = memo(function MiniLineChart({
  data,
  height = 80,
  color = "#10b981",
  gradientId = "lineGradient",
  showArea = true,
  showDots = true,
  showLabels = false,
  className,
}: MiniLineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use a fixed viewBox width for consistent path calculations
  const viewBoxWidth = 300;

  const { points, areaPath, linePath, maxValue } = useMemo(() => {
    if (data.length === 0)
      return { points: [], areaPath: "", linePath: "", maxValue: 0 };

    const values = data.map((d) => d.value);
    const max = Math.max(...values, 1);
    const min = 0; // Start from 0 for better visualization

    const padding = 8;
    const topPadding = 20; // Space for tooltip
    const bottomPadding = showLabels ? 24 : 8;
    const chartHeight = height - topPadding - bottomPadding;

    const pts = data.map((d, i) => {
      const xPercent = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
      // Calculate actual x position for path (using viewBox coordinate system)
      const x = (xPercent / 100) * viewBoxWidth;
      const yValue = max > 0 ? d.value / max : 0;
      const y = topPadding + chartHeight * (1 - yValue);
      return {
        xPercent,
        x,
        y,
        ...d,
      };
    });

    // Create smooth curve using actual numeric values (not percentages)
    const linePathParts: string[] = [];

    if (pts.length === 1) {
      linePathParts.push(`M ${pts[0].x} ${pts[0].y}`);
    } else {
      pts.forEach((pt, i) => {
        if (i === 0) {
          linePathParts.push(`M ${pt.x} ${pt.y}`);
        } else {
          // Simple smooth curve
          const prev = pts[i - 1];
          const tension = 0.3;
          const cpX1 = prev.x + (pt.x - prev.x) * tension;
          const cpX2 = pt.x - (pt.x - prev.x) * tension;
          linePathParts.push(
            `C ${cpX1} ${prev.y} ${cpX2} ${pt.y} ${pt.x} ${pt.y}`
          );
        }
      });
    }

    const line = linePathParts.join(" ");
    const lastPt = pts[pts.length - 1];
    const firstPt = pts[0];
    const areaBottom = topPadding + chartHeight;
    const area =
      pts.length > 0
        ? `${line} L ${lastPt.x} ${areaBottom} L ${firstPt.x} ${areaBottom} Z`
        : "";

    return { points: pts, areaPath: area, linePath: line, maxValue: max };
  }, [data, height, showLabels, viewBoxWidth]);

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-slate-500 text-xs",
          className
        )}
        style={{ height }}
      >
        No data
      </div>
    );
  }

  return (
    <div
      className={cn("relative", className)}
      style={{ height }}
      ref={containerRef}
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${viewBoxWidth} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {showArea && <path d={areaPath} fill={`url(#${gradientId})`} />}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Interactive hover areas (larger than visible dots) */}
        {points.map((pt, i) => (
          <circle
            key={`hover-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={16}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* Visible dots */}
        {showDots &&
          points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={hoveredIndex === i ? 6 : 4}
              fill={hoveredIndex === i ? "#fff" : color}
              stroke={color}
              strokeWidth={hoveredIndex === i ? 2 : 0}
              className="transition-all duration-150"
            />
          ))}
      </svg>

      {/* Tooltip - rendered outside SVG for better positioning */}
      {hoveredPoint && (
        <div
          className="absolute z-50 pointer-events-none transform -translate-x-1/2"
          style={{
            left: `${hoveredPoint.xPercent}%`,
            top: Math.max(0, hoveredPoint.y - 36),
          }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 shadow-xl">
            <p className="text-xs font-bold text-white">
              ${hoveredPoint.value.toFixed(0)}
            </p>
            <p className="text-[10px] text-slate-400">{hoveredPoint.label}</p>
          </div>
        </div>
      )}

      {/* Labels */}
      {showLabels && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-slate-500 px-1">
          <span>{data[0]?.label}</span>
          <span>{data[data.length - 1]?.label}</span>
        </div>
      )}
    </div>
  );
});

// ==================== ANIMATED BAR ====================

const AnimatedBar = memo(function AnimatedBar({
  targetHeight,
  color,
  isHovered,
  showValue,
  value,
}: {
  targetHeight: number;
  color: string;
  isHovered: boolean;
  showValue: boolean;
  value: number;
}) {
  const animatedHeight = useAnimatedValue(targetHeight, 600);
  const animatedValue = useAnimatedValue(value, 600);

  return (
    <>
      {showValue && isHovered && (
        <span className="text-[10px] text-white bg-black/80 px-1.5 py-0.5 rounded tabular-nums">
          ${animatedValue.toFixed(0)}
        </span>
      )}
      <div
        className="w-full rounded-t-md transition-colors duration-300"
        style={{
          height: `${Math.max(4, animatedHeight)}%`,
          backgroundColor: color,
          opacity: isHovered ? 1 : 0.7,
        }}
      />
    </>
  );
});

// ==================== MINI BAR CHART ====================

type BarChartPoint = {
  label: string;
  value: number;
  color?: string;
};

type MiniBarChartProps = {
  data: BarChartPoint[];
  height?: number;
  defaultColor?: string;
  showLabels?: boolean;
  showValues?: boolean;
  horizontal?: boolean;
  className?: string;
};

export const MiniBarChart = memo(function MiniBarChart({
  data,
  height = 100,
  defaultColor = "#3b82f6",
  showLabels = true,
  showValues = true,
  horizontal = false,
  className,
}: MiniBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = useMemo(
    () => Math.max(...data.map((d) => d.value), 1),
    [data]
  );

  if (horizontal) {
    return (
      <div className={cn("space-y-2", className)}>
        {data.map((item, i) => {
          const percentage = (item.value / maxValue) * 100;
          const isHovered = hoveredIndex === i;
          return (
            <HorizontalAnimatedBar
              key={i}
              item={item}
              percentage={percentage}
              isHovered={isHovered}
              showValues={showValues}
              defaultColor={defaultColor}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-end justify-between gap-1", className)}
      style={{ height }}
    >
      {data.map((item, i) => {
        const percentage = (item.value / maxValue) * 100;
        const isHovered = hoveredIndex === i;
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <AnimatedBar
              targetHeight={percentage}
              color={item.color || defaultColor}
              isHovered={isHovered}
              showValue={showValues}
              value={item.value}
            />
            {showLabels && (
              <span className="text-[9px] text-slate-500 truncate max-w-full">
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

// Horizontal bar with animation
const HorizontalAnimatedBar = memo(function HorizontalAnimatedBar({
  item,
  percentage,
  isHovered,
  showValues,
  defaultColor,
  onMouseEnter,
  onMouseLeave,
}: {
  item: BarChartPoint;
  percentage: number;
  isHovered: boolean;
  showValues: boolean;
  defaultColor: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const animatedPercentage = useAnimatedValue(percentage, 600);
  const animatedValue = useAnimatedValue(item.value, 600);

  return (
    <div
      className="group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-300 truncate max-w-[120px]">
          {item.label}
        </span>
        {showValues && (
          <span className="text-slate-400 font-medium tabular-nums">
            ${animatedValue.toFixed(0)}
          </span>
        )}
      </div>
      <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-colors duration-300"
          style={{
            width: `${animatedPercentage}%`,
            backgroundColor: item.color || defaultColor,
            opacity: isHovered ? 1 : 0.8,
          }}
        />
      </div>
    </div>
  );
});

// ==================== COMPARISON BAR ====================

type ComparisonBarProps = {
  current: number;
  previous: number;
  currentLabel?: string;
  previousLabel?: string;
  currentColor?: string;
  previousColor?: string;
  height?: number;
  className?: string;
};

export const ComparisonBar = memo(function ComparisonBar({
  current,
  previous,
  currentLabel = "Current",
  previousLabel = "Previous",
  currentColor = "#10b981",
  previousColor = "#6b7280",
  height = 12,
  className,
}: ComparisonBarProps) {
  const maxValue = Math.max(current, previous, 1);

  // Animate values
  const animatedCurrent = useAnimatedValue(current, 800);
  const animatedPrevious = useAnimatedValue(previous, 800);

  const currentPct = (animatedCurrent / maxValue) * 100;
  const previousPct = (animatedPrevious / maxValue) * 100;
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const animatedChange = useAnimatedValue(change, 800);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 w-16">{currentLabel}</span>
        <div
          className="flex-1 bg-slate-800/50 rounded-full overflow-hidden"
          style={{ height }}
        >
          <div
            className="h-full rounded-full transition-colors duration-300"
            style={{ width: `${currentPct}%`, backgroundColor: currentColor }}
          />
        </div>
        <span
          className="text-xs font-semibold w-16 text-right tabular-nums"
          style={{ color: currentColor }}
        >
          ${animatedCurrent.toFixed(0)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 w-16">{previousLabel}</span>
        <div
          className="flex-1 bg-slate-800/50 rounded-full overflow-hidden"
          style={{ height }}
        >
          <div
            className="h-full rounded-full transition-colors duration-300"
            style={{ width: `${previousPct}%`, backgroundColor: previousColor }}
          />
        </div>
        <span className="text-xs font-semibold w-16 text-right text-slate-400 tabular-nums">
          ${animatedPrevious.toFixed(0)}
        </span>
      </div>
      <div className="text-right">
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            change > 5
              ? "text-red-400"
              : change < -5
                ? "text-emerald-400"
                : "text-slate-400"
          )}
        >
          {animatedChange >= 0 ? "+" : ""}
          {animatedChange.toFixed(1)}%
        </span>
      </div>
    </div>
  );
});

// ==================== SPARKLINE ====================

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
};

export const Sparkline = memo(function Sparkline({
  values,
  width = 80,
  height = 24,
  color = "#10b981",
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  const path = useMemo(() => {
    if (values.length < 2) return "";

    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const points = values.map((v, i) => ({
      x: (i / (values.length - 1)) * width,
      y: height - ((v - min) / range) * height * 0.9 - height * 0.05,
    }));

    return points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
  }, [values, width, height]);

  const trend = values.length >= 2 ? values[values.length - 1] - values[0] : 0;

  return (
    <svg width={width} height={height} className={className}>
      <path
        d={path}
        fill="none"
        stroke={trend >= 0 ? color : "#ef4444"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

// ==================== DONUT CHART ====================

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
};

// Animated segment component
const AnimatedDonutSegment = memo(function AnimatedDonutSegment({
  segment,
  center,
  thickness,
  isHovered,
  isOtherHovered,
  onMouseEnter,
  onMouseLeave,
}: {
  segment: {
    label: string;
    value: number;
    color: string;
    percentage: number;
    length: number;
    offset: number;
    radius: number;
  };
  center: number;
  thickness: number;
  isHovered: boolean;
  isOtherHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const animatedLength = useAnimatedValue(segment.length, 600);
  const animatedOffset = useAnimatedValue(segment.offset, 600);

  return (
    <circle
      cx={center}
      cy={center}
      r={segment.radius}
      fill="none"
      stroke={segment.color}
      strokeWidth={thickness}
      strokeDasharray={`${animatedLength} ${2 * Math.PI * segment.radius}`}
      strokeDashoffset={-animatedOffset}
      strokeLinecap="round"
      transform={`rotate(-90 ${center} ${center})`}
      className="transition-opacity duration-300"
      style={{
        opacity: !isOtherHovered || isHovered ? 1 : 0.4,
        filter: isHovered ? "brightness(1.2)" : "none",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
});

export const DonutChart = memo(function DonutChart({
  data,
  size = 120,
  thickness = 16,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { segments, total } = useMemo(() => {
    const t = data.reduce((sum, d) => sum + d.value, 0);
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;

    let currentOffset = 0;
    const segs = data.map((d, i) => {
      const percentage = t > 0 ? d.value / t : 0;
      const length = percentage * circumference;
      const gap = 2;
      const offset = currentOffset;
      currentOffset += length + gap;

      return {
        ...d,
        percentage,
        length: Math.max(0, length - gap),
        offset,
        radius,
      };
    });

    return { segments: segs, total: t };
  }, [data, size, thickness]);

  const center = size / 2;

  // Animate center value
  const animatedTotal = useAnimatedValue(total, 600);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={(size - thickness) / 2}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={thickness}
        />

        {/* Segments */}
        {segments.map((seg, i) => (
          <AnimatedDonutSegment
            key={i}
            segment={seg}
            center={center}
            thickness={thickness}
            isHovered={hoveredIndex === i}
            isOtherHovered={hoveredIndex !== null}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {hoveredIndex !== null ? (
          <>
            <span className="text-xs text-slate-400 truncate max-w-[60px]">
              {segments[hoveredIndex].label}
            </span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: segments[hoveredIndex].color }}
            >
              ${segments[hoveredIndex].value.toFixed(0)}
            </span>
          </>
        ) : (
          <>
            {centerLabel && (
              <span className="text-xs text-slate-400">{centerLabel}</span>
            )}
            {centerValue ? (
              <span className="text-lg font-bold text-white tabular-nums">
                {centerValue}
              </span>
            ) : (
              <span className="text-lg font-bold text-white tabular-nums">
                ${animatedTotal.toFixed(0)}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
});

// ==================== AREA CHART ====================

type AreaChartPoint = {
  label: string;
  value1: number;
  value2?: number;
};

type DualAreaChartProps = {
  data: AreaChartPoint[];
  height?: number;
  color1?: string;
  color2?: string;
  label1?: string;
  label2?: string;
  className?: string;
};

export const DualAreaChart = memo(function DualAreaChart({
  data,
  height = 120,
  color1 = "#10b981",
  color2 = "#ef4444",
  label1 = "Series 1",
  label2 = "Series 2",
  className,
}: DualAreaChartProps) {
  const hasSecondSeries = data.some((d) => d.value2 !== undefined);

  const { path1, area1, path2, area2 } = useMemo(() => {
    if (data.length === 0)
      return { path1: "", area1: "", path2: "", area2: "" };

    const allValues = data.flatMap((d) => [d.value1, d.value2 ?? 0]);
    const max = Math.max(...allValues, 1);
    const width = 100;
    const h = height - 20;

    const getY = (v: number) => h - (v / max) * (h - 10) + 5;
    const getX = (i: number) => (i / Math.max(1, data.length - 1)) * width;

    const buildPath = (getValue: (d: AreaChartPoint) => number) => {
      const pts = data.map((d, i) => ({ x: getX(i), y: getY(getValue(d)) }));
      const pathParts: string[] = [];
      pts.forEach((pt, i) => {
        if (i === 0) pathParts.push(`M ${pt.x} ${pt.y}`);
        else pathParts.push(`L ${pt.x} ${pt.y}`);
      });
      const path = pathParts.join(" ");
      const area = `${path} L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z`;
      return { path, area };
    };

    const series1 = buildPath((d) => d.value1);
    const series2 = hasSecondSeries
      ? buildPath((d) => d.value2 ?? 0)
      : { path: "", area: "" };

    return {
      path1: series1.path,
      area1: series1.area,
      path2: series2.path,
      area2: series2.area,
    };
  }, [data, height, hasSecondSeries]);

  return (
    <div className={cn("relative", className)}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="areaGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color1} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color1} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="areaGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color2} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color2} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {hasSecondSeries && (
          <>
            <path d={area2} fill="url(#areaGrad2)" />
            <path d={path2} fill="none" stroke={color2} strokeWidth="1.5" />
          </>
        )}
        <path d={area1} fill="url(#areaGrad1)" />
        <path d={path1} fill="none" stroke={color1} strokeWidth="2" />
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color1 }}
          />
          <span className="text-[10px] text-slate-400">{label1}</span>
        </div>
        {hasSecondSeries && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color2 }}
            />
            <span className="text-[10px] text-slate-400">{label2}</span>
          </div>
        )}
      </div>
    </div>
  );
});

// ==================== GAUGE CHART ====================

type GaugeChartProps = {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  thickness?: number;
  color?: string;
  bgColor?: string;
  className?: string;
};

export const GaugeChart = memo(function GaugeChart({
  value,
  max = 100,
  label,
  size = 100,
  thickness = 10,
  color = "#10b981",
  bgColor = "rgba(255,255,255,0.1)",
  className,
}: GaugeChartProps) {
  const percentage = Math.min(100, (value / max) * 100);
  const radius = (size - thickness) / 2;
  const circumference = Math.PI * radius; // Half circle
  const dashLength = (percentage / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex flex-col items-center", className)}
    >
      <svg
        width={size}
        height={size / 2 + 10}
        viewBox={`0 0 ${size} ${size / 2 + 10}`}
      >
        {/* Background arc */}
        <path
          d={`M ${thickness / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - thickness / 2} ${size / 2}`}
          fill="none"
          stroke={bgColor}
          strokeWidth={thickness}
          strokeLinecap="round"
        />

        {/* Value arc */}
        <path
          d={`M ${thickness / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - thickness / 2} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dashLength} ${circumference}`}
          className="transition-all duration-500"
        />
      </svg>

      {/* Center value */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <span className="text-xl font-bold" style={{ color }}>
          {value.toFixed(0)}
        </span>
        {label && <p className="text-[10px] text-slate-500">{label}</p>}
      </div>
    </div>
  );
});

// =============================================================================
// XENOCARE EMR - Advanced 3D Charts Library
// Professional chart components with 3D effects and chart-friendly colors
// =============================================================================

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';

// =============================================================================
// Chart-Friendly Color Palettes (Professional & Accessible)
// =============================================================================

export const chartColors = {
  // Primary palette - vibrant but professional
  primary: [
    '#2563EB', // Blue
    '#10B981', // Emerald
    '#8B5CF6', // Violet
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#EF4444', // Red
    '#84CC16', // Lime
  ],
  // Financial palette
  financial: {
    cash: '#10B981', // Green
    nhis: '#3B82F6', // Blue
    insurance: '#8B5CF6', // Purple
    corporate: '#F59E0B', // Amber
    pos: '#06B6D4', // Cyan
    transfer: '#EC4899', // Pink
    retainership: '#6366F1', // Indigo
  },
  // Status colors
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  },
  // Gradient pairs for 3D effects
  gradients: {
    blue: ['#3B82F6', '#1D4ED8'],
    green: ['#10B981', '#059669'],
    purple: ['#8B5CF6', '#7C3AED'],
    amber: ['#F59E0B', '#D97706'],
    pink: ['#EC4899', '#DB2777'],
    cyan: ['#06B6D4', '#0891B2'],
    red: ['#EF4444', '#DC2626'],
    indigo: ['#6366F1', '#4F46E5'],
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

export const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `NGN ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `NGN ${(value / 1000).toFixed(0)}K`;
  return `NGN ${value.toLocaleString()}`;
};

export const formatNumber = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
};

// =============================================================================
// 3D Bar Chart Component
// =============================================================================

interface Bar3DChartProps {
  data: { label: string; value: number; color?: string }[];
  title: string;
  subtitle?: string;
  height?: number;
  formatValue?: (value: number) => string;
  onBarClick?: (item: { label: string; value: number }) => void;
  selectedBar?: string | null;
  showBreakdown?: boolean;
  breakdownData?: {
    [key: string]: { label: string; value: number; color: string }[];
  };
}

export function Bar3DChart({
  data,
  title,
  subtitle,
  height = 280,
  formatValue = formatNumber,
  onBarClick,
  selectedBar,
  showBreakdown = false,
  breakdownData,
}: Bar3DChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      <div
        style={{ height }}
        className="flex items-end justify-between gap-2 px-4"
      >
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 60);
          const color =
            item.color ||
            chartColors.primary[index % chartColors.primary.length];
          const isSelected = selectedBar === item.label;
          const isHovered = hoveredBar === item.label;

          return (
            <div
              key={item.label}
              className="flex flex-col items-center flex-1 max-w-[80px]"
              onMouseEnter={() => setHoveredBar(item.label)}
              onMouseLeave={() => setHoveredBar(null)}
            >
              {/* Value label */}
              <span
                className={`text-xs font-medium mb-2 transition-all ${
                  isHovered || isSelected
                    ? 'text-gray-900 scale-110'
                    : 'text-gray-600'
                }`}
              >
                {formatValue(item.value)}
              </span>

              {/* 3D Bar */}
              <div
                onClick={() => onBarClick?.(item)}
                className={`relative w-full cursor-pointer transition-all duration-300 ${
                  isHovered || isSelected ? 'transform -translate-y-1' : ''
                }`}
                style={{ height: Math.max(barHeight, 4) }}
              >
                {/* Main bar face */}
                <div
                  className="absolute inset-0 rounded-t-lg"
                  style={{
                    background: `linear-gradient(180deg, ${color} 0%, ${adjustColor(color, -30)} 100%)`,
                    boxShadow: isSelected
                      ? `0 8px 25px -5px ${color}60, 0 0 0 3px ${color}40`
                      : isHovered
                        ? `0 4px 15px -3px ${color}50`
                        : `0 2px 8px -2px ${color}30`,
                  }}
                />
                {/* 3D right side effect */}
                <div
                  className="absolute top-0 right-0 w-2 h-full rounded-tr-lg"
                  style={{
                    background: `linear-gradient(180deg, ${adjustColor(color, -20)} 0%, ${adjustColor(color, -50)} 100%)`,
                    transform: 'skewY(-45deg)',
                    transformOrigin: 'top right',
                  }}
                />
                {/* 3D top face */}
                <div
                  className="absolute -top-1.5 left-0 right-0 h-3 rounded-t-lg"
                  style={{
                    background: `linear-gradient(90deg, ${adjustColor(color, 20)} 0%, ${color} 50%, ${adjustColor(color, -20)} 100%)`,
                    transform: 'perspective(50px) rotateX(30deg)',
                  }}
                />
              </div>

              {/* Label */}
              <span
                className={`text-xs mt-3 text-center truncate w-full transition-colors ${
                  isSelected ? 'text-gray-900 font-semibold' : 'text-gray-500'
                }`}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Breakdown section when bar is selected */}
      {showBreakdown && selectedBar && breakdownData?.[selectedBar] && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Breakdown for {selectedBar}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {breakdownData[selectedBar].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-50"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 truncate">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatValue(item.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 3D Pie/Donut Chart Component
// =============================================================================

interface Pie3DChartProps {
  data: { label: string; value: number; color?: string }[];
  title: string;
  subtitle?: string;
  size?: number;
  donut?: boolean;
  showLegend?: boolean;
  onSegmentClick?: (item: { label: string; value: number }) => void;
}

export function Pie3DChart({
  data,
  title,
  subtitle,
  size = 200,
  donut = true,
  showLegend = true,
  onSegmentClick,
}: Pie3DChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Calculate segments
  const segments = useMemo(() => {
    let currentAngle = -90;
    return data.map((item, index) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;

      return {
        ...item,
        color:
          item.color || chartColors.primary[index % chartColors.primary.length],
        percentage,
        startAngle,
        endAngle: startAngle + angle,
      };
    });
  }, [data, total]);

  const createArcPath = (
    startAngle: number,
    endAngle: number,
    radius: number,
    innerRadius: number = 0,
  ) => {
    const start = polarToCartesian(size / 2, size / 2, radius, endAngle);
    const end = polarToCartesian(size / 2, size / 2, radius, startAngle);
    const innerStart = polarToCartesian(
      size / 2,
      size / 2,
      innerRadius,
      endAngle,
    );
    const innerEnd = polarToCartesian(
      size / 2,
      size / 2,
      innerRadius,
      startAngle,
    );
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

    if (innerRadius > 0) {
      return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerStart.x} ${innerStart.y} Z`;
    }
    return `M ${size / 2} ${size / 2} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };

  const radius = size / 2 - 10;
  const innerRadius = donut ? radius * 0.55 : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-6">
        {/* Chart */}
        <div className="relative" style={{ width: size, height: size }}>
          {/* 3D shadow/depth effect */}
          <svg
            width={size}
            height={size}
            className="absolute"
            style={{ top: 6, filter: 'blur(4px)', opacity: 0.3 }}
          >
            {segments.map((segment, index) => (
              <path
                key={`shadow-${index}`}
                d={createArcPath(
                  segment.startAngle,
                  segment.endAngle,
                  radius,
                  innerRadius,
                )}
                fill="#000"
              />
            ))}
          </svg>

          {/* Main chart */}
          <svg width={size} height={size} className="relative">
            <defs>
              {segments.map((segment, index) => (
                <linearGradient
                  key={`gradient-${index}`}
                  id={`pie-gradient-${index}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stopColor={adjustColor(segment.color, 20)}
                  />
                  <stop
                    offset="100%"
                    stopColor={adjustColor(segment.color, -20)}
                  />
                </linearGradient>
              ))}
            </defs>

            {segments.map((segment, index) => {
              const isHovered = hoveredSegment === segment.label;
              const scale = isHovered ? 1.05 : 1;

              return (
                <g
                  key={index}
                  className="cursor-pointer transition-transform duration-200"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: `${size / 2}px ${size / 2}px`,
                  }}
                  onMouseEnter={() => setHoveredSegment(segment.label)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  onClick={() => onSegmentClick?.(segment)}
                >
                  <path
                    d={createArcPath(
                      segment.startAngle,
                      segment.endAngle,
                      radius,
                      innerRadius,
                    )}
                    fill={`url(#pie-gradient-${index})`}
                    stroke="white"
                    strokeWidth={2}
                    style={{
                      filter: isHovered
                        ? `drop-shadow(0 4px 8px ${segment.color}50)`
                        : 'none',
                    }}
                  />
                </g>
              );
            })}

            {/* Center text for donut */}
            {donut && (
              <g>
                <text
                  x={size / 2}
                  y={size / 2 - 8}
                  textAnchor="middle"
                  className="text-2xl font-bold fill-gray-900"
                >
                  {formatNumber(total)}
                </text>
                <text
                  x={size / 2}
                  y={size / 2 + 12}
                  textAnchor="middle"
                  className="text-xs fill-gray-500"
                >
                  Total
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex-1 space-y-2 max-h-[200px] overflow-y-auto">
            {segments.map((segment, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  hoveredSegment === segment.label
                    ? 'bg-gray-100'
                    : 'hover:bg-gray-50'
                }`}
                onMouseEnter={() => setHoveredSegment(segment.label)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => onSegmentClick?.(segment)}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${adjustColor(segment.color, 20)} 0%, ${segment.color} 100%)`,
                    boxShadow: `0 2px 4px ${segment.color}30`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {segment.label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatNumber(segment.value)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {segment.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 3D Area Chart Component
// =============================================================================

interface Area3DChartProps {
  data: { label: string; value: number }[];
  title: string;
  subtitle?: string;
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
  trend?: { value: number; period: string };
  onPointClick?: (
    item: { label: string; value: number },
    index: number,
  ) => void;
}

export function Area3DChart({
  data,
  title,
  subtitle,
  height = 200,
  color = '#3B82F6',
  formatValue = formatNumber,
  trend,
  onPointClick,
}: Area3DChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
        <div className="flex items-center justify-center h-40 text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value));
  const chartHeight = height - 60;

  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y:
      chartHeight -
      ((d.value - minValue) / (maxValue - minValue || 1)) * chartHeight,
    ...d,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}`)
    .join(' ');
  const areaD = `${pathD} L 100% ${chartHeight} L 0% ${chartHeight} Z`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
              trend.value >= 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {trend.value >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="font-medium">{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      <div style={{ height }} className="relative">
        <svg width="100%" height={height - 20} className="overflow-visible">
          <defs>
            <linearGradient
              id={`area-gradient-${title.replace(/\s/g, '')}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
            <filter id="area-shadow">
              <feDropShadow
                dx="0"
                dy="4"
                stdDeviation="4"
                floodColor={color}
                floodOpacity="0.3"
              />
            </filter>
          </defs>

          {/* Grid lines */}
          <g className="text-gray-200">
            {[0, 25, 50, 75, 100].map((pct) => (
              <line
                key={pct}
                x1="0%"
                y1={chartHeight * (pct / 100)}
                x2="100%"
                y2={chartHeight * (pct / 100)}
                stroke="currentColor"
                strokeDasharray="4 4"
              />
            ))}
          </g>

          {/* Area fill with 3D effect */}
          <path
            d={areaD}
            fill={`url(#area-gradient-${title.replace(/\s/g, '')})`}
            style={{ filter: 'url(#area-shadow)' }}
          />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((point, index) => (
            <g
              key={index}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredPoint(index)}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={() => onPointClick?.(data[index], index)}
            >
              <circle
                cx={`${point.x}%`}
                cy={point.y}
                r={hoveredPoint === index ? 8 : 5}
                fill="white"
                stroke={color}
                strokeWidth={3}
                className="transition-all duration-200"
                style={{
                  filter:
                    hoveredPoint === index
                      ? `drop-shadow(0 4px 8px ${color}50)`
                      : 'none',
                }}
              />

              {/* Tooltip */}
              {hoveredPoint === index && (
                <g>
                  <rect
                    x={`${Math.min(Math.max(point.x - 12, 2), 76)}%`}
                    y={Math.max(point.y - 50, 5)}
                    width="24%"
                    height="40"
                    rx="6"
                    fill="white"
                    stroke={color}
                    strokeWidth={1}
                    style={{
                      filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
                    }}
                  />
                  <text
                    x={`${point.x}%`}
                    y={Math.max(point.y - 32, 22)}
                    textAnchor="middle"
                    className="text-xs font-semibold fill-gray-900"
                  >
                    {formatValue(point.value)}
                  </text>
                  <text
                    x={`${point.x}%`}
                    y={Math.max(point.y - 18, 36)}
                    textAnchor="middle"
                    className="text-xs fill-gray-500"
                  >
                    {point.label}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
          {data
            .filter(
              (_, i) =>
                i % Math.ceil(data.length / 7) === 0 || i === data.length - 1,
            )
            .map((d, i) => (
              <span key={i} className="text-xs text-gray-500">
                {d.label}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// KPI Card Component
// =============================================================================

interface KPICardProps {
  title: string;
  value: number;
  format?: 'number' | 'currency' | 'percentage';
  trend?: { value: number; period: string };
  icon?: React.ReactNode;
  color?:
    | 'blue'
    | 'green'
    | 'purple'
    | 'yellow'
    | 'red'
    | 'cyan'
    | 'pink'
    | 'indigo';
  subtitle?: string;
  sparklineData?: number[];
}

const kpiColorMap = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    gradient: 'from-blue-500 to-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
    gradient: 'from-green-500 to-green-600',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
    gradient: 'from-purple-500 to-purple-600',
  },
  yellow: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    gradient: 'from-amber-500 to-amber-600',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    gradient: 'from-red-500 to-red-600',
  },
  cyan: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-600',
    border: 'border-cyan-200',
    gradient: 'from-cyan-500 to-cyan-600',
  },
  pink: {
    bg: 'bg-pink-50',
    text: 'text-pink-600',
    border: 'border-pink-200',
    gradient: 'from-pink-500 to-pink-600',
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    border: 'border-indigo-200',
    gradient: 'from-indigo-500 to-indigo-600',
  },
};

export function KPICard({
  title,
  value,
  format = 'number',
  trend,
  icon,
  color = 'blue',
  subtitle,
  sparklineData,
}: KPICardProps) {
  const formattedValue = useMemo(() => {
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return `${value}%`;
      default:
        return formatNumber(value);
    }
  }, [value, format]);

  return (
    <div className="min-h-[104px] rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-1 whitespace-nowrap font-display text-xl font-bold tabular-nums text-slate-900">
        {formattedValue}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      {trend && (
        <p
          className={`mt-1 text-xs font-medium ${
            trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {Math.abs(trend.value)}% {trend.period}
        </p>
      )}
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-3 h-8">
          <MiniSparkline data={sparklineData} color={color} />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Mini Sparkline
// =============================================================================

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const colorHex =
    chartColors.gradients[color as keyof typeof chartColors.gradients]?.[0] ||
    '#3B82F6';

  const points = data.map((value, index) => ({
    x: (index / (data.length - 1)) * 100,
    y: 28 - ((value - min) / range) * 24,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <svg width="100%" height="28" className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colorHex} stopOpacity={0.3} />
          <stop offset="100%" stopColor={colorHex} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${pathD} L 100 28 L 0 28 Z`} fill={`url(#spark-${color})`} />
      <path
        d={pathD}
        fill="none"
        stroke={colorHex}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

// =============================================================================
// Revenue Filter Chart
// =============================================================================

interface RevenueFilterChartProps {
  data: {
    period: string;
    cash?: number;
    nhis?: number;
    insurance?: number;
    corporate?: number;
    pos?: number;
    transfer?: number;
    retainership?: number;
  }[];
  title: string;
  subtitle?: string;
  height?: number;
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
  onPeriodClick?: (period: string) => void;
}

const revenueCategories = [
  { key: 'cash', label: 'Cash', color: chartColors.financial.cash },
  { key: 'nhis', label: 'NHIS', color: chartColors.financial.nhis },
  {
    key: 'insurance',
    label: 'Insurance',
    color: chartColors.financial.insurance,
  },
  {
    key: 'corporate',
    label: 'Corporate',
    color: chartColors.financial.corporate,
  },
  { key: 'pos', label: 'POS', color: chartColors.financial.pos },
  { key: 'transfer', label: 'Transfer', color: chartColors.financial.transfer },
  {
    key: 'retainership',
    label: 'Retainership',
    color: chartColors.financial.retainership,
  },
];

export function RevenueFilterChart({
  data,
  title,
  subtitle,
  height = 300,
  activeFilters,
  onFilterChange,
  onPeriodClick,
}: RevenueFilterChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  const toggleFilter = (key: string) => {
    if (activeFilters.includes(key)) {
      onFilterChange(activeFilters.filter((f) => f !== key));
    } else {
      onFilterChange([...activeFilters, key]);
    }
  };

  const maxValue = useMemo(() => {
    let max = 0;
    data.forEach((d) => {
      const sum = activeFilters.reduce(
        (acc, key) => acc + ((d as any)[key] || 0),
        0,
      );
      if (sum > max) max = sum;
    });
    return max || 1;
  }, [data, activeFilters]);

  const handlePeriodClick = (period: string) => {
    setSelectedPeriod(period === selectedPeriod ? null : period);
    onPeriodClick?.(period);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {revenueCategories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => toggleFilter(cat.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeFilters.includes(cat.key)
                ? 'text-white shadow-md'
                : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
            style={{
              backgroundColor: activeFilters.includes(cat.key)
                ? cat.color
                : undefined,
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: activeFilters.includes(cat.key)
                  ? 'white'
                  : cat.color,
              }}
            />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Stacked Bar Chart */}
      <div style={{ height }} className="flex items-end justify-between gap-1">
        {data.map((item) => {
          const isSelected = selectedPeriod === item.period;
          let currentY = 0;

          return (
            <div
              key={item.period}
              className="flex flex-col items-center flex-1"
              onClick={() => handlePeriodClick(item.period)}
            >
              <div
                className={`relative w-full cursor-pointer transition-all duration-300 ${
                  isSelected ? 'transform scale-105' : 'hover:scale-102'
                }`}
                style={{ height: height - 40 }}
              >
                {activeFilters.map((filterKey) => {
                  const value = (item as any)[filterKey] || 0;
                  const barHeight = (value / maxValue) * (height - 40);
                  const cat = revenueCategories.find(
                    (c) => c.key === filterKey,
                  );
                  const yPos = currentY;
                  currentY += barHeight;

                  return (
                    <div
                      key={filterKey}
                      className="absolute left-0 right-0 rounded-t transition-all"
                      style={{
                        bottom: yPos,
                        height: barHeight,
                        background: `linear-gradient(180deg, ${adjustColor(cat?.color || '#666', 20)} 0%, ${cat?.color || '#666'} 100%)`,
                        boxShadow: isSelected
                          ? `0 4px 12px ${cat?.color}40`
                          : 'none',
                      }}
                    />
                  );
                })}

                {/* 3D effect on top */}
                {currentY > 0 && (
                  <div
                    className="absolute left-0 right-0 h-2 rounded-t"
                    style={{
                      bottom: currentY - 2,
                      background:
                        'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%)',
                    }}
                  />
                )}
              </div>

              <span
                className={`text-xs mt-2 ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {item.period}
              </span>
            </div>
          );
        })}
      </div>

      {/* Breakdown for selected period */}
      {selectedPeriod && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Breakdown for {selectedPeriod}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {activeFilters.map((filterKey) => {
              const periodData = data.find((d) => d.period === selectedPeriod);
              const value = periodData
                ? (periodData as any)[filterKey] || 0
                : 0;
              const cat = revenueCategories.find((c) => c.key === filterKey);

              return (
                <div
                  key={filterKey}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ backgroundColor: `${cat?.color}10` }}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: cat?.color }}
                  />
                  <div>
                    <p className="text-xs text-gray-500">{cat?.label}</p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(value)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Compact List Chart (Replaces cluttered top diagnoses)
// =============================================================================

interface CompactListChartProps {
  data: { label: string; value: number; subLabel?: string }[];
  title: string;
  subtitle?: string;
  color?: string;
  icon?: React.ReactNode;
  formatValue?: (value: number) => string;
  maxItems?: number;
}

export function CompactListChart({
  data,
  title,
  subtitle,
  color = '#3B82F6',
  icon,
  formatValue = formatNumber,
  maxItems = 5,
}: CompactListChartProps) {
  const [expanded, setExpanded] = useState(false);
  const displayData = expanded ? data : data.slice(0, maxItems);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${color}15` }}
            >
              <div style={{ color }}>{icon}</div>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {displayData.map((item, index) => (
          <div key={index} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${adjustColor(color, 20)} 0%, ${color} 100%)`,
                  }}
                >
                  {index + 1}
                </span>
                <span className="text-sm text-gray-700 font-medium truncate max-w-[200px]">
                  {item.label}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {formatValue(item.value)}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden ml-8">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  background: `linear-gradient(90deg, ${color} 0%, ${adjustColor(color, -20)} 100%)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {data.length > maxItems && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 w-full mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500 hover:text-gray-700"
        >
          {expanded ? (
            <>
              Show Less <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show All ({data.length}) <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Progress Ring Component
// =============================================================================

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 120,
  strokeWidth = 10,
  color = '#3B82F6',
  label,
}: ProgressRingProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              filter: `drop-shadow(0 2px 8px ${color}40)`,
              transition: 'stroke-dashoffset 0.5s ease',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      {label && <p className="text-sm text-gray-500 mt-2">{label}</p>}
    </div>
  );
}

// =============================================================================
// Service Category Filter
// =============================================================================

interface ServiceFilterProps {
  categories: { key: string; label: string; color: string }[];
  activeCategory: string;
  onChange: (category: string) => void;
}

export function ServiceFilter({
  categories,
  activeCategory,
  onChange,
}: ServiceFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onChange(cat.key)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeCategory === cat.key
              ? 'text-white shadow-lg'
              : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
          }`}
          style={{
            backgroundColor: activeCategory === cat.key ? cat.color : undefined,
            boxShadow:
              activeCategory === cat.key
                ? `0 4px 14px ${cat.color}40`
                : undefined,
          }}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Time Frame Selector
// =============================================================================

interface TimeFrameSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
}

export function TimeFrameSelector({
  value,
  onChange,
  options = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom' },
  ],
}: TimeFrameSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(radians),
    y: cy + r * Math.sin(radians),
  };
}

function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(
    0,
    Math.min(255, parseInt(hex.substring(0, 2), 16) + amount),
  );
  const g = Math.max(
    0,
    Math.min(255, parseInt(hex.substring(2, 4), 16) + amount),
  );
  const b = Math.max(
    0,
    Math.min(255, parseInt(hex.substring(4, 6), 16) + amount),
  );
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

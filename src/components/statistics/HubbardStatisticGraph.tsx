import React, { useState } from 'react';
import { MetricSeries, DataPoint } from '../../utils/companyStatisticsService';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  BarChart3,
  LineChart as LineChartIcon,
  HelpCircle,
  Award,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Info
} from 'lucide-react';
import { HubbardConditionFormula } from '../../data/hubbardConditionsData';

interface HubbardStatisticGraphProps {
  series: MetricSeries;
  chartTypePreference?: 'line' | 'bar' | 'mixed';
  onSelectCondition: (condition: HubbardConditionFormula) => void;
  accentColor?: string;
  isCurrency?: boolean;
}

export const HubbardStatisticGraph: React.FC<HubbardStatisticGraphProps> = ({
  series,
  chartTypePreference = 'line',
  onSelectCondition,
  accentColor = '#BE2629',
  isCurrency = false,
}) => {
  const [localChartType, setLocalChartType] = useState<'line' | 'bar' | 'mixed'>(chartTypePreference);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Sync preference if changed externally
  React.useEffect(() => {
    setLocalChartType(chartTypePreference);
  }, [chartTypePreference]);

  const points = series.dataPoints;
  const values = points.map((p) => p.value);
  const maxVal = Math.max(...values, series.quota || 1) * 1.15;
  const minVal = 0;

  // SVG dimensions
  const svgWidth = 680;
  const svgHeight = 260;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 45;

  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  // Coordinate scales
  const getX = (idx: number) => {
    if (points.length <= 1) return paddingLeft + chartW / 2;
    return paddingLeft + (idx / (points.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    if (maxVal === minVal) return paddingTop + chartH / 2;
    const ratio = (val - minVal) / (maxVal - minVal);
    return paddingTop + chartH - ratio * chartH;
  };

  // Quota line Y
  const quotaY = series.quota ? getY(series.quota) : null;

  // Path generator for line
  const linePath = points.reduce((acc, p, idx) => {
    const x = getX(idx);
    const y = getY(p.value);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Area under line
  const firstX = getX(0);
  const lastX = getX(points.length - 1);
  const bottomY = paddingTop + chartH;
  const areaPath = points.length > 0
    ? `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
    : '';

  // Secondary path (if exists, e.g. Tareas completadas o Gastos)
  const hasSecondary = points.some((p) => p.secondaryValue !== undefined);
  const secondaryLinePath = hasSecondary
    ? points.reduce((acc, p, idx) => {
        const x = getX(idx);
        const y = getY(p.secondaryValue || 0);
        return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
      }, '')
    : '';

  const formatVal = (v: number) => {
    if (isCurrency) return `$ ${Math.round(v).toLocaleString('es-AR')}`;
    return `${Math.round(v).toLocaleString('es-AR')}`;
  };

  const hoveredPoint = hoveredPointIndex !== null ? points[hoveredPointIndex] : null;

  return (
    <div className="bg-[#121620] border border-[#232b3d] rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* 1. Header Oficial Hubbard Management Technology */}
      <div className="bg-[#161c29] border-b border-[#242f45] p-4">
        {/* Top Identification Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/70 border border-rose-800/60 text-rose-300 font-bold uppercase tracking-wider">
                ESTADÍSTICA OFICIAL
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                ÁREA: <strong className="text-white">{series.area}</strong>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                PROY: <strong className="text-white">{series.project}</strong>
              </span>
            </div>
            <h3 className="text-base font-black text-white mt-1 tracking-tight flex items-center gap-2">
              <span>{series.title}</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 font-sans">
              {series.hubbardStatisticName} · Unidad: <strong className="text-rose-400">{series.unit}</strong>
            </p>
          </div>

          {/* Condition Badge with Direct Formula Trigger */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => onSelectCondition(series.currentCondition)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer hover:scale-[1.02] active:scale-95 border ${series.currentCondition.borderLight} ${series.currentCondition.bgDark}`}
              style={{ color: series.currentCondition.color }}
              title="Click para ver los pasos exactos de la Fórmula Hubbard para esta condición"
            >
              <Activity className="w-4 h-4 animate-pulse shrink-0" />
              <div className="text-left">
                <span className="text-[10px] uppercase block leading-none font-mono opacity-80">
                  Condición Detectada
                </span>
                <span className="text-xs font-black tracking-wide">
                  {series.currentCondition.badgeTitle}
                </span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/40 border border-white/20 font-mono">
                {series.slopePercentage >= 0 ? `+${series.slopePercentage}%` : `${series.slopePercentage}%`}
              </span>
            </button>

            {/* View Mode Toggle: Line / Bar / Mixed */}
            <div className="flex items-center bg-[#0d1017] border border-[#2b354c] p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setLocalChartType('line')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  localChartType === 'line'
                    ? 'bg-[#BE2629] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Ver Gráfico de Líneas"
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLocalChartType('bar')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  localChartType === 'bar'
                    ? 'bg-[#BE2629] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Ver Gráfico de Barras"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLocalChartType('mixed')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  localChartType === 'mixed'
                    ? 'bg-[#BE2629] text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Ver Gráfico Combinado"
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Technical Sheet Line (Responsible & Meta) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-[#1f283c] text-[11px] font-mono text-slate-300">
          <div>
            <span className="text-slate-400 block text-[10px]">RESPONSABLE:</span>
            <span className="font-bold text-white truncate block">{series.responsible}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">CARGO:</span>
            <span className="font-semibold text-slate-200 truncate block">{series.role}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">CUOTA / META:</span>
            <span className="font-bold text-cyan-300">{formatVal(series.quota)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">VALOR ACTUAL:</span>
            <span className="font-black text-rose-400">{formatVal(series.currentValue)}</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive SVG Graph Container */}
      <div className="p-4 relative flex-1 flex flex-col justify-center">
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto min-w-[540px] select-none"
            style={{ maxHeight: '310px' }}
          >
            <defs>
              {/* Gradient for area under line */}
              <linearGradient id={`grad-${series.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.45" />
                <stop offset="90%" stopColor={accentColor} stopOpacity="0.02" />
              </linearGradient>

              {/* Gradient for secondary series */}
              <linearGradient id={`grad-sec-${series.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="90%" stopColor="#10b981" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Background Grid Lines (Horizontal) */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = paddingTop + chartH * (1 - ratio);
              const gridVal = minVal + (maxVal - minVal) * ratio;
              return (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="#1e2738"
                    strokeWidth="1"
                    strokeDasharray={i === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {isCurrency && gridVal >= 1000000
                      ? `$${(gridVal / 1000000).toFixed(1)}M`
                      : isCurrency
                      ? `$${Math.round(gridVal / 1000)}k`
                      : Math.round(gridVal)}
                  </text>
                </g>
              );
            })}

            {/* Vertical Grid Lines (Time Intervals) */}
            {points.map((p, idx) => {
              const x = getX(idx);
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + chartH}
                    stroke="#1c2333"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={paddingTop + chartH + 18}
                    textAnchor="middle"
                    fill={hoveredPointIndex === idx ? '#ffffff' : '#94a3b8'}
                    fontWeight={hoveredPointIndex === idx ? 'bold' : 'normal'}
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {p.shortLabel}
                  </text>
                </g>
              );
            })}

            {/* Quota Reference Line (Línea de Cuota Oficial Hubbard) */}
            {quotaY !== null && (
              <g>
                <line
                  x1={paddingLeft}
                  y1={quotaY}
                  x2={svgWidth - paddingRight}
                  y2={quotaY}
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={svgWidth - paddingRight}
                  y={quotaY - 4}
                  textAnchor="end"
                  fill="#06b6d4"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  CUOTA ({formatVal(series.quota)})
                </text>
              </g>
            )}

            {/* BARS: Render if chartType is 'bar' or 'mixed' */}
            {(localChartType === 'bar' || localChartType === 'mixed') && (
              <g>
                {points.map((p, idx) => {
                  const x = getX(idx);
                  const barW = Math.max(14, chartW / points.length / 2.8);
                  const y = getY(p.value);
                  const barH = paddingTop + chartH - y;
                  const isHovered = hoveredPointIndex === idx;

                  return (
                    <g key={`bar-${idx}`}>
                      <rect
                        x={x - barW / 2}
                        y={y}
                        width={barW}
                        height={Math.max(2, barH)}
                        fill={isHovered ? '#BE2629' : accentColor}
                        opacity={localChartType === 'mixed' ? 0.35 : 0.85}
                        rx="3"
                        className="transition-all cursor-pointer"
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* LINES: Render if chartType is 'line' or 'mixed' */}
            {(localChartType === 'line' || localChartType === 'mixed') && (
              <>
                {/* Secondary Series Line (e.g. Gastos o Completadas) */}
                {hasSecondary && (
                  <path
                    d={secondaryLinePath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                    opacity="0.8"
                  />
                )}

                {/* Main Area Fill */}
                <path d={areaPath} fill={`url(#grad-${series.id})`} />

                {/* Main Curve Line (La línea de la estadística) */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Data Dots with interactive hover */}
            {points.map((p, idx) => {
              const x = getX(idx);
              const y = getY(p.value);
              const isHovered = hoveredPointIndex === idx;

              return (
                <g key={`dot-${idx}`} className="cursor-pointer">
                  {/* Outer pulse when hovered */}
                  {isHovered && (
                    <circle
                      cx={x}
                      cy={y}
                      r="9"
                      fill={accentColor}
                      opacity="0.3"
                      className="animate-ping"
                    />
                  )}
                  {/* Dot circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? '6' : '4.5'}
                    fill="#121620"
                    stroke={accentColor}
                    strokeWidth={isHovered ? '3' : '2'}
                    onMouseEnter={() => setHoveredPointIndex(idx)}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                  />
                  {/* Floating value pill when hovered or top values */}
                  {(isHovered || points.length <= 6) && (
                    <text
                      x={x}
                      y={y - 10}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {formatVal(p.value)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hovered Point Detailed Tooltip Card */}
        {hoveredPoint && (
          <div className="mt-2 p-2.5 rounded-xl bg-[#161c28] border border-[#2b374e] text-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="font-bold text-white block">{hoveredPoint.label}</span>
                <span className="text-[11px] text-slate-300 font-mono">{hoveredPoint.details}</span>
              </div>
            </div>
            <div className="text-right font-mono shrink-0">
              <span className="text-[10px] text-slate-400 block uppercase">Registro:</span>
              <span className="font-black text-rose-400 text-sm">{formatVal(hoveredPoint.value)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer Bar with Formula Steps Link */}
      <div className="bg-[#10141e] border-t border-[#1e273a] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <p className="text-slate-300 text-[11px] leading-relaxed">
          {series.summary}
        </p>
        <button
          type="button"
          onClick={() => onSelectCondition(series.currentCondition)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1c2436] hover:bg-[#253047] text-white text-[11px] font-bold border border-[#2e3b54] transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
          <span>Ver Pasos de la {series.currentCondition.name}</span>
        </button>
      </div>
    </div>
  );
};

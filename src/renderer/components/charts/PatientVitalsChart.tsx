// =============================================================================
// Universal Patient Vitals Trend Chart
// Reusable across all modules: GOPD, Specialty, A&E, Medical Records
// Shows BP, pulse, temperature, SpO2, weight trends with clinical deductions
// =============================================================================

import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Area,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Activity,
  Heart,
  Thermometer,
  Wind,
  Scale,
  ChevronDown,
  ChevronUp,
  Info,
  BarChart3,
} from 'lucide-react';
import type { VitalsTrend } from '../../modules/clinical-consultation/api/medical-records/types';
import { usePatientVitalsTrend } from '../../modules/clinical-consultation/hooks/useMedicalRecords';

/* ─── Props ─────────────────────────────────────────────────────────────────── */

interface PatientVitalsChartProps {
  /** Patient ID — chart fetches its own data */
  patientId: string;
  /** Timeframe for vitals data */
  timeframe?: '3m' | '6m' | '1y' | 'all';
  /** Compact mode for sidebars */
  compact?: boolean;
  /** Start collapsed */
  defaultCollapsed?: boolean;
  /** Optional pre-fetched data (skips internal fetch) */
  data?: VitalsTrend[];
}

type ChartTab = 'bp' | 'temp' | 'weight' | 'spo2';

const TABS: { key: ChartTab; label: string; icon: React.ReactNode }[] = [
  { key: 'bp', label: 'Blood Pressure & Pulse', icon: <Heart className="h-3.5 w-3.5" /> },
  { key: 'temp', label: 'Temperature', icon: <Thermometer className="h-3.5 w-3.5" /> },
  { key: 'weight', label: 'Weight', icon: <Scale className="h-3.5 w-3.5" /> },
  { key: 'spo2', label: 'SpO₂ & RR', icon: <Wind className="h-3.5 w-3.5" /> },
];

export default function PatientVitalsChart({
  patientId,
  timeframe = '6m',
  compact = false,
  defaultCollapsed = false,
  data: externalData,
}: PatientVitalsChartProps) {
  const [activeChart, setActiveChart] = useState<ChartTab>('bp');
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  const { data: fetchedData } = usePatientVitalsTrend(
    externalData ? null : patientId,
    timeframe,
  );

  const rawData = externalData ?? fetchedData ?? [];

  const chartData = useMemo(() => {
    return rawData
      .filter((v) => v.date)
      .map((v, idx) => ({
        name: `V${idx + 1}`,
        date: new Date(v.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        }),
        systolic: v.blood_pressure_systolic,
        diastolic: v.blood_pressure_diastolic,
        pulse: v.pulse_rate,
        temperature: v.temperature,
        weight: v.weight,
        spo2: v.oxygen_saturation,
        rr: v.respiratory_rate,
      }));
  }, [rawData]);

  const deductions = useMemo(() => computeDeductions(rawData), [rawData]);

  if (rawData.length < 2) return null;

  const chartHeight = compact ? 180 : 220;

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between border-b border-gray-100 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
            Vitals Trend
          </h3>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
            {rawData.length} reading{rawData.length !== 1 ? 's' : ''}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className={`${compact ? 'p-3' : 'p-4'} space-y-3`}>
          {/* Chart tabs */}
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveChart(tab.key)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeChart === tab.key
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Chart + Legend */}
          <div>
            <div style={{ height: chartHeight }}>
              {activeChart === 'bp' && <BpChart data={chartData} />}
              {activeChart === 'temp' && <TempChart data={chartData} />}
              {activeChart === 'weight' && <WeightChart data={chartData} />}
              {activeChart === 'spo2' && <Spo2Chart data={chartData} />}
            </div>
            <RangeLegend chart={activeChart} />
          </div>

          {/* Clinical Deductions */}
          {deductions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <Info className="h-3 w-3" />
                Clinical Insights
              </p>
              {deductions.map((d, i) => (
                <DeductionChip key={i} deduction={d} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chart Components with Standard Medical Reference Ranges ─────────────────
// BP: AHA/ESC — Normal <120/80, Elevated 120-129, HTN-1 130-139/80-89, HTN-2 ≥140/≥90, Crisis >180/>120
// Pulse: Normal 60-100 bpm (WHO)
// Temp: Normal 36.1-37.2°C, Low-grade fever 37.3-38, Fever >38, Hypothermia <36
// SpO₂: Normal 95-100%, Mild hypoxia 90-94%, Moderate 85-89%, Severe <85%
// RR: Normal 12-20/min (adults)
// ─────────────────────────────────────────────────────────────────────────────

function BpChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        {/* Reference ranges (painted first = behind lines) */}
        <ReferenceArea y1={180} y2={200} fill="#fca5a5" fillOpacity={0.2} label={{ value: 'Crisis', position: 'insideTopRight', fontSize: 8, fill: '#dc2626' }} />
        <ReferenceArea y1={140} y2={180} fill="#fde68a" fillOpacity={0.2} label={{ value: 'HTN Stage 2', position: 'insideTopRight', fontSize: 8, fill: '#d97706' }} />
        <ReferenceArea y1={130} y2={140} fill="#fef3c7" fillOpacity={0.15} />
        <ReferenceArea y1={90} y2={120} fill="#d1fae5" fillOpacity={0.25} label={{ value: 'Normal', position: 'insideTopRight', fontSize: 8, fill: '#059669' }} />
        <ReferenceArea y1={60} y2={90} fill="#dbeafe" fillOpacity={0.2} label={{ value: 'Normal Diastolic', position: 'insideBottomRight', fontSize: 7, fill: '#2563eb' }} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <YAxis domain={[40, 200]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <Tooltip content={<BpTooltip />} />
        <ReferenceLine y={120} stroke="#059669" strokeDasharray="3 3" strokeWidth={1} />
        <ReferenceLine y={80} stroke="#2563eb" strokeDasharray="3 3" strokeWidth={1} />
        <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: '#ef4444', strokeWidth: 1, stroke: '#fff' }} name="Systolic" connectNulls />
        <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 1, stroke: '#fff' }} name="Diastolic" connectNulls />
        <Line type="monotone" dataKey="pulse" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 3, fill: '#a855f7' }} name="Pulse" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function TempChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        {/* Reference ranges */}
        <ReferenceArea y1={39} y2={42} fill="#fca5a5" fillOpacity={0.2} label={{ value: 'High Fever', position: 'insideTopRight', fontSize: 8, fill: '#dc2626' }} />
        <ReferenceArea y1={38} y2={39} fill="#fde68a" fillOpacity={0.2} label={{ value: 'Fever', position: 'insideTopRight', fontSize: 8, fill: '#d97706' }} />
        <ReferenceArea y1={37.3} y2={38} fill="#fef9c3" fillOpacity={0.15} label={{ value: 'Low-grade', position: 'insideTopRight', fontSize: 7, fill: '#ca8a04' }} />
        <ReferenceArea y1={36.1} y2={37.2} fill="#d1fae5" fillOpacity={0.3} label={{ value: 'Normal (36.1–37.2°C)', position: 'insideTopRight', fontSize: 8, fill: '#059669' }} />
        <ReferenceArea y1={35} y2={36} fill="#bfdbfe" fillOpacity={0.2} label={{ value: 'Hypothermia', position: 'insideBottomRight', fontSize: 8, fill: '#2563eb' }} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <YAxis domain={[35, 42]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <Tooltip content={<TempTooltip />} />
        <Area type="monotone" dataKey="temperature" stroke="#E9783F" fill="#fff7ed" strokeWidth={2.5} dot={{ r: 4, fill: '#E9783F', strokeWidth: 1, stroke: '#fff' }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function WeightChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <Tooltip content={<WeightTooltip />} />
        <Area type="monotone" dataKey="weight" stroke="#10b981" fill="#d1fae5" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', strokeWidth: 1, stroke: '#fff' }} name="Weight" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Spo2Chart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        {/* SpO₂ reference ranges */}
        <ReferenceArea yAxisId="left" y1={95} y2={100} fill="#d1fae5" fillOpacity={0.3} label={{ value: 'Normal ≥95%', position: 'insideTopRight', fontSize: 8, fill: '#059669' }} />
        <ReferenceArea yAxisId="left" y1={90} y2={95} fill="#fde68a" fillOpacity={0.2} label={{ value: 'Mild Hypoxia', position: 'insideTopRight', fontSize: 8, fill: '#d97706' }} />
        <ReferenceArea yAxisId="left" y1={85} y2={90} fill="#fca5a5" fillOpacity={0.2} label={{ value: 'Moderate', position: 'insideTopRight', fontSize: 8, fill: '#dc2626' }} />
        {/* RR reference ranges */}
        <ReferenceArea yAxisId="right" y1={12} y2={20} fill="#dbeafe" fillOpacity={0.1} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <YAxis yAxisId="left" domain={[85, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 40]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <Tooltip content={<Spo2Tooltip />} />
        <ReferenceLine yAxisId="right" y={12} stroke="#2563eb" strokeDasharray="3 3" strokeWidth={1} />
        <ReferenceLine yAxisId="right" y={20} stroke="#2563eb" strokeDasharray="3 3" strokeWidth={1} />
        <Line yAxisId="left" type="monotone" dataKey="spo2" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1', strokeWidth: 1, stroke: '#fff' }} name="SpO₂" connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="rr" stroke="#14b8a6" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 3, fill: '#14b8a6' }} name="RR" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Range Legend ────────────────────────────────────────────────────────────

function RangeLegend({ chart }: { chart: ChartTab }) {
  const legends: Record<ChartTab, { color: string; label: string }[]> = {
    bp: [
      { color: 'bg-green-200', label: 'Normal (<120/80)' },
      { color: 'bg-yellow-100', label: 'Elevated (120-129)' },
      { color: 'bg-yellow-200', label: 'HTN Stage 1 (130-139/80-89)' },
      { color: 'bg-yellow-300', label: 'HTN Stage 2 (≥140/≥90)' },
      { color: 'bg-red-200', label: 'Crisis (>180/120)' },
    ],
    temp: [
      { color: 'bg-blue-200', label: 'Hypothermia (<36°C)' },
      { color: 'bg-green-200', label: 'Normal (36.1–37.2°C)' },
      { color: 'bg-yellow-100', label: 'Low-grade (37.3–38°C)' },
      { color: 'bg-yellow-200', label: 'Fever (38–39°C)' },
      { color: 'bg-red-200', label: 'High Fever (>39°C)' },
    ],
    weight: [
      { color: 'bg-green-200', label: 'Weight trend over time' },
    ],
    spo2: [
      { color: 'bg-green-200', label: 'Normal (≥95%)' },
      { color: 'bg-yellow-200', label: 'Mild Hypoxia (90-94%)' },
      { color: 'bg-red-200', label: 'Moderate (<90%)' },
      { color: 'bg-blue-200', label: 'RR Normal (12-20/min)' },
    ],
  };

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 px-1">
      {legends[chart].map((l) => (
        <div key={l.label} className="flex items-center gap-1">
          <span className={`inline-block w-2.5 h-2.5 rounded-sm ${l.color}`} />
          <span className="text-[10px] text-gray-500">{l.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Tooltips ────────────────────────────────────────────────────────────────

function BpTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const sys = d?.systolic;
  const dia = d?.diastolic;
  const bpClass = classifyBP(sys, dia);
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.stroke }}>
          {p.name}: <span className="font-semibold">{p.value ?? '—'}</span>
          {p.name === 'Pulse' ? ' bpm' : ' mmHg'}
        </p>
      ))}
      {bpClass && <p className={`mt-1 font-semibold ${bpClass.color}`}>{bpClass.label}</p>}
    </div>
  );
}

function TempTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const temp = payload[0]?.value;
  const cls = classifyTemp(temp);
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-orange-600">Temp: <span className="font-semibold">{temp ?? '—'} °C</span></p>
      {cls && <p className={`mt-1 font-semibold ${cls.color}`}>{cls.label}</p>}
    </div>
  );
}

function WeightTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-emerald-600">Weight: <span className="font-semibold">{payload[0]?.value ?? '—'} kg</span></p>
    </div>
  );
}

function Spo2Tooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const spo2Val = d?.spo2;
  const rrVal = d?.rr;
  const spo2Cls = classifySpo2(spo2Val);
  const rrCls = classifyRR(rrVal);
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.stroke }}>
          {p.name}: <span className="font-semibold">{p.value ?? '—'}</span>
          {p.name === 'SpO₂' ? '%' : '/min'}
        </p>
      ))}
      {spo2Cls && <p className={`mt-0.5 font-semibold ${spo2Cls.color}`}>{spo2Cls.label}</p>}
      {rrCls && <p className={`font-semibold ${rrCls.color}`}>{rrCls.label}</p>}
    </div>
  );
}

// ─── Deduction Chip ──────────────────────────────────────────────────────────

interface Deduction {
  type: 'danger' | 'warning' | 'info' | 'good';
  title: string;
  detail: string;
}

function DeductionChip({ deduction }: { deduction: Deduction }) {
  const styles: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    danger: {
      bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800',
      icon: <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800',
      icon: <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />,
    },
    info: {
      bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800',
      icon: <Info className="h-3 w-3 text-blue-500 shrink-0" />,
    },
    good: {
      bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800',
      icon: <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />,
    },
  };
  const s = styles[deduction.type];
  return (
    <div className={`flex items-start gap-2 rounded-lg border ${s.border} ${s.bg} px-3 py-1.5`}>
      <div className="mt-0.5">{s.icon}</div>
      <div className="min-w-0">
        <span className={`text-[11px] font-semibold ${s.text}`}>{deduction.title}</span>
        <span className={`text-[11px] ${s.text} opacity-75 ml-1`}>— {deduction.detail}</span>
      </div>
    </div>
  );
}

// ─── Clinical Deduction Engine ───────────────────────────────────────────────

function computeDeductions(data: VitalsTrend[]): Deduction[] {
  if (data.length < 2) return [];

  const deductions: Deduction[] = [];
  const latest = data[data.length - 1];
  const systolics = data.filter((v) => v.blood_pressure_systolic != null).map((v) => v.blood_pressure_systolic!);
  const diastolics = data.filter((v) => v.blood_pressure_diastolic != null).map((v) => v.blood_pressure_diastolic!);
  const pulses = data.filter((v) => v.pulse_rate != null).map((v) => v.pulse_rate!);
  const temps = data.filter((v) => v.temperature != null).map((v) => v.temperature!);
  const weights = data.filter((v) => v.weight != null).map((v) => v.weight!);
  const spo2s = data.filter((v) => v.oxygen_saturation != null).map((v) => v.oxygen_saturation!);

  // ── BP ──
  if (systolics.length >= 2) {
    const lastTwo = systolics.slice(-2);
    const lastTwoDia = diastolics.slice(-2);
    if (lastTwo.every((v) => v >= 140) || lastTwoDia.every((v) => v >= 90)) {
      deductions.push({
        type: 'danger',
        title: 'Persistent Hypertension',
        detail: 'BP ≥140/90 for last 2 readings. Evaluate for end-organ damage.',
      });
    } else if ((latest.blood_pressure_systolic ?? 0) >= 140) {
      deductions.push({
        type: 'warning',
        title: 'Elevated BP',
        detail: `Latest ${latest.blood_pressure_systolic}/${latest.blood_pressure_diastolic} mmHg. Repeat and monitor.`,
      });
    }

    const trend = systolics[systolics.length - 1] - systolics[0];
    if (trend > 20) {
      deductions.push({
        type: 'warning',
        title: 'Rising BP Trend',
        detail: `Systolic increased ${trend} mmHg across visits.`,
      });
    }
  }

  // ── Pulse ──
  if (pulses.length >= 1) {
    const latestPulse = pulses[pulses.length - 1];
    if (latestPulse > 100) {
      deductions.push({
        type: 'warning',
        title: 'Tachycardia',
        detail: `Pulse ${latestPulse} bpm (>100). Assess for pain, fever, dehydration, or cardiac cause.`,
      });
    } else if (latestPulse < 60) {
      deductions.push({
        type: 'warning',
        title: 'Bradycardia',
        detail: `Pulse ${latestPulse} bpm (<60). Review medications (beta-blockers) and cardiac history.`,
      });
    }
  }

  // ── Temperature ──
  if (temps.length >= 1) {
    const latestTemp = temps[temps.length - 1];
    if (latestTemp >= 38) {
      deductions.push({
        type: 'danger',
        title: 'Fever',
        detail: `Temperature ${latestTemp}°C. Investigate for infection — blood cultures, urinalysis, chest X-ray as indicated.`,
      });
    } else if (latestTemp <= 35.5) {
      deductions.push({
        type: 'warning',
        title: 'Hypothermia',
        detail: `Temperature ${latestTemp}°C. Assess exposure, sepsis, or endocrine causes.`,
      });
    }
  }

  // ── SpO₂ ──
  if (spo2s.length >= 1) {
    const latestSpo2 = spo2s[spo2s.length - 1];
    if (latestSpo2 < 90) {
      deductions.push({
        type: 'danger',
        title: 'Severe Hypoxia',
        detail: `SpO₂ ${latestSpo2}% — urgent oxygen therapy and assessment needed.`,
      });
    } else if (latestSpo2 < 95) {
      deductions.push({
        type: 'warning',
        title: 'Low SpO₂',
        detail: `SpO₂ ${latestSpo2}%. Monitor respiratory status and consider supplemental O₂.`,
      });
    }
  }

  // ── Weight ──
  if (weights.length >= 2) {
    const change = weights[weights.length - 1] - weights[0];
    if (change > 5) {
      deductions.push({
        type: 'info',
        title: 'Weight Gain',
        detail: `${change.toFixed(1)} kg gain over ${weights.length} readings. Assess for edema, fluid retention, or dietary factors.`,
      });
    } else if (change < -5) {
      deductions.push({
        type: 'warning',
        title: 'Significant Weight Loss',
        detail: `${Math.abs(change).toFixed(1)} kg loss. Screen for malnutrition, chronic disease, or malignancy.`,
      });
    }
  }

  // ── Overall ──
  if (deductions.length === 0) {
    deductions.push({
      type: 'good',
      title: 'Stable Vitals',
      detail: 'All vitals within normal limits across recent readings.',
    });
  }

  return deductions;
}

// ─── Classification Helpers (Standard Medical Practice) ──────────────────────

function classifyBP(sys?: number, dia?: number): { label: string; color: string } | null {
  if (sys == null || dia == null) return null;
  if (sys > 180 || dia > 120) return { label: '⚠ Hypertensive Crisis', color: 'text-red-600' };
  if (sys >= 140 || dia >= 90) return { label: 'HTN Stage 2', color: 'text-red-500' };
  if (sys >= 130 || dia >= 80) return { label: 'HTN Stage 1', color: 'text-amber-600' };
  if (sys >= 120 && dia < 80) return { label: 'Elevated', color: 'text-yellow-600' };
  if (sys >= 90 && dia >= 60) return { label: '✓ Normal', color: 'text-green-600' };
  return { label: 'Hypotension', color: 'text-blue-600' };
}

function classifyTemp(temp?: number): { label: string; color: string } | null {
  if (temp == null) return null;
  if (temp >= 39) return { label: '⚠ High Fever', color: 'text-red-600' };
  if (temp >= 38) return { label: 'Fever', color: 'text-amber-600' };
  if (temp >= 37.3) return { label: 'Low-grade Fever', color: 'text-yellow-600' };
  if (temp >= 36.1) return { label: '✓ Normal', color: 'text-green-600' };
  if (temp >= 35) return { label: 'Mild Hypothermia', color: 'text-blue-600' };
  return { label: '⚠ Hypothermia', color: 'text-blue-700' };
}

function classifySpo2(val?: number): { label: string; color: string } | null {
  if (val == null) return null;
  if (val >= 95) return { label: '✓ Normal O₂', color: 'text-green-600' };
  if (val >= 90) return { label: 'Mild Hypoxia', color: 'text-amber-600' };
  if (val >= 85) return { label: 'Moderate Hypoxia', color: 'text-red-500' };
  return { label: '⚠ Severe Hypoxia', color: 'text-red-700' };
}

function classifyRR(val?: number): { label: string; color: string } | null {
  if (val == null) return null;
  if (val >= 12 && val <= 20) return { label: '✓ RR Normal', color: 'text-green-600' };
  if (val > 20) return { label: 'Tachypnea', color: 'text-amber-600' };
  return { label: 'Bradypnea', color: 'text-blue-600' };
}

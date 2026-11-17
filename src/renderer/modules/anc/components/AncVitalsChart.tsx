// =============================================================================
// ANC Module — Vitals Trend Charts with Clinical Deductions
// Shows BP, weight, FHR, fundal height trends across all visits
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
  TrendingDown,
  Minus,
  AlertTriangle,
  Activity,
  Heart,
  Baby,
  Scale,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import type { AncObservation } from '../api/anc.types';

interface Props {
  observations: AncObservation[];
}

type ChartTab = 'bp' | 'weight' | 'fetal' | 'urinalysis';

const TABS: { key: ChartTab; label: string; icon: React.ReactNode }[] = [
  { key: 'bp', label: 'Blood Pressure', icon: <Heart className="h-3.5 w-3.5" /> },
  { key: 'weight', label: 'Weight & BMI', icon: <Scale className="h-3.5 w-3.5" /> },
  { key: 'fetal', label: 'Fetal', icon: <Baby className="h-3.5 w-3.5" /> },
  { key: 'urinalysis', label: 'Urinalysis', icon: <Activity className="h-3.5 w-3.5" /> },
];

export default function AncVitalsChart({ observations }: Props) {
  const [activeChart, setActiveChart] = useState<ChartTab>('bp');
  const [expanded, setExpanded] = useState(true);

  const chartData = useMemo(() => {
    return observations
      .filter((o) => o.created_at)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((o, idx) => ({
        name: `V${idx + 1}`,
        date: new Date(o.created_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
        }),
        systolic: o.systolic_bp,
        diastolic: o.diastolic_bp,
        pulse: o.pulse,
        weight: o.weight_kg,
        bmi: o.bmi,
        temperature: o.temperature,
        fhr: o.fetal_heart_rate,
        fundalHeight: o.fundal_height_cm,
        urineProtein: urineToNum(o.urine_protein),
        urineGlucose: urineToNum(o.urine_glucose),
        urineProteinLabel: o.urine_protein || '—',
        urineGlucoseLabel: o.urine_glucose || '—',
      }));
  }, [observations]);

  const deductions = useMemo(() => computeDeductions(observations), [observations]);

  if (observations.length < 1) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between border-b border-gray-100 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-pink-500" />
          <h3 className="text-sm font-semibold text-gray-900">Vitals Trend Charts</h3>
          <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-medium text-pink-600">
            {observations.length} reading{observations.length !== 1 ? 's' : ''}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="p-5 space-y-4">
          {/* Chart tabs */}
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveChart(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activeChart === tab.key
                    ? 'border-pink-300 bg-pink-100 text-pink-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Chart area */}
          <div>
            <div className="h-56">
              {activeChart === 'bp' && <BpChart data={chartData} />}
              {activeChart === 'weight' && <WeightChart data={chartData} />}
              {activeChart === 'fetal' && <FetalChart data={chartData} />}
              {activeChart === 'urinalysis' && <UrinalysisChart data={chartData} />}
            </div>
            <AncRangeLegend chart={activeChart} />
          </div>

          {/* Clinical Deductions */}
          {deductions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Clinical Deductions
              </p>
              <div className="space-y-1.5">
                {deductions.map((d, i) => (
                  <DeductionCard key={i} deduction={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chart Components ────────────────────────────────────────────────────────

// ─── Chart Components with Obstetric Reference Ranges ────────────────────────
// BP in pregnancy: Normal <140/90 (ACOG/NICE), Pre-eclampsia threshold ≥140/90
//   Severe pre-eclampsia ≥160/110
// FHR: Normal 110-160 bpm (NICE/RCOG), Bradycardia <110, Tachycardia >160
// Urinalysis: ≥++ proteinuria significant in pregnancy
// Weight gain: 11-16 kg total for normal BMI (IOM)
// ─────────────────────────────────────────────────────────────────────────────

function BpChart({ data }: { data: ReturnType<typeof Array<any>> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        {/* Obstetric BP reference ranges (ACOG) */}
        <ReferenceArea y1={160} y2={200} fill="#fca5a5" fillOpacity={0.2} label={{ value: 'Severe Pre-eclampsia', position: 'insideTopRight', fontSize: 8, fill: '#dc2626' }} />
        <ReferenceArea y1={140} y2={160} fill="#fde68a" fillOpacity={0.2} label={{ value: 'Pre-eclampsia Range', position: 'insideTopRight', fontSize: 8, fill: '#d97706' }} />
        <ReferenceArea y1={90} y2={120} fill="#d1fae5" fillOpacity={0.25} label={{ value: 'Normal', position: 'insideTopRight', fontSize: 8, fill: '#059669' }} />
        <ReferenceArea y1={60} y2={90} fill="#dbeafe" fillOpacity={0.15} label={{ value: 'Normal Diastolic', position: 'insideBottomRight', fontSize: 7, fill: '#2563eb' }} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis domain={[40, 200]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
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

function WeightChart({ data }: { data: ReturnType<typeof Array<any>> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <Tooltip content={<WeightTooltip />} />
        <Area type="monotone" dataKey="weight" stroke="#10b981" fill="#d1fae5" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', strokeWidth: 1, stroke: '#fff' }} name="Weight (kg)" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function FetalChart({ data }: { data: ReturnType<typeof Array<any>> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        {/* FHR reference ranges (NICE/RCOG) */}
        <ReferenceArea yAxisId="left" y1={160} y2={220} fill="#fca5a5" fillOpacity={0.15} label={{ value: 'Tachycardia', position: 'insideTopRight', fontSize: 8, fill: '#dc2626' }} />
        <ReferenceArea yAxisId="left" y1={110} y2={160} fill="#d1fae5" fillOpacity={0.25} label={{ value: 'Normal FHR (110-160)', position: 'insideTopRight', fontSize: 8, fill: '#059669' }} />
        <ReferenceArea yAxisId="left" y1={60} y2={110} fill="#fde68a" fillOpacity={0.15} label={{ value: 'Bradycardia', position: 'insideBottomRight', fontSize: 8, fill: '#d97706' }} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis yAxisId="left" domain={[60, 220]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 50]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <Tooltip content={<FetalTooltip />} />
        <Line yAxisId="left" type="monotone" dataKey="fhr" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4, fill: '#ec4899', strokeWidth: 1, stroke: '#fff' }} name="FHR" connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="fundalHeight" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: '#8b5cf6' }} name="Fundal Height" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function UrinalysisChart({ data }: { data: ReturnType<typeof Array<any>> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        {/* Urinalysis reference ranges */}
        <ReferenceArea y1={3} y2={5} fill="#fca5a5" fillOpacity={0.15} label={{ value: 'Significant (≥++)', position: 'insideTopRight', fontSize: 8, fill: '#dc2626' }} />
        <ReferenceArea y1={0} y2={1} fill="#d1fae5" fillOpacity={0.2} label={{ value: 'Normal', position: 'insideTopRight', fontSize: 8, fill: '#059669' }} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#9ca3af' }} ticks={[0, 1, 2, 3, 4]} tickFormatter={numToUrine} />
        <Tooltip content={<UrinalysisTooltip />} />
        <Line type="monotone" dataKey="urineProtein" stroke="#E9783F" strokeWidth={2.5} dot={{ r: 4, fill: '#E9783F', strokeWidth: 1, stroke: '#fff' }} name="Protein" connectNulls />
        <Line type="monotone" dataKey="urineGlucose" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 4, fill: '#06b6d4', strokeWidth: 1, stroke: '#fff' }} name="Glucose" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── ANC Range Legend ────────────────────────────────────────────────────────

function AncRangeLegend({ chart }: { chart: ChartTab }) {
  const legends: Record<ChartTab, { color: string; label: string }[]> = {
    bp: [
      { color: 'bg-green-200', label: 'Normal (<140/90)' },
      { color: 'bg-yellow-200', label: 'Pre-eclampsia (≥140/90)' },
      { color: 'bg-red-200', label: 'Severe (≥160/110)' },
    ],
    weight: [
      { color: 'bg-green-200', label: 'Weight trend (target gain: 11–16 kg)' },
    ],
    fetal: [
      { color: 'bg-yellow-200', label: 'Bradycardia (<110)' },
      { color: 'bg-green-200', label: 'Normal FHR (110–160)' },
      { color: 'bg-red-200', label: 'Tachycardia (>160)' },
    ],
    urinalysis: [
      { color: 'bg-green-200', label: 'Normal (nil/trace)' },
      { color: 'bg-red-200', label: 'Significant (≥++)' },
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

// ─── Custom Tooltips ─────────────────────────────────────────────────────────

function BpTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const sys = d?.systolic;
  const dia = d?.diastolic;
  const cls = classifyObsBP(sys, dia);
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.stroke }}>
          {p.name}: <span className="font-semibold">{p.value ?? '—'}</span>
          {p.name !== 'Pulse' ? ' mmHg' : ' bpm'}
        </p>
      ))}
      {cls && <p className={`mt-1 font-semibold ${cls.color}`}>{cls.label}</p>}
    </div>
  );
}

function WeightTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-emerald-600">Weight: <span className="font-semibold">{d?.weight ?? '—'} kg</span></p>
      {d?.bmi != null && <p className="text-gray-500">BMI: <span className="font-semibold">{d.bmi}</span></p>}
    </div>
  );
}

function FetalTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const fhrVal = d?.fhr;
  const fhrCls = classifyFHR(fhrVal);
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.stroke }}>
          {p.name}: <span className="font-semibold">{p.value ?? '—'}</span>
          {p.name === 'FHR' ? ' bpm' : ' cm'}
        </p>
      ))}
      {fhrCls && <p className={`mt-1 font-semibold ${fhrCls.color}`}>{fhrCls.label}</p>}
    </div>
  );
}

function UrinalysisTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-orange-600">Protein: <span className="font-semibold">{d?.urineProteinLabel}</span></p>
      <p className="text-cyan-600">Glucose: <span className="font-semibold">{d?.urineGlucoseLabel}</span></p>
    </div>
  );
}

// ─── Deduction Card ──────────────────────────────────────────────────────────

interface Deduction {
  type: 'danger' | 'warning' | 'info' | 'good';
  title: string;
  detail: string;
}

function DeductionCard({ deduction }: { deduction: Deduction }) {
  const styles: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    danger: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: <Info className="h-3.5 w-3.5 text-blue-500" />,
    },
    good: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: <TrendingUp className="h-3.5 w-3.5 text-green-500" />,
    },
  };
  const s = styles[deduction.type];
  return (
    <div className={`flex items-start gap-2 rounded-lg border ${s.border} ${s.bg} px-3 py-2`}>
      <div className="mt-0.5 shrink-0">{s.icon}</div>
      <div>
        <p className={`text-xs font-semibold ${s.text}`}>{deduction.title}</p>
        <p className={`text-[11px] ${s.text} opacity-80`}>{deduction.detail}</p>
      </div>
    </div>
  );
}

// ─── Clinical Deduction Engine ───────────────────────────────────────────────

function computeDeductions(obs: AncObservation[]): Deduction[] {
  if (obs.length === 0) return [];

  const deductions: Deduction[] = [];
  const sorted = [...obs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const latest = sorted[sorted.length - 1];
  const weights = sorted.filter((o) => o.weight_kg != null).map((o) => o.weight_kg!);
  const systolics = sorted.filter((o) => o.systolic_bp != null).map((o) => o.systolic_bp!);
  const diastolics = sorted.filter((o) => o.diastolic_bp != null).map((o) => o.diastolic_bp!);
  const fhrs = sorted.filter((o) => o.fetal_heart_rate != null).map((o) => o.fetal_heart_rate!);

  // ── BP Analysis ──
  if (systolics.length >= 2) {
    const recentHigh = systolics.slice(-2).every((v) => v >= 140) || diastolics.slice(-2).every((v) => v >= 90);
    if (recentHigh) {
      deductions.push({
        type: 'danger',
        title: 'Persistent Hypertension',
        detail: 'BP has been elevated (≥140/90) for the last 2 readings. Screen for pre-eclampsia — check proteinuria, symptoms, and consider urgent referral.',
      });
    } else if (latest.systolic_bp && latest.systolic_bp >= 140) {
      deductions.push({
        type: 'warning',
        title: 'Elevated Blood Pressure',
        detail: `Latest BP is ${latest.systolic_bp}/${latest.diastolic_bp} mmHg. Monitor closely and repeat at next visit.`,
      });
    }
  } else if (latest.systolic_bp && latest.systolic_bp >= 140) {
    deductions.push({
      type: 'warning',
      title: 'Elevated Blood Pressure',
      detail: `BP ${latest.systolic_bp}/${latest.diastolic_bp} mmHg — consider pre-eclampsia screening.`,
    });
  }

  if (systolics.length >= 2) {
    const trend = systolics[systolics.length - 1] - systolics[0];
    if (trend > 20) {
      deductions.push({
        type: 'warning',
        title: 'Rising BP Trend',
        detail: `Systolic BP has risen by ${trend} mmHg across visits. Progressive increase warrants close monitoring.`,
      });
    }
  }

  // ── Weight Analysis ──
  if (weights.length >= 2) {
    const totalGain = weights[weights.length - 1] - weights[0];
    const weeklyGain = totalGain / Math.max(weights.length - 1, 1);

    if (totalGain > 15) {
      deductions.push({
        type: 'warning',
        title: 'Excessive Weight Gain',
        detail: `Total weight gain of ${totalGain.toFixed(1)} kg. Excessive gain may indicate fluid retention or gestational diabetes risk. Counsel on nutrition.`,
      });
    } else if (totalGain < 0) {
      deductions.push({
        type: 'warning',
        title: 'Weight Loss Detected',
        detail: `Patient has lost ${Math.abs(totalGain).toFixed(1)} kg since first visit. Assess for hyperemesis, malnutrition, or underlying illness.`,
      });
    } else if (totalGain >= 5 && totalGain <= 15) {
      deductions.push({
        type: 'good',
        title: 'Healthy Weight Trend',
        detail: `Weight gain of ${totalGain.toFixed(1)} kg (avg ${weeklyGain.toFixed(1)} kg/visit) is within expected range.`,
      });
    }
  }

  // ── FHR Analysis ──
  if (fhrs.length >= 1) {
    const latestFhr = fhrs[fhrs.length - 1];
    if (latestFhr < 110) {
      deductions.push({
        type: 'danger',
        title: 'Fetal Bradycardia',
        detail: `FHR ${latestFhr} bpm is below normal range (110–160). Immediate evaluation needed — consider CTG monitoring and emergency assessment.`,
      });
    } else if (latestFhr > 160) {
      deductions.push({
        type: 'danger',
        title: 'Fetal Tachycardia',
        detail: `FHR ${latestFhr} bpm is above normal range (110–160). May indicate fetal distress, maternal fever, or infection. Investigate and monitor.`,
      });
    } else if (fhrs.length >= 2) {
      const allNormal = fhrs.every((f) => f >= 110 && f <= 160);
      if (allNormal) {
        deductions.push({
          type: 'good',
          title: 'Reassuring FHR Pattern',
          detail: `Fetal heart rate has been consistently within normal range (110–160 bpm) across all ${fhrs.length} readings.`,
        });
      }
    }
  }

  // ── Urinalysis Analysis ──
  if (latest.urine_protein) {
    const pLevel = urineToNum(latest.urine_protein);
    if (pLevel >= 3) {
      deductions.push({
        type: 'danger',
        title: 'Significant Proteinuria',
        detail: `Urine protein at ${latest.urine_protein}. Combined with hypertension, this suggests pre-eclampsia. Urgent evaluation needed.`,
      });
    } else if (pLevel >= 2) {
      deductions.push({
        type: 'warning',
        title: 'Proteinuria Detected',
        detail: `Urine protein at ${latest.urine_protein}. Monitor closely and correlate with BP trends. Consider 24-hour urine collection or PCR.`,
      });
    }
  }

  if (latest.urine_glucose) {
    const gLevel = urineToNum(latest.urine_glucose);
    if (gLevel >= 2) {
      deductions.push({
        type: 'warning',
        title: 'Glycosuria Detected',
        detail: `Urine glucose at ${latest.urine_glucose}. Screen for gestational diabetes — order fasting blood sugar or OGTT.`,
      });
    }
  }

  // ── Danger Signs ──
  const allDangerSigns = sorted.flatMap((o) => o.danger_signs || []);
  if (allDangerSigns.length > 0) {
    const uniqueSigns = [...new Set(allDangerSigns)];
    const recurrent = uniqueSigns.filter((s) =>
      sorted.filter((o) => o.danger_signs?.includes(s)).length >= 2,
    );
    if (recurrent.length > 0) {
      deductions.push({
        type: 'danger',
        title: 'Recurrent Danger Signs',
        detail: `${recurrent.join(', ')} — reported across multiple visits. Persistent danger signs require urgent clinical attention.`,
      });
    }
  }

  // ── No major issues ──
  if (deductions.length === 0) {
    deductions.push({
      type: 'good',
      title: 'No Concerns Identified',
      detail: 'Vitals and observations are within normal limits based on available data.',
    });
  }

  return deductions;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function urineToNum(val: string | null | undefined): number {
  if (!val) return 0;
  switch (val) {
    case 'nil': return 0;
    case 'trace': return 1;
    case '+': return 2;
    case '++': return 3;
    case '+++': return 4;
    default: return 0;
  }
}

function numToUrine(val: number): string {
  switch (val) {
    case 0: return 'nil';
    case 1: return 'trace';
    case 2: return '+';
    case 3: return '++';
    case 4: return '+++';
    default: return '';
  }
}

// ─── Obstetric Classification Helpers ────────────────────────────────────────

function classifyObsBP(sys?: number, dia?: number): { label: string; color: string } | null {
  if (sys == null || dia == null) return null;
  if (sys >= 160 || dia >= 110) return { label: '⚠ Severe Pre-eclampsia Range', color: 'text-red-600' };
  if (sys >= 140 || dia >= 90) return { label: 'Pre-eclampsia Range', color: 'text-amber-600' };
  if (sys >= 90 && dia >= 60) return { label: '✓ Normal', color: 'text-green-600' };
  return { label: 'Hypotension', color: 'text-blue-600' };
}

function classifyFHR(val?: number): { label: string; color: string } | null {
  if (val == null) return null;
  if (val >= 110 && val <= 160) return { label: '✓ Normal FHR', color: 'text-green-600' };
  if (val > 160) return { label: '⚠ Fetal Tachycardia', color: 'text-red-600' };
  return { label: '⚠ Fetal Bradycardia', color: 'text-red-600' };
}

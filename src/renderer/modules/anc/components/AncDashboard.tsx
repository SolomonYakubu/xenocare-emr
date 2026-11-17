// =============================================================================
// ANC Module — Dashboard
// Shows stats, today's schedule, active pregnancies list
// =============================================================================

import React, { useMemo, useState } from 'react';
import {
  Baby,
  CalendarCheck,
  AlertTriangle,
  Clock,
  HeartPulse,
  Users,
  ChevronRight,
  Stethoscope,
  Search,
  Download,
  X,
} from 'lucide-react';
import {
  useAncDashboardStats,
  useTodayAncSchedule,
  useActivePregnancies,
} from '../hooks/useAnc';
import { calculateGestationalAge } from '../api/anc.types';
import type { PregnancyEpisode } from '../api/anc.types';
import { exportAncReportPdf, filterPregnancies } from '../utils/ancReportPdf';
import type { AncReportFilters } from '../utils/ancReportPdf';

interface Props {
  onSelectPregnancy: (episode: PregnancyEpisode) => void;
  onNewEnrollment: () => void;
}

const RISK_BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  low: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  moderate: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  high: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

export default function AncDashboard({
  onSelectPregnancy,
  onNewEnrollment,
}: Props) {
  const { data: stats } = useAncDashboardStats();
  const {
    data: todaySchedule,
    isLoading: scheduleLoading,
    error: scheduleError,
  } = useTodayAncSchedule();
  const {
    data: pregnancies,
    isLoading: pregnanciesLoading,
    error: pregnanciesError,
  } = useActivePregnancies();

  // ── Pregnancies filters ──
  const [pregSearch, setPregSearch] = useState('');
  const [pregStatusFilter, setPregStatusFilter] = useState<
    'all' | 'today' | 'due-soon' | 'near-term' | 'post-dates' | 'high-risk'
  >('all');

  // ── Export modal ──
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState<AncReportFilters>({});
  const [exporting, setExporting] = useState(false);

  // Episode IDs that have a visit today (for "Today's Visits" filter chip)
  const todayEpisodeIds = useMemo<Set<string>>(() => {
    if (!todaySchedule) return new Set();
    return new Set(todaySchedule.map((v: any) => v.pregnancy_episode?.id).filter(Boolean));
  }, [todaySchedule]);

  // Filtered pregnancies
  const filteredPregnancies = useMemo(() => {
    if (!pregnancies) return [];
    return pregnancies.filter((ep) => {
      const name = `${ep.patient?.first_name || ''} ${ep.patient?.surname || ''}`.toLowerCase();
      const emr = (ep.patient?.emr_number || ep.patient?.patient_id || '').toLowerCase();
      const matchSearch = !pregSearch || name.includes(pregSearch.toLowerCase()) || emr.includes(pregSearch.toLowerCase());
      if (!matchSearch) return false;
      if (pregStatusFilter === 'all') return true;
      if (pregStatusFilter === 'today') return todayEpisodeIds.has(ep.id);
      const ga = calculateGestationalAge(ep.lmp);
      const weeks = ga?.weeks ?? 0;
      if (pregStatusFilter === 'high-risk') return ep.risk_level === 'high';
      if (pregStatusFilter === 'post-dates') return weeks >= 40;
      if (pregStatusFilter === 'due-soon') return weeks >= 37 && weeks < 40;
      if (pregStatusFilter === 'near-term') return weeks >= 34 && weeks < 37;
      return true;
    });
  }, [pregnancies, pregSearch, pregStatusFilter, todayEpisodeIds]);

  return (
    <div className="space-y-5">
      {/* Error Banner */}
      {(scheduleError || pregnanciesError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Error loading ANC data</p>
          <p className="text-xs mt-1 text-red-500">
            {(scheduleError as Error)?.message ||
              (pregnanciesError as Error)?.message ||
              'Check that ANC tables exist in the database'}
          </p>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 transition-all hover:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50">
              <Users className="h-4 w-4 text-pink-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-pink-600">{stats?.totalActive ?? 0}</div>
              <div className="text-[11px] font-medium text-gray-400">Active Pregnancies</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 transition-all hover:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <CalendarCheck className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-blue-600">{stats?.todayVisits ?? 0}</div>
              <div className="text-[11px] font-medium text-gray-400">Today's Visits</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 transition-all hover:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-red-600">{stats?.highRisk ?? 0}</div>
              <div className="text-[11px] font-medium text-gray-400">High Risk</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 transition-all hover:shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-amber-600">{stats?.overdueVisits ?? 0}</div>
              <div className="text-[11px] font-medium text-gray-400">Overdue Visits</div>
            </div>
          </div>
        </div>
      </div>

      {/* All Active Pregnancies */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Baby className="h-4 w-4 text-pink-500" />
              Active Pregnancies
            </h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-medium text-pink-700">
                {filteredPregnancies.length} / {pregnancies?.length || 0}
              </span>
              <button
                onClick={() => { setExportFilters({}); setShowExportModal(true); }}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export PDF
              </button>
              <button
                onClick={onNewEnrollment}
                className="flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700 transition-colors shadow-sm"
              >
                <HeartPulse className="h-3.5 w-3.5" />
                New Enrollment
              </button>
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or patient number…"
              value={pregSearch}
              onChange={(e) => setPregSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-pink-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-200"
            />
          </div>
          {/* Status filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'today', label: `Today's Schedule (${todayEpisodeIds.size})` },
                { key: 'post-dates', label: '⚠ Post-dates (≥40w)' },
                { key: 'due-soon', label: 'Due Soon (37–39w)' },
                { key: 'near-term', label: 'Near Term (34–36w)' },
                { key: 'high-risk', label: 'High Risk' },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPregStatusFilter(key)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  pregStatusFilter === key
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-50 max-h-[400px] overflow-auto">
          {pregnanciesLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse p-2">
                  <div className="h-9 w-9 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPregnancies.length > 0 ? (
            filteredPregnancies.map((ep) => {
              const ga = calculateGestationalAge(ep.lmp);
              const risk = RISK_BADGE[ep.risk_level] || RISK_BADGE.low;
              const delivery = getDeliveryStatus(ga?.weeks);
              const initials = `${ep.patient?.first_name?.[0] || ''}${ep.patient?.surname?.[0] || ''}`;
              return (
                <button
                  key={ep.id}
                  onClick={() => onSelectPregnancy(ep)}
                  className="group w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="h-9 w-9 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {ep.patient?.first_name} {ep.patient?.surname}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                      <span className="font-mono">{ep.patient?.emr_number || ep.patient?.patient_id}</span>
                      <span>·</span>
                      <span>{ga ? `${ga.weeks}w ${ga.days}d` : '—'}</span>
                      <span>·</span>
                      <span>G{ep.gravida}P{ep.parity}A{ep.abortions}</span>
                      {ep.edd && (
                        <>
                          <span>·</span>
                          <span>EDD {new Date(ep.edd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {delivery && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${delivery.bg} ${delivery.text}`}>
                        {delivery.label}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${risk.bg} ${risk.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${risk.dot}`} />
                      {ep.risk_level}
                    </span>
                    {ep.primary_doctor && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                        <Stethoscope className="h-3 w-3" />
                        Dr. {ep.primary_doctor.last_name}
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50 mb-3">
                <Baby className="h-6 w-6 text-pink-400" />
              </div>
              {pregSearch || pregStatusFilter !== 'all' ? (
                <>
                  <p className="text-sm text-gray-600 font-medium">No pregnancies match your filter</p>
                  <button
                    onClick={() => { setPregSearch(''); setPregStatusFilter('all'); }}
                    className="mt-2 text-[11px] text-pink-500 hover:underline"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 font-medium">No active pregnancies</p>
                  <p className="text-xs text-gray-400 mt-1">Use New Enrollment to register a patient</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Export PDF Modal ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Download className="h-4 w-4 text-pink-600" />
                Export ANC Monthly Report (PDF)
              </h3>
              <button onClick={() => setShowExportModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
              {/* ── Patient Demographics ── */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Patient Demographics</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Patient Category</label>
                    <select
                      value={exportFilters.patient_category || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, patient_category: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All Categories</option>
                      <option value="Civilian">Civilian</option>
                      <option value="Military">Military</option>
                      <option value="Staff">Staff</option>
                      <option value="Student">Student</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Insurance Type</label>
                    <select
                      value={exportFilters.insurance_type || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, insurance_type: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All Insurance Types</option>
                      <option value="Civilian_NHIS">Civilian NHIS</option>
                      <option value="Military_NHIS">Military NHIS</option>
                      <option value="GIFSHIP">GIFSHIP</option>
                      <option value="DHML">DHML</option>
                      <option value="Retainership">Retainership</option>
                      <option value="Private">Private (Out-of-pocket)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Clinical Filters ── */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Clinical Filters</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Risk Level</label>
                    <select
                      value={exportFilters.risk_level || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, risk_level: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All Risk Levels</option>
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Trimester</label>
                    <select
                      value={exportFilters.trimester || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, trimester: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All Trimesters</option>
                      <option value="1">1st Trimester (&lt;14w)</option>
                      <option value="2">2nd Trimester (14–27w)</option>
                      <option value="3">3rd Trimester (≥28w)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Gravida Type</label>
                    <select
                      value={exportFilters.gravida_type || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, gravida_type: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All</option>
                      <option value="primigravida">Primigravida (G1)</option>
                      <option value="multigravida">Multigravida (G2+)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Blood & Genetics ── */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Blood &amp; Genetics</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Blood Group</label>
                    <select
                      value={exportFilters.blood_group || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, blood_group: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All Blood Groups</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="AB">AB</option>
                      <option value="O">O</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rhesus Factor</label>
                    <select
                      value={exportFilters.rhesus_factor || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, rhesus_factor: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All</option>
                      <option value="positive">Rh Positive (+)</option>
                      <option value="negative">Rh Negative (−)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Genotype</label>
                    <select
                      value={exportFilters.genotype || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, genotype: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All Genotypes</option>
                      <option value="AA">AA</option>
                      <option value="AS">AS</option>
                      <option value="SS">SS</option>
                      <option value="AC">AC</option>
                      <option value="SC">SC</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Status & Booking ── */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Status</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pregnancy Status</label>
                    <select
                      value={exportFilters.status || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, status: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="delivered">Delivered</option>
                      <option value="transferred">Transferred</option>
                      <option value="lost_to_followup">Lost to Follow-up</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Booking Status</label>
                    <select
                      value={exportFilters.booking_status || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, booking_status: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    >
                      <option value="">All</option>
                      <option value="booked">Booked</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Date Ranges ── */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Date Ranges</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Enrollment From</label>
                    <input
                      type="date"
                      value={exportFilters.enrollment_from || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, enrollment_from: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Enrollment To</label>
                    <input
                      type="date"
                      value={exportFilters.enrollment_to || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, enrollment_to: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">EDD From</label>
                    <input
                      type="date"
                      value={exportFilters.edd_from || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, edd_from: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">EDD To</label>
                    <input
                      type="date"
                      value={exportFilters.edd_to || ''}
                      onChange={(e) => setExportFilters((f) => ({ ...f, edd_to: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-300 focus:ring-1 focus:ring-pink-200 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Preview count + Clear filters */}
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  <span className="font-bold text-pink-700">
                    {pregnancies ? filterPregnancies(pregnancies, exportFilters).length : 0}
                  </span>{' '}
                  of {pregnancies?.length || 0} records match
                </span>
                {Object.values(exportFilters).some(Boolean) && (
                  <button
                    onClick={() => setExportFilters({})}
                    className="text-xs text-pink-600 hover:underline font-medium"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={exporting || !pregnancies || filterPregnancies(pregnancies, exportFilters).length === 0}
                onClick={async () => {
                  if (!pregnancies) return;
                  setExporting(true);
                  try {
                    const filtered = filterPregnancies(pregnancies, exportFilters);
                    await exportAncReportPdf(filtered, { filters: exportFilters });
                  } finally {
                    setExporting(false);
                    setShowExportModal(false);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function getDeliveryStatus(weeks: number | undefined): { label: string; bg: string; text: string } | null {
  if (weeks === undefined || weeks === null) return null;
  if (weeks >= 40) return { label: '⚠ Post-dates', bg: 'bg-red-50', text: 'text-red-700' };
  if (weeks >= 37) return { label: 'Due Soon', bg: 'bg-orange-50', text: 'text-orange-700' };
  if (weeks >= 34) return { label: 'Near Term', bg: 'bg-yellow-50', text: 'text-yellow-700' };
  return null;
}

function LoadingRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="px-5 py-3 animate-pulse flex items-center gap-3"
        >
          <div className="h-9 w-9 rounded-full bg-gray-200" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 bg-gray-200 rounded w-1/3" />
            <div className="h-2.5 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}

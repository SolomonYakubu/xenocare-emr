/**
 * XenoCare
 * Reusable Filter Panel — used across all medical module report systems
 *
 * Renders date range, patient search, status, and module-specific filters.
 * All changes immediately update the parent via `onChange`.
 */

import React, { useId, useState } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  isNhisCategory,
  isNhisFeatureEnabled,
} from '../../../config/features';
import type {
  BaseExportFilters,
  LabExportFilters,
  ImagingExportFilters,
  ProcedureExportFilters,
  DentalExportFilters,
  PhysioExportFilters,
  OphthalmologyExportFilters,
  DateRangePreset,
} from '../types/report.types';
import {
  resolveDateRange,
  toDateEndIso,
  toDateStartIso,
  toInputDateValue,
} from '../types/report.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FilterModule =
  | 'lab'
  | 'imaging'
  | 'procedure'
  | 'dental'
  | 'physio'
  | 'ophthalmology';

export type ModuleFilters =
  | LabExportFilters
  | ImagingExportFilters
  | ProcedureExportFilters
  | DentalExportFilters
  | PhysioExportFilters
  | OphthalmologyExportFilters;

interface FilterPanelProps<T extends BaseExportFilters> {
  module: FilterModule;
  filters: T;
  onChange: (updated: T) => void;
  onReset: () => void;
  /** Optional list of status options specific to the calling module */
  statusOptions?: { value: string; label: string }[];
  className?: string;
}

const PRESET_LABELS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function LabFilters({
  filters,
  onChange,
}: {
  filters: LabExportFilters;
  onChange: (f: LabExportFilters) => void;
}) {
  const categoryListId = useId();

  const CATEGORY_SUGGESTIONS = [
    'Hematology',
    'Haematology',
    'Chemical Pathology',
    'Biochemistry',
    'Microbiology',
    'Serology',
    'Immunology',
    'Histopathology',
    'Urinalysis',
    'Parasitology',
    'Other',
  ];

  const PATIENT_CATEGORIES = [
    'Military',
    'Civilian',
    'Military Participant',
    'Civilian Participant',
    'Security Services',
  ];

  const INSURANCE_TYPES = [
    'Private',
    'Military_NHIS',
    'DHML',
    'Civilian_NHIS',
    'GIFSHIP',
    'Security_Services_NHIS',
    'Retainership',
  ].filter(
    (insuranceType) =>
      isNhisFeatureEnabled() || !isNhisCategory(insuranceType),
  );

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Lab Category
        </label>
        <input
          type="text"
          list={categoryListId}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.labCategory || ''}
          onChange={(e) =>
            onChange({ ...filters, labCategory: e.target.value || undefined })
          }
          placeholder="All categories or type a category"
        />
        <datalist id={categoryListId}>
          {CATEGORY_SUGGESTIONS.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Result Flag
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.resultStatus || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              resultStatus: (e.target.value as any) || undefined,
            })
          }
        >
          <option value="">All Results</option>
          <option value="normal">Normal</option>
          <option value="abnormal">Abnormal</option>
          <option value="critical">Critical</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Patient Category
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.patientCategory || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              patientCategory: e.target.value || undefined,
            })
          }
        >
          <option value="">All Patient Categories</option>
          {PATIENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Insurance Type
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.insuranceType || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              insuranceType: e.target.value || undefined,
            })
          }
        >
          <option value="">All Insurance Types</option>
          {INSURANCE_TYPES.map((insuranceType) => (
            <option key={insuranceType} value={insuranceType}>
              {insuranceType}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Coverage Segment
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.coverageGroup || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              coverageGroup:
                (e.target.value as LabExportFilters['coverageGroup']) ||
                undefined,
            })
          }
        >
          <option value="">All Coverage Segments</option>
          {isNhisFeatureEnabled() && (
            <>
              <option value="all_nhis">All NHIS Patients</option>
              <option value="civilian_nhis">Civilian NHIS / GIFSHIP</option>
              <option value="military_nhis">Military NHIS / DHML</option>
              <option value="security_nhis">Security Services NHIS</option>
            </>
          )}
          <option value="retainership">Retainership</option>
          <option value="private">Private / Cash</option>
        </select>
      </div>
    </>
  );
}

function ImagingFilters({
  filters,
  onChange,
}: {
  filters: ImagingExportFilters;
  onChange: (f: ImagingExportFilters) => void;
}) {
  const MODALITIES = [
    'X-Ray',
    'CT Scan',
    'MRI',
    'Ultrasound',
    'Mammography',
    'Fluoroscopy',
    'Other',
  ];
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Modality / Scan Type
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.modalityType || ''}
          onChange={(e) =>
            onChange({ ...filters, modalityType: e.target.value || undefined })
          }
        >
          <option value="">All Modalities</option>
          {MODALITIES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Report Status
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={
            filters.hasReport === undefined
              ? ''
              : filters.hasReport
                ? 'reported'
                : 'unreported'
          }
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              hasReport: v === '' ? undefined : v === 'reported',
            });
          }}
        >
          <option value="">All</option>
          <option value="reported">Reported</option>
          <option value="unreported">Unreported</option>
        </select>
      </div>
    </>
  );
}

function ProcedureFilters({
  filters,
  onChange,
}: {
  filters: ProcedureExportFilters;
  onChange: (f: ProcedureExportFilters) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Priority
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.priority || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              priority: (e.target.value as any) || undefined,
            })
          }
        >
          <option value="">All Priorities</option>
          <option value="Elective">Elective</option>
          <option value="Urgent">Urgent</option>
          <option value="Emergency">Emergency</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Complications
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={
            filters.hasComplication === undefined
              ? ''
              : filters.hasComplication
                ? 'yes'
                : 'no'
          }
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              hasComplication: v === '' ? undefined : v === 'yes',
            });
          }}
        >
          <option value="">All Cases</option>
          <option value="yes">With Complications</option>
          <option value="no">No Complications</option>
        </select>
      </div>
    </>
  );
}

function DentalFilters({
  filters,
  onChange,
}: {
  filters: DentalExportFilters;
  onChange: (f: DentalExportFilters) => void;
}) {
  const PROC_TYPES = [
    'Scaling',
    'Filling',
    'Extraction',
    'Root Canal',
    'Crown',
    'Denture',
    'Orthodontic',
    'Whitening',
    'Examination',
    'X-Ray',
  ];
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Procedure Type
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.procedureType || ''}
          onChange={(e) =>
            onChange({ ...filters, procedureType: e.target.value || undefined })
          }
        >
          <option value="">All Procedures</option>
          {PROC_TYPES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Visit Type
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.visitType || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              visitType: (e.target.value as any) || undefined,
            })
          }
        >
          <option value="">All Visits</option>
          <option value="Routine">Routine</option>
          <option value="Emergency">Emergency</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Treatment Status
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={
            filters.treatmentComplete === undefined
              ? ''
              : filters.treatmentComplete
                ? 'complete'
                : 'incomplete'
          }
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              treatmentComplete: v === '' ? undefined : v === 'complete',
            });
          }}
        >
          <option value="">All</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
        </select>
      </div>
    </>
  );
}

function PhysioFilters({
  filters,
  onChange,
}: {
  filters: PhysioExportFilters;
  onChange: (f: PhysioExportFilters) => void;
}) {
  const CONDITIONS = [
    'Back Pain',
    'Stroke Rehabilitation',
    'Fracture',
    'Osteoarthritis',
    'Post-surgical Rehabilitation',
    'Cerebral Palsy',
    'Sports Injury',
    'Paralysis',
    'Other',
  ];
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Condition
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.condition || ''}
          onChange={(e) =>
            onChange({ ...filters, condition: e.target.value || undefined })
          }
        >
          <option value="">All Conditions</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Plan Status
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.planStatus || ''}
          onChange={(e) =>
            onChange({ ...filters, planStatus: e.target.value || undefined })
          }
        >
          <option value="">All</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Discontinued">Discontinued</option>
          <option value="On Hold">On Hold</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Progress
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.progressStatus || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              progressStatus: (e.target.value as any) || undefined,
            })
          }
        >
          <option value="">All</option>
          <option value="improving">Improving</option>
          <option value="no_change">No Change</option>
          <option value="worsening">Worsening</option>
        </select>
      </div>
    </>
  );
}

function OphthalmologyFilters({
  filters,
  onChange,
}: {
  filters: OphthalmologyExportFilters;
  onChange: (f: OphthalmologyExportFilters) => void;
}) {
  const CONDITIONS = [
    'Cataract',
    'Glaucoma',
    'Refractive Error',
    'Diabetic Retinopathy',
    'Age-related Macular Degeneration',
    'Conjunctivitis',
    'Dry Eye',
    'Uveitis',
    'Other',
  ];
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Condition / Diagnosis
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={filters.condition || ''}
          onChange={(e) =>
            onChange({ ...filters, condition: e.target.value || undefined })
          }
        >
          <option value="">All Conditions</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Pending Surgery
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={
            filters.pendingSurgery === undefined
              ? ''
              : filters.pendingSurgery
                ? 'yes'
                : 'no'
          }
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              pendingSurgery: v === '' ? undefined : v === 'yes',
            });
          }}
        >
          <option value="">All</option>
          <option value="yes">Pending Surgery</option>
          <option value="no">No Surgery Pending</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Prescription
        </label>
        <select
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          value={
            filters.hasPrescription === undefined
              ? ''
              : filters.hasPrescription
                ? 'yes'
                : 'no'
          }
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              hasPrescription: v === '' ? undefined : v === 'yes',
            });
          }}
        >
          <option value="">All</option>
          <option value="yes">Has Prescription</option>
          <option value="no">No Prescription</option>
        </select>
      </div>
    </>
  );
}

// ─── Main FilterPanel ─────────────────────────────────────────────────────────

export function FilterPanel<T extends BaseExportFilters>({
  module,
  filters,
  onChange,
  onReset,
  statusOptions,
  className = '',
}: FilterPanelProps<T>) {
  const [expanded, setExpanded] = useState(true);
  const [useCustomDate, setUseCustomDate] = useState(
    filters.dateRange.preset === 'custom',
  );

  function handlePreset(preset: DateRangePreset) {
    if (preset === 'custom') {
      setUseCustomDate(true);
      onChange({
        ...filters,
        dateRange: { ...filters.dateRange, preset: 'custom' },
      });
    } else {
      setUseCustomDate(false);
      onChange({ ...filters, dateRange: resolveDateRange(preset) });
    }
  }

  function handleCustomDate(field: 'from' | 'to', value: string) {
    onChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: field === 'from' ? toDateStartIso(value) : toDateEndIso(value),
        preset: 'custom',
      },
    });
  }

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-t-xl"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter size={15} />
          <span>Filters &amp; Export Controls</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            <X size={12} /> Reset
          </button>
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 border-t border-gray-100">
          {/* Date range preset */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Date Range
            </label>
            <select
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={filters.dateRange.preset || 'custom'}
              onChange={(e) => handlePreset(e.target.value as DateRangePreset)}
            >
              {PRESET_LABELS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom date fields */}
          {useCustomDate && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={toInputDateValue(filters.dateRange.from)}
                  onChange={(e) => handleCustomDate('from', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={toInputDateValue(filters.dateRange.to)}
                  onChange={(e) => handleCustomDate('to', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Patient search */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Patient Name / EMR No.
            </label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-2.5 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search patient..."
                className="w-full text-sm border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={filters.patientSearch || ''}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    patientSearch: e.target.value || undefined,
                  })
                }
              />
            </div>
          </div>

          {/* Status */}
          {statusOptions && statusOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={filters.status || ''}
                onChange={(e) =>
                  onChange({ ...filters, status: e.target.value || undefined })
                }
              >
                <option value="">All Statuses</option>
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Module-specific filters */}
          {module === 'lab' && (
            <LabFilters
              filters={filters as LabExportFilters}
              onChange={(f) => onChange(f as T)}
            />
          )}
          {module === 'imaging' && (
            <ImagingFilters
              filters={filters as ImagingExportFilters}
              onChange={(f) => onChange(f as T)}
            />
          )}
          {module === 'procedure' && (
            <ProcedureFilters
              filters={filters as ProcedureExportFilters}
              onChange={(f) => onChange(f as T)}
            />
          )}
          {module === 'dental' && (
            <DentalFilters
              filters={filters as DentalExportFilters}
              onChange={(f) => onChange(f as T)}
            />
          )}
          {module === 'physio' && (
            <PhysioFilters
              filters={filters as PhysioExportFilters}
              onChange={(f) => onChange(f as T)}
            />
          )}
          {module === 'ophthalmology' && (
            <OphthalmologyFilters
              filters={filters as OphthalmologyExportFilters}
              onChange={(f) => onChange(f as T)}
            />
          )}
        </div>
      )}
    </div>
  );
}

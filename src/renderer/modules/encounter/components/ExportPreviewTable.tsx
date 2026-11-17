/**
 * =============================================================================
 * XENOCARE EMR - EXPORT PREVIEW TABLE
 * Description: Scrollable data preview with checkbox selection for exports
 * =============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  CheckSquare,
  Square,
  MinusSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react';
import { Encounter } from '../dtos/encounter.dto';
import { formatEncounterForExport, EncounterExportData } from '../utils/encounterExport';

// =============================================================================
// Types
// =============================================================================

export interface ExportColumn {
  key: keyof EncounterExportData;
  label: string;
  visible: boolean;
  width?: string;
}

/** Full column definitions available for export */
export const ALL_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'encounter_number', label: 'Encounter #', visible: true, width: 'w-28' },
  { key: 'patient_name', label: 'Patient Name', visible: true, width: 'w-40' },
  { key: 'emr_number', label: 'Patient number', visible: true, width: 'w-24' },
  { key: 'gender', label: 'Gender', visible: true, width: 'w-16' },
  { key: 'age', label: 'Age', visible: true, width: 'w-16' },
  { key: 'visit_type', label: 'Visit Type', visible: true, width: 'w-24' },
  { key: 'status', label: 'Status', visible: true, width: 'w-20' },
  { key: 'priority', label: 'Priority', visible: true, width: 'w-20' },
  { key: 'department', label: 'Department', visible: true, width: 'w-28' },
  { key: 'attending_doctor', label: 'Doctor', visible: true, width: 'w-32' },
  { key: 'encounter_date', label: 'Date', visible: true, width: 'w-24' },
  { key: 'chief_complaint', label: 'Chief Complaint', visible: false, width: 'w-40' },
  { key: 'payment_category', label: 'Payment Category', visible: true, width: 'w-28' },
  { key: 'patient_category', label: 'Patient Category', visible: false, width: 'w-24' },
  { key: 'insurance_type', label: 'Insurance Type', visible: false, width: 'w-24' },
  { key: 'phone', label: 'Phone', visible: false, width: 'w-28' },
  { key: 'created_at', label: 'Created At', visible: false, width: 'w-32' },
];

interface ExportPreviewTableProps {
  encounters: Encounter[];
  columns: ExportColumn[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  isNightMode?: boolean;
}

type SortDir = 'asc' | 'desc' | null;

// =============================================================================
// Component
// =============================================================================

export const ExportPreviewTable: React.FC<ExportPreviewTableProps> = ({
  encounters,
  columns,
  selectedIds,
  onSelectionChange,
  isNightMode = false,
}) => {
  const [sortKey, setSortKey] = useState<keyof EncounterExportData | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [previewSearch, setPreviewSearch] = useState('');

  const visibleCols = useMemo(() => columns.filter((c) => c.visible), [columns]);

  // Transform encounters to export rows
  const rows = useMemo(
    () =>
      encounters.map((e) => ({
        id: e.visit_id || e.id,
        data: formatEncounterForExport(e),
      })),
    [encounters],
  );

  // Filter by preview search
  const filteredRows = useMemo(() => {
    if (!previewSearch.trim()) return rows;
    const q = previewSearch.toLowerCase();
    return rows.filter((r) =>
      Object.values(r.data).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, previewSearch]);

  // Sort
  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const aVal = String(a.data[sortKey] || '');
      const bVal = String(b.data[sortKey] || '');
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [filteredRows, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: keyof EncounterExportData) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
        if (sortDir === 'desc') setSortKey(null);
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey, sortDir],
  );

  // Selection helpers
  const allSelected = sortedRows.length > 0 && sortedRows.every((r) => selectedIds.has(r.id));
  const someSelected = sortedRows.some((r) => selectedIds.has(r.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(sortedRows.map((r) => r.id)));
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const bg = isNightMode ? 'bg-slate-800' : 'bg-white';
  const headerBg = isNightMode ? 'bg-slate-700' : 'bg-indigo-50';
  const borderColor = isNightMode ? 'border-slate-600' : 'border-indigo-100';
  const textPrimary = isNightMode ? 'text-gray-200' : 'text-gray-800';
  const textSecondary = isNightMode ? 'text-gray-400' : 'text-gray-500';
  const rowHover = isNightMode ? 'hover:bg-slate-700/50' : 'hover:bg-indigo-50/40';
  const selectedBg = isNightMode ? 'bg-indigo-900/20' : 'bg-indigo-50/60';

  return (
    <div className="flex flex-col gap-3">
      {/* Search + count */}
      <div className="flex items-center justify-between gap-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isNightMode ? 'border-slate-600 bg-slate-700' : 'border-indigo-200 bg-white'} flex-1 max-w-xs`}>
          <Search className={`h-3.5 w-3.5 ${textSecondary}`} />
          <input
            type="text"
            placeholder="Search preview..."
            value={previewSearch}
            onChange={(e) => setPreviewSearch(e.target.value)}
            className={`text-xs bg-transparent outline-none w-full ${textPrimary}`}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${textSecondary}`}>
            {selectedIds.size} of {sortedRows.length} selected
          </span>
          <button
            onClick={toggleAll}
            className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
              allSelected
                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
        <div className="overflow-x-auto overflow-y-auto max-h-[340px]">
          <table className={`w-full text-xs ${bg}`}>
            <thead className={`sticky top-0 z-10 ${headerBg}`}>
              <tr>
                {/* Checkbox header */}
                <th className={`px-3 py-2.5 border-b ${borderColor} w-10`}>
                  <button onClick={toggleAll} className="flex items-center justify-center">
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600" />
                    ) : someSelected ? (
                      <MinusSquare className="h-4 w-4 text-indigo-400" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className={`px-2 py-2.5 border-b ${borderColor} text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-10`}>
                  #
                </th>
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2.5 border-b ${borderColor} text-left cursor-pointer select-none group`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${isNightMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                        {col.label}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortKey === col.key && sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-indigo-500" />
                        ) : sortKey === col.key && sortDir === 'desc' ? (
                          <ArrowDown className="h-3 w-3 text-indigo-500" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-400" />
                        )}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleCols.length + 2}
                    className={`text-center py-8 ${textSecondary}`}
                  >
                    No records match your criteria
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => {
                  const isSelected = selectedIds.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => toggleRow(row.id)}
                      className={`cursor-pointer border-b last:border-b-0 ${borderColor} transition-colors ${
                        isSelected ? selectedBg : idx % 2 === 0 ? bg : isNightMode ? 'bg-slate-750' : 'bg-gray-50/40'
                      } ${rowHover}`}
                    >
                      <td className="px-3 py-2">
                        {isSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </td>
                      <td className={`px-2 py-2 ${textSecondary} tabular-nums`}>{idx + 1}</td>
                      {visibleCols.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2 ${textPrimary} truncate max-w-[200px]`}
                          title={String(row.data[col.key] || '')}
                        >
                          {col.key === 'status' ? (
                            <StatusBadge value={row.data.status} />
                          ) : col.key === 'priority' ? (
                            <PriorityBadge value={row.data.priority} />
                          ) : (
                            row.data[col.key] || '—'
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Inline Badges
// =============================================================================

const StatusBadge: React.FC<{ value: string }> = ({ value }) => {
  const colors: Record<string, string> = {
    Completed: 'bg-emerald-100 text-emerald-700',
    Active: 'bg-blue-100 text-blue-700',
    Waiting: 'bg-amber-100 text-amber-700',
    Cancelled: 'bg-red-100 text-red-700',
    'In Progress': 'bg-sky-100 text-sky-700',
    Closed: 'bg-gray-100 text-gray-600',
    Created: 'bg-indigo-100 text-indigo-600',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${colors[value] || 'bg-gray-100 text-gray-600'}`}>
      {value}
    </span>
  );
};

const PriorityBadge: React.FC<{ value: string }> = ({ value }) => {
  const colors: Record<string, string> = {
    Emergency: 'bg-red-100 text-red-700',
    Urgent: 'bg-orange-100 text-orange-700',
    Normal: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${colors[value] || 'bg-gray-100 text-gray-600'}`}>
      {value}
    </span>
  );
};

/**
 * Records History Page
 * XENOCARE EMR
 *
 * Admin-facing unified records history with category tabs, filters, and export.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { isNhisFeatureEnabled } from '../../../config/features';
import {
  History,
  Download,
  Search,
  Filter,
  FileText,
  Table2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react';
import { useRecordsHistory } from '../hooks/useRecordsHistory';
import { exportRecordsPDF, exportRecordsCSV } from '../utils/records-export';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import type {
  RecordCategory,
  RecordsHistoryFilters,
  RecordsExportFormat,
} from '../types/records-history.types';
import {
  RECORD_CATEGORIES,
  getDefaultFilters,
} from '../types/records-history.types';

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  filters: RecordsHistoryFilters;
  onChange: (f: Partial<RecordsHistoryFilters>) => void;
  onReset: () => void;
}

function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Show</label>
        <select
          value={filters.category}
          onChange={(e) =>
            onChange({
              category: e.target.value as RecordCategory | 'all',
              page: 1,
            })
          }
          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-[#E9783F]"
        >
          <option value="all">All records</option>
          {RECORD_CATEGORIES.map((category) => (
            <option key={category.key} value={category.key}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">From</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ dateFrom: e.target.value, page: 1 })}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-36 focus:border-[#E9783F] focus:ring-1 focus:ring-[#E9783F]/20"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">To</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ dateTo: e.target.value, page: 1 })}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-36 focus:border-[#E9783F] focus:ring-1 focus:ring-[#E9783F]/20"
        />
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <label className="text-xs text-gray-500 font-medium">Search</label>
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Patient name, patient number or test"
            value={filters.searchTerm}
            onChange={(e) =>
              onChange({ searchTerm: e.target.value, page: 1 })
            }
            className="border border-gray-300 rounded pl-8 pr-2 py-1.5 text-sm w-full focus:border-[#E9783F] focus:ring-1 focus:ring-[#E9783F]/20"
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Status</label>
        <input
          type="text"
          placeholder="e.g. Active, Completed"
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value, page: 1 })}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-40 focus:border-[#E9783F] focus:ring-1 focus:ring-[#E9783F]/20"
        />
      </div>

      {/* Department */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Department</label>
        <input
          type="text"
          placeholder="e.g. Lab, Radiology"
          value={filters.department}
          onChange={(e) => onChange({ department: e.target.value, page: 1 })}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-36 focus:border-[#E9783F] focus:ring-1 focus:ring-[#E9783F]/20"
        />
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors self-end"
        title="Reset filters"
      >
        <X className="h-3.5 w-3.5" />
        Reset
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export dropdown
// ---------------------------------------------------------------------------

interface ExportDropdownProps {
  onExport: (format: RecordsExportFormat) => void;
  isExporting: boolean;
}

function ExportDropdown({ onExport, isExporting }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isExporting}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#E9783F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#D96A36] disabled:opacity-50"
      >
        {isExporting ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export
      </button>
      {open && !isExporting && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1">
            <button
              onClick={() => {
                onExport('pdf');
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <FileText className="h-4 w-4 text-red-500" />
              Export as PDF
            </button>
            <button
              onClick={() => {
                onExport('csv');
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Table2 className="h-4 w-4 text-green-600" />
              Export as CSV
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-2 py-3">
      <span className="text-xs text-gray-500">
        Showing {(page - 1) * pageSize + 1}–
        {Math.min(page * pageSize, total)} of {total} records
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let p: number;
          if (totalPages <= 7) {
            p = i + 1;
          } else if (page <= 4) {
            p = i + 1;
          } else if (page >= totalPages - 3) {
            p = totalPages - 6 + i;
          } else {
            p = page - 3 + i;
          }
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                p === page
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = 'bg-gray-100 text-gray-700';
  if (s.includes('completed') || s.includes('approved') || s.includes('paid'))
    cls = 'bg-green-100 text-green-700';
  else if (s.includes('active') || s.includes('progress'))
    cls = 'bg-blue-100 text-blue-700';
  else if (s.includes('pending') || s.includes('provisional'))
    cls = 'bg-amber-100 text-amber-700';
  else if (s.includes('cancelled') || s.includes('rejected'))
    cls = 'bg-red-100 text-red-700';

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || '—'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Category badge
// ---------------------------------------------------------------------------

function CategoryBadge({ category }: { category: string }) {
  const meta = RECORD_CATEGORIES.find((c) => c.label === category);
  const bg = meta?.color ?? 'bg-gray-500';
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${bg}`}
    >
      {category}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RecordsHistoryPage() {
  const { staff } = useAuth();
  const { addToast } = useToast();
  const [filters, setFilters] = useState<RecordsHistoryFilters>(
    getDefaultFilters(),
  );
  const [isExporting, setIsExporting] = useState(false);

  const updateFilters = useCallback(
    (partial: Partial<RecordsHistoryFilters>) =>
      setFilters((prev) => ({ ...prev, ...partial })),
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(getDefaultFilters());
  }, []);

  const debouncedFilters = useMemo(() => filters, [filters]);

  const { data, isLoading, isFetching, refetch } =
    useRecordsHistory(debouncedFilters);

  const records = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;

  // Export handler
  const handleExport = useCallback(
    async (format: RecordsExportFormat) => {
      if (records.length === 0) {
        addToast({ type: 'warning', message: 'No records to export.' });
        return;
      }

      setIsExporting(true);
      try {
        const opts = {
          format,
          title: `Records History — ${
            filters.category === 'all'
              ? 'All Categories'
              : (RECORD_CATEGORIES.find((c) => c.key === filters.category)
                  ?.label ?? filters.category)
          }`,
          filters,
          generatedBy: staff
            ? `${staff.first_name} ${staff.last_name}`
            : 'System',
        };

        if (format === 'pdf') {
          await exportRecordsPDF(records, opts);
        } else {
          exportRecordsCSV(records, opts);
        }

        addToast({
          type: 'success',
          message: `${format.toUpperCase()} export downloaded.`,
        });
      } catch (err) {
        addToast({
          type: 'error',
          message: `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      } finally {
        setIsExporting(false);
      }
    },
    [records, filters, staff, addToast],
  );

  return (
    <div className="space-y-4 p-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Records history
          </h1>
          <p className="text-sm text-slate-500">
            Browse and export records from every department
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <ExportDropdown onExport={handleExport} isExporting={isExporting} />
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      {/* Summary strip */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4" />
          <span>
            <strong>{totalCount}</strong> records
          </span>
        </div>
        {filters.category !== 'all' && (
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
            {RECORD_CATEGORIES.find((c) => c.key === filters.category)?.label}
          </span>
        )}
        {isNhisFeatureEnabled() && records.some((r) => r.nhisRelated) && (
          <div className="flex items-center gap-1 text-green-700">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-xs">NHIS records included</span>
          </div>
        )}
      </div>

      {/* Data table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-10">
                  #
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-24">
                  Date
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">
                  Category
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Patient
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-24">
                  Patient number
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Title
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 w-28">
                  Staff
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
                    <span className="text-gray-400 text-sm">
                      Loading records…
                    </span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <History className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">
                      No records found for the selected filters.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => (
                  <tr
                    key={`${r.category}-${r.id}-${idx}`}
                    className="border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2 text-gray-400 text-xs">
                      {(filters.page - 1) * filters.pageSize + idx + 1}
                    </td>
                    <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">
                      {fmtDate(r.date)}
                    </td>
                    <td className="px-3 py-2">
                      <CategoryBadge category={r.categoryLabel} />
                    </td>
                    <td className="px-3 py-2 text-gray-800 font-medium">
                      {r.patientName}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs font-mono">
                      {r.emrNumber || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 max-w-xs truncate">
                      {r.title}
                      {r.description && r.description !== '—' && (
                        <span className="block text-xs text-gray-400 truncate">
                          {r.description}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {r.staffName || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          page={filters.page}
          total={totalCount}
          pageSize={filters.pageSize}
          onChange={(p) => updateFilters({ page: p })}
        />
      </div>
    </div>
  );
}

// Helper
function fmtDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

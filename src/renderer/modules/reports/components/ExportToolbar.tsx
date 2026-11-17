/**
 * XenoCare
 * Export Toolbar — reusable CSV / Excel / PDF export button group
 *
 * Renders three export buttons. Calls the parent's `onExport` callback
 * with the chosen format. Shows a spinner while an export is in progress.
 */

import React, { useState } from 'react';
import {
  Download,
  FileText,
  Table2,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { Button } from '../../../components/ui/FormElements';
import type { ExportFormat } from '../types/report.types';

interface ExportToolbarProps {
  onExport: (format: ExportFormat) => Promise<void> | void;
  recordCount?: number;
  /** If true, renders a full-width "Generate Month-End Report" primary button in addition to the format buttons */
  showReportButton?: boolean;
  onReport?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ExportToolbar({
  onExport,
  recordCount,
  showReportButton = false,
  onReport,
  disabled = false,
  className = '',
}: ExportToolbarProps) {
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    if (loading) return;
    setLoading(format);
    try {
      await onExport(format);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {recordCount !== undefined && (
        <span className="text-xs text-gray-500 mr-2">
          {recordCount.toLocaleString()} record{recordCount !== 1 ? 's' : ''}{' '}
          shown
        </span>
      )}

      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg p-1">
        <span className="text-xs text-gray-500 px-1.5 font-medium">
          Export:
        </span>

        {/* CSV */}
        <button
          type="button"
          disabled={disabled || !!loading}
          onClick={() => handleExport('CSV')}
          title="Export filtered data as CSV"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-gray-700 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
        >
          {loading === 'CSV' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Table2 size={13} className="text-green-600" />
          )}
          CSV
        </button>

        {/* Excel */}
        <button
          type="button"
          disabled={disabled || !!loading}
          onClick={() => handleExport('Excel')}
          title="Export filtered data as Excel workbook"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-gray-700 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
        >
          {loading === 'Excel' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={13} className="text-blue-600" />
          )}
          Excel
        </button>

        {/* PDF */}
        <button
          type="button"
          disabled={disabled || !!loading}
          onClick={() => handleExport('PDF')}
          title="Export filtered data as PDF"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-gray-700 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
        >
          {loading === 'PDF' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <FileText size={13} className="text-red-600" />
          )}
          PDF
        </button>
      </div>

      {showReportButton && onReport && (
        <Button
          variant="primary"
          size="sm"
          icon={Download}
          onClick={onReport}
          disabled={disabled}
        >
          Month-End Report
        </Button>
      )}
    </div>
  );
}

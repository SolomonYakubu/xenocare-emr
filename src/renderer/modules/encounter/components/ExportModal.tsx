/**
 * =============================================================================
 * XENOCARE EMR - COMPREHENSIVE EXPORT MODAL (v2)
 * Description: 3-step wizard for encounter data export with preview, selection,
 *              column configuration, revenue summaries, and saved preferences.
 * Steps: Configure â†’ Preview & Select â†’ Export
 * =============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Check,
  Folder,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Eye,
  Settings2,
  Columns3,
  Save,
  RotateCcw,
  Banknote,
  BedDouble,
  Scissors,
  Users,
  FileBarChart,
  Lightbulb,
} from 'lucide-react';
import {
  getSyncMetaValue,
  removeSyncMetaValue,
  setSyncMetaValue,
} from '../../../lib/offline/storage/persistence';
import { Encounter } from '../dtos/encounter.dto';
import {
  ComprehensiveEncounterFilters,
  defaultComprehensiveFilters,
} from './ComprehensiveEncounterFilterPanel';
import {
  encountersToCSV,
  formatEncounterForExport,
  calculateEncounterStats,
} from '../utils/encounterExport';
import { saveAndOpenPDFReport } from '../utils/encounterPDFExport';
import {
  ExportPreviewTable,
  ExportColumn,
  ALL_EXPORT_COLUMNS,
} from './ExportPreviewTable';

// =============================================================================
// Constants
// =============================================================================

const EXPORT_HISTORY_KEY = 'ndc_export_history';
const COLUMN_PREFS_KEY = 'ndc_export_column_prefs';
const MODULE_PREFS_KEY = 'ndc_export_module_prefs';

type ExportFormat = 'csv' | 'excel' | 'pdf';
type WizardStep = 'configure' | 'preview' | 'export';

const STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
  { key: 'configure', label: 'Configure', icon: <Settings2 className="h-4 w-4" /> },
  { key: 'preview', label: 'Preview & Select', icon: <Eye className="h-4 w-4" /> },
  { key: 'export', label: 'Export', icon: <Download className="h-4 w-4" /> },
];

// =============================================================================
// Types
// =============================================================================

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounters: Encounter[];
  filters: ComprehensiveEncounterFilters;
  isNightMode?: boolean;
}

interface ExportedFile {
  id: string;
  filename: string;
  format: ExportFormat;
  size: string;
  timestamp: Date;
  status: 'completed' | 'error';
  path?: string;
}

interface ModuleExportSection {
  key: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  category: 'core' | 'clinical' | 'operational' | 'financial';
}

// Core modules (always available)
const CORE_MODULE_SECTIONS: ModuleExportSection[] = [
  {
    key: 'encounters',
    label: 'Encounter Records',
    description: 'All patient encounters with visit details',
    icon: 'ðŸ¥',
    enabled: true,
    category: 'core',
  },
  {
    key: 'demographics',
    label: 'Patient Demographics',
    description: 'Age, gender, category distribution',
    icon: 'ðŸ‘¥',
    enabled: true,
    category: 'core',
  },
  {
    key: 'status',
    label: 'Status Overview',
    description: 'Active, completed, cancelled breakdown',
    icon: 'ðŸ“Š',
    enabled: true,
    category: 'core',
  },
  {
    key: 'timeline',
    label: 'Timeline Analysis',
    description: 'Daily, weekly, monthly trends',
    icon: 'ðŸ“…',
    enabled: true,
    category: 'core',
  },
];

// Clinical modules
const CLINICAL_MODULE_SECTIONS: ModuleExportSection[] = [
  {
    key: 'diagnosis',
    label: 'Clinical Diagnosis',
    description: 'Diagnosis patterns and ICD-10 codes',
    icon: 'ðŸ”¬',
    enabled: true,
    category: 'clinical',
  },
  {
    key: 'nursing',
    label: 'Nursing Records',
    description: 'Nursing notes, vitals, treatment plans',
    icon: 'ðŸ‘©â€âš•ï¸',
    enabled: true,
    category: 'clinical',
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy Records',
    description: 'Prescriptions and dispensing history',
    icon: 'ðŸ’Š',
    enabled: true,
    category: 'clinical',
  },
  {
    key: 'radiology',
    label: 'Radiology Records',
    description: 'Imaging requests and reports',
    icon: 'ðŸ“·',
    enabled: true,
    category: 'clinical',
  },
  {
    key: 'procedures',
    label: 'Procedures',
    description: 'Medical procedures and interventions',
    icon: 'ðŸ”¬',
    enabled: true,
    category: 'clinical',
  },
  {
    key: 'priority',
    label: 'Priority Distribution',
    description: 'Emergency, urgent, normal cases',
    icon: 'âš¡',
    enabled: true,
    category: 'clinical',
  },
];

// Operational modules
const OPERATIONAL_MODULE_SECTIONS: ModuleExportSection[] = [
  {
    key: 'departments',
    label: 'Department Analysis',
    description: 'Breakdown by clinic/department',
    icon: 'ðŸ¢',
    enabled: true,
    category: 'operational',
  },
  {
    key: 'doctors',
    label: 'Doctor Performance',
    description: 'Encounters by attending doctor',
    icon: 'ðŸ‘¨â€âš•ï¸',
    enabled: true,
    category: 'operational',
  },
  {
    key: 'visitTypes',
    label: 'Visit Type Analysis',
    description: 'OPD, Emergency, Follow-up stats',
    icon: 'ðŸ“‹',
    enabled: true,
    category: 'operational',
  },
  {
    key: 'inpatient',
    label: 'Inpatient/Admissions',
    description: 'Hospital admissions and discharges',
    icon: 'ðŸ›ï¸',
    enabled: true,
    category: 'operational',
  },
  {
    key: 'wards',
    label: 'Ward Statistics',
    description: 'Bed occupancy and ward data',
    icon: 'ðŸ¥',
    enabled: true,
    category: 'operational',
  },
];

// Financial modules
const FINANCIAL_MODULE_SECTIONS: ModuleExportSection[] = [
  {
    key: 'billing',
    label: 'Billing & Payments',
    description: 'Payment categories and transactions',
    icon: 'ðŸ’³',
    enabled: true,
    category: 'financial',
  },
];

// Combine all sections
const DEFAULT_MODULE_SECTIONS: ModuleExportSection[] = [
  ...CORE_MODULE_SECTIONS,
  ...CLINICAL_MODULE_SECTIONS,
  ...OPERATIONAL_MODULE_SECTIONS,
  ...FINANCIAL_MODULE_SECTIONS,
];

// =============================================================================
// Guide Tip Component
// =============================================================================

const GuideTip: React.FC<{ tip: string; isNightMode: boolean }> = ({ tip, isNightMode }) => (
  <div className={`flex items-start gap-1.5 mt-1.5 ${isNightMode ? 'text-indigo-300/70' : 'text-indigo-500/80'}`}>
    <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
    <span className="text-[10px] leading-tight italic">{tip}</span>
  </div>
);

// =============================================================================
// Helpers
// =============================================================================

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const generateFilename = (format: string): string => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const time = new Date().toTimeString().slice(0, 5).replace(':', '');
  return `NDC_Encounters_${timestamp}_${time}.${format}`;
};

const escapeXML = (str: string | undefined | null): string => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
};

const encountersToExcel = (encounters: Encounter[], columns: ExportColumn[]): string => {
  const exportData = encounters.map(formatEncounterForExport);
  const visibleCols = columns.filter((c) => c.visible);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>XenoCare Encounter Report</Title>
    <Author>XenoCare</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#4338CA" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Normal">
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:Bold="1" ss:Size="14" ss:Color="#4338CA"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Encounters">
    <Table>
`;
  visibleCols.forEach(() => { xml += '      <Column ss:Width="120"/>\n'; });
  xml += '      <Row>\n';
  visibleCols.forEach((col) => {
    xml += `        <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXML(col.label)}</Data></Cell>\n`;
  });
  xml += '      </Row>\n';

  exportData.forEach((row) => {
    xml += '      <Row>\n';
    visibleCols.forEach((col) => {
      const val = row[col.key] || '';
      xml += `        <Cell ss:StyleID="Normal"><Data ss:Type="String">${escapeXML(val)}</Data></Cell>\n`;
    });
    xml += '      </Row>\n';
  });

  xml += `    </Table>
  </Worksheet>
</Workbook>`;
  return xml;
};

const downloadFile = (content: string, filename: string, mimeType: string): Promise<ExportedFile> => {
  return new Promise((resolve, reject) => {
    try {
      const BOM = mimeType.includes('csv') ? '\uFEFF' : '';
      const blob = new Blob([BOM + content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      const fmt = filename.endsWith('.csv') ? 'csv' : filename.endsWith('.xls') ? 'excel' : 'pdf';
      resolve({
        id: `export_${Date.now()}`,
        filename,
        format: fmt as ExportFormat,
        size: formatFileSize(blob.size),
        timestamp: new Date(),
        status: 'completed',
        path: `Downloads/${filename}`,
      });
    } catch (error) {
      reject(error);
    }
  });
};

// =============================================================================
// Revenue Summary
// =============================================================================

interface RevenueSummary {
  totalEncounters: number;
  inpatientCount: number;
  outpatientCount: number;
  emergencyCount: number;
  nhisCount: number;
  privateCount: number;
  byDepartment: Record<string, number>;
  byPaymentCategory: Record<string, number>;
}

const computeRevenueSummary = (encounters: Encounter[]): RevenueSummary => {
  const summary: RevenueSummary = {
    totalEncounters: encounters.length,
    inpatientCount: 0,
    outpatientCount: 0,
    emergencyCount: 0,
    nhisCount: 0,
    privateCount: 0,
    byDepartment: {},
    byPaymentCategory: {},
  };
  encounters.forEach((e) => {
    if (e.discharge_date) summary.inpatientCount++; else summary.outpatientCount++;
    if (e.visit_type === 'Emergency' || e.visit_type === 'A&E') summary.emergencyCount++;
    if (e.payment_category?.includes('NHIS') || e.payment_category === 'NHIS') summary.nhisCount++;
    if (e.payment_category === 'Cash' || e.payment_category === 'POS' || e.payment_category === 'Bank_Transfer') summary.privateCount++;
    const dept = e.clinic?.clinic_name || 'Unassigned';
    summary.byDepartment[dept] = (summary.byDepartment[dept] || 0) + 1;
    const pc = e.payment_category || 'Not Set';
    summary.byPaymentCategory[pc] = (summary.byPaymentCategory[pc] || 0) + 1;
  });
  return summary;
};

// =============================================================================
// Export Modal Component
// =============================================================================

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  encounters,
  filters,
  isNightMode = false,
}) => {
  const [step, setStep] = useState<WizardStep>('configure');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [moduleSections, setModuleSections] = useState<ModuleExportSection[]>(DEFAULT_MODULE_SECTIONS);
  const [columns, setColumns] = useState<ExportColumn[]>(ALL_EXPORT_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportedFiles, setExportedFiles] = useState<ExportedFile[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);


  // ---------------------------------------------------------------------------
  // Persistence: load saved prefs + history
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [history, colPrefs, modPrefs] = await Promise.all([
          getSyncMetaValue<ExportedFile[]>(EXPORT_HISTORY_KEY),
          getSyncMetaValue<Record<string, boolean>>(COLUMN_PREFS_KEY),
          getSyncMetaValue<Record<string, boolean>>(MODULE_PREFS_KEY),
        ]);
        if (!alive) return;
        if (Array.isArray(history)) {
          setExportedFiles(history.map((f: any) => ({ ...f, timestamp: new Date(f.timestamp) })));
        }
        if (colPrefs && typeof colPrefs === 'object') {
          setColumns((prev) => prev.map((c) => ({ ...c, visible: (colPrefs as Record<string, boolean>)[c.key] ?? c.visible })));
        }
        if (modPrefs && typeof modPrefs === 'object') {
          setModuleSections((prev) => prev.map((s) => ({ ...s, enabled: (modPrefs as Record<string, boolean>)[s.key] ?? s.enabled })));
        }
      } catch {
        // Ignore read errors
      }
    };
    void load();
    return () => { alive = false; };
  }, []);

  // Select all when entering preview
  useEffect(() => {
    if (step === 'preview' && selectedIds.size === 0) {
      setSelectedIds(new Set(encounters.map((e) => e.visit_id || e.id)));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('configure');
      setExportSuccess(false);
      setExportError(null);
    }
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Save preferences
  // ---------------------------------------------------------------------------

  const saveColumnPrefs = useCallback(() => {
    const prefs: Record<string, boolean> = {};
    columns.forEach((c) => { prefs[c.key] = c.visible; });
    void setSyncMetaValue(COLUMN_PREFS_KEY, prefs);
  }, [columns]);

  const saveModulePrefs = useCallback(() => {
    const prefs: Record<string, boolean> = {};
    moduleSections.forEach((s) => { prefs[s.key] = s.enabled; });
    void setSyncMetaValue(MODULE_PREFS_KEY, prefs);
  }, [moduleSections]);

  const resetColumnPrefs = () => {
    setColumns(ALL_EXPORT_COLUMNS);
    void removeSyncMetaValue(COLUMN_PREFS_KEY);
  };

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => calculateEncounterStats(encounters), [encounters]);
  const revenue = useMemo(() => computeRevenueSummary(encounters), [encounters]);

  const activeFilters = useMemo(() => {
    const active: string[] = [];
    if (filters.status !== 'all') active.push(`Status: ${filters.status}`);
    if (filters.visitType !== 'all') active.push(`Visit Type: ${filters.visitType}`);
    if (filters.priority !== 'all') active.push(`Priority: ${filters.priority}`);
    if (filters.doctorId !== 'all') active.push('Filtered by Doctor');
    if (filters.clinicId !== 'all') active.push('Filtered by Clinic');
    if (filters.departmentId !== 'all') active.push('Filtered by Department');
    if (filters.patientCategory !== 'all') active.push(`Category: ${filters.patientCategory}`);
    if (filters.insuranceType !== 'all') active.push(`Insurance: ${filters.insuranceType}`);
    if (filters.gender !== 'all') active.push(`Gender: ${filters.gender}`);
    if (filters.diagnosis !== 'all') active.push('Filtered by Diagnosis');
    if (filters.dateFrom || filters.dateTo) active.push(`Date: ${filters.dateFrom || 'Any'} to ${filters.dateTo || 'Present'}`);
    return active;
  }, [filters]);

  const isDefaultFilter = activeFilters.length === 0;

  const selectedEncounters = useMemo(
    () => encounters.filter((e) => selectedIds.has(e.visit_id || e.id)),
    [encounters, selectedIds],
  );

  // ---------------------------------------------------------------------------
  // Module & column toggles
  // ---------------------------------------------------------------------------

  const toggleModule = (key: string) => {
    setModuleSections((prev) => prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s)));
  };

  const toggleAllModules = (enabled: boolean) => {
    setModuleSections((prev) => prev.map((s) => ({ ...s, enabled })));
  };

  const toggleColumn = (key: string) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  };

  // ---------------------------------------------------------------------------
  // Export handler
  // ---------------------------------------------------------------------------

  const handleExport = async () => {
    const toExport = selectedEncounters.length > 0 ? selectedEncounters : encounters;
    if (toExport.length === 0) {
      setExportError('No records selected. Go back and select at least one record.');
      return;
    }
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      let exportedFile: ExportedFile | null = null;

      switch (selectedFormat) {
        case 'csv': {
          const visibleCols = columns.filter((c) => c.visible);
          const data = toExport.map(formatEncounterForExport);
          const headers = visibleCols.map((c) => c.label);
          const rows = data.map((row) => visibleCols.map((c) => {
            const val = row[c.key] || '';
            return val.includes(',') || val.includes('"') || val.includes('\n')
              ? `"${val.replace(/"/g, '""')}"` : val;
          }));
          const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
          exportedFile = await downloadFile(csv, generateFilename('csv'), 'text/csv;charset=utf-8;');
          break;
        }
        case 'excel': {
          const content = encountersToExcel(toExport, columns);
          exportedFile = await downloadFile(content, generateFilename('xls'), 'application/vnd.ms-excel;charset=utf-8;');
          break;
        }
        case 'pdf': {
          let reportTitle = 'Comprehensive Encounter Report';
          let reportSubtitle = 'All Records - All Modules';
          if (!isDefaultFilter) {
            if (filters.doctorId !== 'all') { reportTitle = 'Doctor Performance Report'; reportSubtitle = 'Filtered by Attending Doctor'; }
            else if (filters.departmentId !== 'all' || filters.clinicId !== 'all') { reportTitle = 'Department/Clinic Report'; reportSubtitle = 'Filtered by Department'; }
            else if (filters.patientCategory !== 'all') { reportTitle = `Patient Category Report - ${filters.patientCategory}`; reportSubtitle = 'Filtered by Category'; }
            else if (filters.insuranceType !== 'all') { reportTitle = `Insurance Report - ${filters.insuranceType}`; reportSubtitle = 'Filtered by Insurance'; }
            else if (filters.status !== 'all') { reportTitle = `Status Report - ${filters.status}`; reportSubtitle = 'Filtered by Status'; }
            else if (filters.dateFrom || filters.dateTo) { reportTitle = 'Date Range Report'; reportSubtitle = `${filters.dateFrom || 'Start'} to ${filters.dateTo || 'Present'}`; }
          }
          const enabledModules = moduleSections.filter((s) => s.enabled).map((s) => s.key);
          const result = await saveAndOpenPDFReport(toExport, filters, {
            title: reportTitle,
            subtitle: reportSubtitle,
            includePatientDetails: true,
            includeClinicalInfo: true,
            includeStatistics: true,
            includeVitals: true,
            enabledModules,
            isDefaultFilter,
          } as any);

          if (result.success) {
            exportedFile = {
              id: `export_${Date.now()}`,
              filename: result.filename,
              format: 'pdf',
              size: 'HTML Report',
              timestamp: new Date(),
              status: 'completed',
              path: result.filePath,
            };
          } else {
            throw new Error(result.error || 'Failed to save PDF');
          }
          break;
        }
      }

      if (exportedFile) {
        const newFiles = [exportedFile, ...exportedFiles];
        setExportedFiles(newFiles);
        void setSyncMetaValue(EXPORT_HISTORY_KEY, newFiles.slice(0, 20));
        setExportSuccess(true);
      }
    } catch (err: any) {
      setExportError(err?.message || 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearHistory = () => {
    setExportedFiles([]);
    void removeSyncMetaValue(EXPORT_HISTORY_KEY);
  };

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const nm = isNightMode;
  const cardBg = nm ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-indigo-100';
  const textPrimary = nm ? 'text-gray-100' : 'text-gray-800';
  const textSecondary = nm ? 'text-gray-400' : 'text-gray-500';
  const sectionBg = nm ? 'bg-slate-700/50' : 'bg-indigo-50/50';

  if (!isOpen) return null;

  const canNext = step === 'configure' ? encounters.length > 0 : step === 'preview' ? selectedIds.size > 0 : false;
  const goNext = () => setStep(step === 'configure' ? 'preview' : 'export');
  const goBack = () => setStep(step === 'export' ? 'preview' : 'configure');

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative w-full max-w-6xl mx-4 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col ${nm ? 'bg-slate-800' : 'bg-white'}`}>

        {/* HEADER */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <FileBarChart className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Export Centre</h2>
                <p className="text-sm text-white/70">
                  {encounters.length} record{encounters.length !== 1 ? 's' : ''} available
                  {selectedIds.size > 0 && selectedIds.size < encounters.length ? ` · ${selectedIds.size} selected` : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-4">
            {STEPS.map((s, i) => {
              const isCurrent = s.key === step;
              const isPast = (step === 'preview' && i === 0) || (step === 'export' && i <= 1);
              return (
                <React.Fragment key={s.key}>
                  <button
                    onClick={() => { if (isPast) setStep(s.key); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isCurrent ? 'bg-white/25 text-white shadow-sm'
                      : isPast ? 'bg-white/10 text-white/80 hover:bg-white/15 cursor-pointer'
                      : 'text-white/40 cursor-default'
                    }`}
                  >
                    {isPast && !isCurrent ? <CheckCircle className="h-3.5 w-3.5 text-emerald-300" /> : s.icon}
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className={`h-3.5 w-3.5 ${isPast ? 'text-white/60' : 'text-white/20'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP 1: CONFIGURE */}
          {step === 'configure' && (
            <div className="space-y-6">

              {/* Revenue & Summary Cards */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Banknote className={`h-4 w-4 ${nm ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  <h3 className={`text-sm font-semibold ${textPrimary}`}>Dataset Overview</h3>
                </div>
                <div className="grid grid-cols-6 gap-3">
                  {[
                    { label: 'Total Records', value: revenue.totalEncounters, cls: 'text-indigo-600' },
                    { label: 'Inpatient (Admitted)', value: revenue.inpatientCount, cls: 'text-purple-600' },
                    { label: 'Outpatient', value: revenue.outpatientCount, cls: 'text-sky-600' },
                    { label: 'Emergency/A&E', value: revenue.emergencyCount, cls: 'text-red-600' },
                    { label: 'NHIS Claims', value: revenue.nhisCount, cls: 'text-emerald-600' },
                    { label: 'Private/Cash', value: revenue.privateCount, cls: 'text-amber-600' },
                  ].map((card) => (
                    <div key={card.label} className={`rounded-xl border p-3 text-center ${cardBg}`}>
                      <p className={`text-xl font-bold ${card.cls}`}>{card.value}</p>
                      <p className={`text-[10px] mt-0.5 ${textSecondary}`}>{card.label}</p>
                    </div>
                  ))}
                </div>

                {/* Department breakdown */}
                {Object.keys(revenue.byDepartment).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.entries(revenue.byDepartment).sort(([, a], [, b]) => b - a).slice(0, 10).map(([dept, count]) => (
                      <span key={dept} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${nm ? 'bg-slate-700 text-gray-300' : 'bg-indigo-50 text-indigo-700'}`}>
                        {dept}: {count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Payment category pills */}
                {Object.keys(revenue.byPaymentCategory).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(revenue.byPaymentCategory).sort(([, a], [, b]) => b - a).map(([cat, count]) => (
                      <span key={cat} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${nm ? 'bg-slate-700 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                        {cat}: {count}
                      </span>
                    ))}
                  </div>
                )}

                <GuideTip tip="This overview reflects the data that will be exported. Use the Advanced Filters on the main page to narrow down before exporting." isNightMode={nm} />
              </div>

              {/* Format Selection */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className={`h-4 w-4 ${nm ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  <h3 className={`text-sm font-semibold ${textPrimary}`}>Export Format</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: 'csv' as const, label: 'CSV', desc: 'Comma-separated values for spreadsheets', Icon: FileText, border: 'border-emerald-500', bg: 'bg-emerald-50/50', text: 'text-emerald-600' },
                    { key: 'excel' as const, label: 'Excel', desc: 'Formatted spreadsheet with styled headers', Icon: FileSpreadsheet, border: 'border-blue-500', bg: 'bg-blue-50/50', text: 'text-blue-600' },
                    { key: 'pdf' as const, label: 'PDF', desc: 'Printable report with charts & summaries', Icon: File, border: 'border-red-500', bg: 'bg-red-50/50', text: 'text-red-600' },
                  ]).map(({ key, label, desc, Icon, border, bg, text }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedFormat(key)}
                      className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                        selectedFormat === key
                          ? `${border} ${nm ? 'bg-slate-700' : bg}`
                          : nm ? 'border-slate-600 hover:border-slate-500' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {selectedFormat === key && (
                        <div className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full p-1">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <Icon className={`h-7 w-7 mb-2 ${selectedFormat === key ? text : nm ? 'text-gray-400' : 'text-gray-500'}`} />
                      <p className={`text-sm font-semibold ${selectedFormat === key ? text : textPrimary}`}>{label}</p>
                      <p className={`text-[11px] mt-0.5 ${textSecondary}`}>{desc}</p>
                    </button>
                  ))}
                </div>
                <GuideTip tip="CSV is best for importing into other systems. Excel provides formatted columns. PDF generates a comprehensive printable report." isNightMode={nm} />
              </div>

              {/* Active Filters Notice */}
              <div className={`p-3 rounded-xl border ${isDefaultFilter ? (nm ? 'border-emerald-800 bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50/50') : (nm ? 'border-amber-800 bg-amber-900/20' : 'border-amber-200 bg-amber-50/50')}`}>
                <div className="flex items-start gap-2">
                  {isDefaultFilter ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`text-xs font-semibold ${isDefaultFilter ? (nm ? 'text-emerald-400' : 'text-emerald-800') : (nm ? 'text-amber-400' : 'text-amber-800')}`}>
                      {isDefaultFilter ? 'All Records (No filters applied)' : `${activeFilters.length} filter(s) active`}
                    </p>
                    {!isDefaultFilter && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {activeFilters.map((f, i) => (
                          <span key={i} className="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Column Configuration */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Columns3 className={`h-4 w-4 ${nm ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    <h3 className={`text-sm font-semibold ${textPrimary}`}>
                      Columns to Export ({columns.filter((c) => c.visible).length}/{columns.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowColumnPicker(!showColumnPicker)} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${showColumnPicker ? 'bg-indigo-100 text-indigo-700' : nm ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {showColumnPicker ? 'Hide' : 'Customize'}
                    </button>
                    <button onClick={saveColumnPrefs} className="text-xs px-2.5 py-1 rounded-md font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1" title="Save as default">
                      <Save className="h-3 w-3" /> Save
                    </button>
                    <button onClick={resetColumnPrefs} className={`text-xs px-2 py-1 rounded-md transition-colors ${nm ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`} title="Reset to default">
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {showColumnPicker && (
                  <div className={`rounded-xl border p-3 ${cardBg}`}>
                    <div className="grid grid-cols-4 gap-2">
                      {columns.map((col) => (
                        <label key={col.key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${col.visible ? (nm ? 'bg-indigo-900/30 border border-indigo-500/40' : 'bg-indigo-50 border border-indigo-200') : (nm ? 'hover:bg-slate-700 border border-transparent' : 'hover:bg-gray-50 border border-transparent')}`}>
                          <input type="checkbox" checked={col.visible} onChange={() => toggleColumn(col.key)} className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                          <span className={col.visible ? (nm ? 'text-indigo-300' : 'text-indigo-700') : textSecondary}>{col.label}</span>
                        </label>
                      ))}
                    </div>
                    <GuideTip tip="Choose which columns appear in your exported file. Click 'Save' to remember this selection for future exports." isNightMode={nm} />
                  </div>
                )}
              </div>

              {/* PDF Module Sections */}
              {selectedFormat === 'pdf' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileBarChart className={`h-4 w-4 ${nm ? 'text-indigo-400' : 'text-indigo-600'}`} />
                      <h3 className={`text-sm font-semibold ${textPrimary}`}>PDF Report Sections</h3>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => toggleAllModules(true)} className="text-xs text-indigo-600 hover:underline font-medium">Select All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => toggleAllModules(false)} className="text-xs text-red-500 hover:underline font-medium">Deselect All</button>
                      <button onClick={saveModulePrefs} className="text-xs px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 ml-2 flex items-center gap-1">
                        <Save className="h-2.5 w-2.5" /> Save
                      </button>
                    </div>
                  </div>
                  <div className={`rounded-xl border overflow-hidden ${nm ? 'border-slate-600' : 'border-indigo-100'}`}>
                    {[
                      { title: 'Core', items: moduleSections.filter((s) => s.category === 'core'), bg: sectionBg, cols: 'grid-cols-4' },
                      { title: 'Clinical', items: moduleSections.filter((s) => s.category === 'clinical'), bg: nm ? 'bg-slate-700/30' : 'bg-blue-50/30', cols: 'grid-cols-3' },
                      { title: 'Operational', items: moduleSections.filter((s) => s.category === 'operational'), bg: nm ? 'bg-slate-700/30' : 'bg-purple-50/30', cols: 'grid-cols-5' },
                      { title: 'Financial', items: moduleSections.filter((s) => s.category === 'financial'), bg: nm ? 'bg-slate-700/30' : 'bg-emerald-50/30', cols: 'grid-cols-4' },
                    ].map((group) => (
                      <div key={group.title} className={`p-3 border-b last:border-b-0 ${nm ? 'border-slate-600' : 'border-indigo-50'} ${group.bg}`}>
                        <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${textSecondary}`}>{group.title}</h4>
                        <div className={`grid ${group.cols} gap-2`}>
                          {group.items.map((s) => (
                            <label key={s.key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${s.enabled ? (nm ? 'bg-indigo-900/30 border border-indigo-500/40' : 'bg-indigo-50 border border-indigo-200') : (nm ? 'hover:bg-slate-600 border border-transparent' : 'hover:bg-gray-100 border border-transparent')}`}>
                              <input type="checkbox" checked={s.enabled} onChange={() => toggleModule(s.key)} className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                              <span className="text-sm">{s.icon}</span>
                              <span className={`font-medium ${s.enabled ? (nm ? 'text-indigo-300' : 'text-indigo-700') : textSecondary}`}>{s.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-[10px] ${textSecondary}`}>{moduleSections.filter((s) => s.enabled).length}/{moduleSections.length} sections selected</span>
                    <GuideTip tip="Select which sections appear in the PDF. The more you select, the longer the report." isNightMode={nm} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PREVIEW & SELECT */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-sm font-semibold ${textPrimary}`}>Data Preview</h3>
                  <p className={`text-xs ${textSecondary}`}>Review and select the records you want to export. Click any row to toggle selection.</p>
                </div>
                <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg ${nm ? 'bg-slate-700' : 'bg-indigo-50'}`}>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${nm ? 'text-indigo-300' : 'text-indigo-700'}`}>{selectedIds.size}</p>
                    <p className={`text-[9px] ${textSecondary}`}>Selected</p>
                  </div>
                  <div className={`w-px h-6 ${nm ? 'bg-slate-600' : 'bg-indigo-200'}`} />
                  <div className="text-center">
                    <p className={`text-sm font-bold ${textSecondary}`}>{encounters.length}</p>
                    <p className={`text-[9px] ${textSecondary}`}>Total</p>
                  </div>
                  <div className={`w-px h-6 ${nm ? 'bg-slate-600' : 'bg-indigo-200'}`} />
                  <div className="text-center">
                    <p className={`text-sm font-bold ${nm ? 'text-indigo-300' : 'text-indigo-700'}`}>{columns.filter((c) => c.visible).length}</p>
                    <p className={`text-[9px] ${textSecondary}`}>Columns</p>
                  </div>
                </div>
              </div>
              <GuideTip tip="Click individual rows to select/deselect them. Use 'Select All' to include everything. Only selected rows will be exported." isNightMode={nm} />
              <ExportPreviewTable
                encounters={encounters}
                columns={columns}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                isNightMode={nm}
              />
            </div>
          )}

          {/* STEP 3: EXPORT */}
          {step === 'export' && (
            <div className="space-y-6">
              <div className={`rounded-xl border p-5 ${cardBg}`}>
                <h3 className={`text-sm font-semibold mb-4 ${textPrimary}`}>Export Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className={`rounded-lg p-3 ${sectionBg}`}>
                    <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSecondary}`}>Format</p>
                    <p className={`text-lg font-bold mt-1 ${nm ? 'text-indigo-300' : 'text-indigo-700'}`}>{selectedFormat.toUpperCase()}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${sectionBg}`}>
                    <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSecondary}`}>Records</p>
                    <p className={`text-lg font-bold mt-1 ${nm ? 'text-indigo-300' : 'text-indigo-700'}`}>{selectedEncounters.length}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${sectionBg}`}>
                    <p className={`text-[10px] uppercase tracking-wider font-semibold ${textSecondary}`}>Columns</p>
                    <p className={`text-lg font-bold mt-1 ${nm ? 'text-indigo-300' : 'text-indigo-700'}`}>{columns.filter((c) => c.visible).length}</p>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-4 gap-3 mt-4">
                  {[
                    { icon: <BedDouble className="h-3.5 w-3.5" />, label: 'Inpatient', value: selectedEncounters.filter((e) => e.discharge_date).length },
                    { icon: <Users className="h-3.5 w-3.5" />, label: 'Outpatient', value: selectedEncounters.filter((e) => !e.discharge_date).length },
                    { icon: <Scissors className="h-3.5 w-3.5" />, label: 'Emergency', value: selectedEncounters.filter((e) => e.visit_type === 'Emergency' || e.visit_type === 'A&E').length },
                    { icon: <Banknote className="h-3.5 w-3.5" />, label: 'NHIS', value: selectedEncounters.filter((e) => e.payment_category?.includes('NHIS')).length },
                  ].map((item) => (
                    <div key={item.label} className={`flex items-center gap-2 p-2 rounded-lg ${nm ? 'bg-slate-700' : 'bg-gray-50'}`}>
                      <span className={nm ? 'text-indigo-400' : 'text-indigo-600'}>{item.icon}</span>
                      <div>
                        <p className={`text-xs font-bold ${textPrimary}`}>{item.value}</p>
                        <p className={`text-[9px] ${textSecondary}`}>{item.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedFormat === 'pdf' && (
                  <p className={`text-[10px] mt-3 ${textSecondary}`}>
                    PDF will include {moduleSections.filter((s) => s.enabled).length} report section(s)
                  </p>
                )}
              </div>

              {/* Error / Success */}
              {exportError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs">{exportError}</p>
                </div>
              )}
              {exportSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs font-medium">Export completed successfully! File saved to your Downloads folder.</p>
                </div>
              )}

              {/* Export History */}
              {exportedFiles.length > 0 && (
                <div>
                  <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 text-xs font-medium mb-2 ${textSecondary}`}>
                    <Clock className="h-3.5 w-3.5" />
                    Recent Exports ({exportedFiles.length})
                    <span className="text-[10px]">{showHistory ? '(hide)' : '(show)'}</span>
                  </button>
                  {showHistory && (
                    <div className={`rounded-xl border overflow-hidden ${nm ? 'border-slate-600' : 'border-indigo-100'}`}>
                      {exportedFiles.slice(0, 5).map((file) => (
                        <div key={file.id} className={`flex items-center justify-between px-3 py-2 border-b last:border-b-0 ${nm ? 'border-slate-700 bg-slate-800' : 'border-indigo-50 bg-white'}`}>
                          <div className="flex items-center gap-2">
                            {file.format === 'csv' && <FileText className="h-3.5 w-3.5 text-emerald-600" />}
                            {file.format === 'excel' && <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />}
                            {file.format === 'pdf' && <File className="h-3.5 w-3.5 text-red-600" />}
                            <div>
                              <p className={`text-xs font-medium ${textPrimary}`}>{file.filename}</p>
                              <p className={`text-[10px] ${textSecondary}`}>{file.timestamp.toLocaleString()} · {file.size}</p>
                            </div>
                          </div>
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                      ))}
                      <button onClick={handleClearHistory} className={`w-full px-3 py-1.5 text-[10px] text-center ${nm ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                        Clear History
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Download info */}
              <div className={`p-3 rounded-xl ${nm ? 'bg-slate-700' : 'bg-indigo-50/60'}`}>
                <div className="flex items-start gap-2">
                  <Folder className={`h-4 w-4 mt-0.5 ${nm ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  <div>
                    <p className={`text-xs font-semibold ${nm ? 'text-gray-200' : 'text-indigo-800'}`}>Files will be saved to your Downloads folder</p>
                    <p className={`text-[10px] mt-0.5 ${textSecondary}`}>PDF reports open in your default browser. CSV and Excel files download directly.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className={`px-6 py-3 border-t flex items-center justify-between ${nm ? 'border-slate-700 bg-slate-800/80' : 'border-indigo-100 bg-indigo-50/30'}`}>
          <div className="flex items-center gap-2">
            {step !== 'configure' && (
              <button onClick={goBack} className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors ${nm ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <button onClick={onClose} className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${nm ? 'text-gray-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}>
              Cancel
            </button>
          </div>

          {step === 'export' ? (
            <button
              onClick={handleExport}
              disabled={isExporting || selectedEncounters.length === 0}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all ${
                isExporting || selectedEncounters.length === 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {isExporting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Exporting...</>
              ) : (
                <><Download className="h-4 w-4" /> Export {selectedEncounters.length} Records as {selectedFormat.toUpperCase()}</>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canNext}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all ${
                !canNext
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {step === 'configure' ? 'Preview Data' : 'Continue to Export'}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportModal;

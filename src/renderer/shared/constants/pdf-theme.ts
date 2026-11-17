/**
 * =============================================================================
 * XenoCare — Unified PDF Theme Constants
 *
 * Design system principles applied (GOV.UK, IBM Carbon, Ant Design):
 * - Single brand color across all exports for facility identity
 * - Consistent typography scale (8pt body minimum for readability)
 * - Standardized spacing and cell padding
 * - Uniform alternate row tinting
 * - Page footer with consistent layout
 * =============================================================================
 */

import { getFacilityAddress, getFacilityName } from '../../lib/facility';
import { APP_NAME } from './branding';

// ── Brand Colors (RGB tuples for jsPDF) ──────────────────────────────────────
export const PDF_COLORS = {
  // Clinical green retained from the established report palette
  primary: [22, 101, 52] as [number, number, number],
  primaryLight: [240, 253, 244] as [number, number, number], // green-50 tint

  // Secondary — Slate (used for secondary tables, sub-headers)
  secondary: [51, 65, 85] as [number, number, number],       // slate-700
  secondaryLight: [248, 250, 252] as [number, number, number],

  // Semantic accents
  accent: [37, 99, 235] as [number, number, number],         // blue-600
  success: [22, 163, 74] as [number, number, number],        // green-600
  warning: [217, 119, 6] as [number, number, number],        // amber-600
  danger: [220, 38, 38] as [number, number, number],         // red-600
  purple: [126, 34, 206] as [number, number, number],        // purple-700

  // Text
  text: [17, 24, 39] as [number, number, number],            // gray-900
  muted: [100, 116, 139] as [number, number, number],        // slate-500
  white: [255, 255, 255] as [number, number, number],

  // Table
  tableAlt: [248, 250, 252] as [number, number, number],     // slate-50
  tableBorder: [226, 232, 240] as [number, number, number],  // slate-200
} as const;

// ── Typography ───────────────────────────────────────────────────────────────
export const PDF_FONTS = {
  /** Report title (facility name) */
  title: { size: 14, style: 'bold' as const },
  /** Report subtitle */
  subtitle: { size: 10, style: 'normal' as const },
  /** Section headers inside body */
  sectionHeader: { size: 10, style: 'bold' as const },
  /** Filter summary, metadata */
  meta: { size: 8, style: 'normal' as const },
  /** Table body text — minimum readable size */
  tableBody: { size: 8, style: 'normal' as const },
  /** Table header text */
  tableHead: { size: 8, style: 'bold' as const },
  /** Page footer */
  footer: { size: 7, style: 'normal' as const },
  /** Small print, footnotes */
  small: { size: 7, style: 'normal' as const },
} as const;

// ── Spacing ──────────────────────────────────────────────────────────────────
export const PDF_SPACING = {
  /** Page margins */
  margin: { left: 14, right: 14, top: 14, bottom: 14 },
  /** Standard cell padding for autoTable */
  cellPadding: 2.5,
  /** Compact cell padding (for 10+ column tables) */
  cellPaddingCompact: 1.8,
  /** Gap between header text and table start */
  headerToTable: 6,
  /** Gap between sections */
  sectionGap: 8,
} as const;

// ── Facility Info (fallbacks; live values come from Facility Settings) ───────
export const FACILITY = {
  name: APP_NAME,
  shortName: APP_NAME,
  address: '',
} as const;

// ── Shared Helpers ───────────────────────────────────────────────────────────

/** Standard autoTable head styles — use for ALL primary tables */
export function primaryHeadStyles() {
  return {
    fillColor: PDF_COLORS.primary,
    textColor: PDF_COLORS.white,
    fontStyle: 'bold' as const,
    fontSize: PDF_FONTS.tableHead.size,
    cellPadding: PDF_SPACING.cellPadding,
  };
}

/** Secondary table head styles (for sub-tables, breakdowns) */
export function secondaryHeadStyles() {
  return {
    fillColor: PDF_COLORS.secondary,
    textColor: PDF_COLORS.white,
    fontStyle: 'bold' as const,
    fontSize: PDF_FONTS.tableHead.size,
    cellPadding: PDF_SPACING.cellPadding,
  };
}

/** Standard body styles for autoTable */
export function tableBodyStyles(compact = false) {
  return {
    fontSize: PDF_FONTS.tableBody.size,
    cellPadding: compact ? PDF_SPACING.cellPaddingCompact : PDF_SPACING.cellPadding,
    overflow: 'linebreak' as const,
    valign: 'middle' as const,
  };
}

/** Alternate row styling */
export function alternateRowStyles() {
  return {
    fillColor: PDF_COLORS.tableAlt,
  };
}

/** Format date for PDF display */
export function formatPdfDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format date + time for PDF display */
export function formatPdfDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Format currency for PDF */
export function formatPdfCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Build standard filename with module prefix */
export function buildPdfFilename(prefix: string, suffix?: string): string {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 5).replace(':', '');
  const extra = suffix ? `_${suffix.replace(/\s+/g, '_')}` : '';
  return `${prefix}${extra}_${stamp}_${time}.pdf`;
}

/** Download blob in Electron or browser */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Save + open via Electron or fallback to browser download */
export async function savePdf(
  blob: Blob,
  filename: string,
): Promise<void> {
  if (window.electron?.pdf?.saveAndOpen) {
    const pdfData = Array.from(new Uint8Array(await blob.arrayBuffer()));
    await window.electron.pdf.saveAndOpen(filename, pdfData);
  } else {
    downloadPdfBlob(blob, filename);
  }
}

/**
 * Render a standard XenoCare report header on the current page.
 * Returns the Y position after the header for content placement.
 */
export function renderReportHeader(
  doc: import('jspdf').jsPDF,
  opts: {
    title: string;
    filterSummary?: string;
    generatedBy?: string;
    recordCount?: number;
  },
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = PDF_SPACING.margin.top;

  // Facility name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_FONTS.title.size);
  doc.setTextColor(...PDF_COLORS.text);
  doc.text(getFacilityName(), pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Report title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_FONTS.subtitle.size);
  doc.text(opts.title, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Thin divider line
  doc.setDrawColor(...PDF_COLORS.tableBorder);
  doc.setLineWidth(0.3);
  doc.line(PDF_SPACING.margin.left, y, pageWidth - PDF_SPACING.margin.right, y);
  y += 4;

  // Filter summary (wraps if long)
  doc.setFontSize(PDF_FONTS.meta.size);
  doc.setTextColor(...PDF_COLORS.muted);
  if (opts.filterSummary) {
    const lines: string[] = doc.splitTextToSize(opts.filterSummary, pageWidth - 28);
    lines.forEach((line: string) => {
      doc.text(line, PDF_SPACING.margin.left, y);
      y += 3.5;
    });
  }

  // Generated metadata
  doc.text(`Generated: ${formatPdfDateTime(new Date().toISOString())}`, PDF_SPACING.margin.left, y);
  if (opts.generatedBy) {
    doc.text(`By: ${opts.generatedBy}`, pageWidth / 2, y);
  }
  if (opts.recordCount !== undefined) {
    doc.text(`Records: ${opts.recordCount}`, pageWidth - PDF_SPACING.margin.right, y, { align: 'right' });
  }
  y += PDF_SPACING.headerToTable;

  doc.setTextColor(...PDF_COLORS.text);
  return y;
}

/**
 * Standard page footer renderer for autoTable's didDrawPage callback.
 */
export function renderPageFooter(doc: import('jspdf').jsPDF, pageNumber: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(PDF_FONTS.footer.size);
  doc.setTextColor(...PDF_COLORS.muted);
  const facility = getFacilityName();
  const address = getFacilityAddress();
  const identity = address ? `${facility}  •  ${address}` : facility;
  doc.text(
    `${identity} | Page ${pageNumber} | Powered by XenoCare`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' },
  );
  doc.setTextColor(...PDF_COLORS.text);
}

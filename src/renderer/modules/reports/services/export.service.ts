/**
 * XenoCare
 * Reusable Export Service — CSV, Excel (xlsx), PDF (jsPDF)
 *
 * All module exports funnel through this service for consistency.
 * Implements "what you see is what you export" — callers pass the
 * already-filtered dataset; the service only handles serialization.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ExcelSheet, ExportFormat } from '../types/report.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(d: string | undefined | null): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB');
  } catch {
    return d;
  }
}

export function formatDateTime(d: string | undefined | null): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('en-GB');
  } catch {
    return d;
  }
}

function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-]/gi, '_');
}

/** Trigger browser/Electron file download for a Blob */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function exportToCSV(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string,
): void {
  const lines: string[] = [];
  lines.push(headers.map(escapeCSV).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCSV).join(','));
  }
  const blob = new Blob([lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlob(blob, `${safeFilename(filename)}.csv`);
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export function exportToExcel(sheets: ExcelSheet[], filename: string): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const wsData = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Bold header row
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let { c } = range.s; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[addr]) {
        ws[addr].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'D9E1F2' } },
        };
      }
    }

    // Auto column widths
    const colWidths = sheet.headers.map((h, ci) => {
      const maxLen = Math.max(
        h.length,
        ...sheet.rows.map((r) => String(r[ci] ?? '').length),
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${safeFilename(filename)}.xlsx`);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

const PDF_COLORS = {
  primary: [22, 101, 52] as [number, number, number],
  accent: [37, 99, 235] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  warning: [217, 119, 6] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  tableHead: [22, 101, 52] as [number, number, number],
  tableAlt: [248, 250, 252] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
};

interface PDFSection {
  /** Section title */
  title: string;
  /** Summary key-value pairs rendered as a 2-column info block */
  summaryRows?: { label: string; value: string | number }[];
  /** Table data */
  tableHeaders?: string[];
  tableRows?: (string | number | null | undefined)[][];
}

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  facility?: string;
  period?: string;
  generatedBy?: string;
  sections: PDFSection[];
  orientation?: 'portrait' | 'landscape';
}

export function exportToPDF(opts: PDFReportOptions, filename: string): void {
  const doc = new jsPDF({
    orientation: opts.orientation || 'landscape',
    unit: 'mm',
    format: 'a4',
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const ML = 15;
  const MR = 15;
  let y = 0;

  // ── Header banner ──
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('XENOCARE', ML, 9);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(opts.facility || 'XenoCare', ML, 15);

  // Confidentiality notice right-aligned
  doc.setFontSize(7);
  doc.text('CONFIDENTIAL — FOR AUTHORISED USE ONLY', pageW - MR, 9, {
    align: 'right',
  });
  doc.text(formatDateTime(new Date().toISOString()), pageW - MR, 14, {
    align: 'right',
  });

  y = 28;

  // ── Report title ──
  doc.setTextColor(...PDF_COLORS.primary);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.title, ML, y);
  y += 6;

  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(opts.subtitle, ML, y);
    y += 5;
  }
  if (opts.period) {
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(`Period: ${opts.period}`, ML, y);
    y += 4;
  }
  if (opts.generatedBy) {
    doc.setFontSize(8);
    doc.text(
      `Generated by: ${opts.generatedBy}  |  ${formatDateTime(new Date().toISOString())}`,
      ML,
      y,
    );
    y += 6;
  }

  // Divider
  doc.setDrawColor(...PDF_COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(ML, y, pageW - MR, y);
  y += 5;

  // ── Sections ──
  for (const section of opts.sections) {
    if (y > pageH - 30) {
      doc.addPage();
      y = 20;
    }

    // Section title
    doc.setFillColor(...PDF_COLORS.tableHead);
    doc.rect(ML, y - 4, pageW - ML - MR, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, ML + 2, y + 1);
    y += 8;

    // Summary key-value rows
    if (section.summaryRows?.length) {
      doc.setTextColor(...PDF_COLORS.primary);
      doc.setFontSize(9);
      const colW = (pageW - ML - MR) / 2;
      let kvi = 0;
      for (let i = 0; i < section.summaryRows.length; i += 2) {
        if (y > pageH - 20) {
          doc.addPage();
          y = 20;
        }
        const left = section.summaryRows[i];
        const right = section.summaryRows[i + 1];
        doc.setFont('helvetica', 'bold');
        doc.text(`${left.label}:`, ML, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(left.value), ML + colW * 0.45, y);
        if (right) {
          doc.setFont('helvetica', 'bold');
          doc.text(`${right.label}:`, ML + colW, y);
          doc.setFont('helvetica', 'normal');
          doc.text(String(right.value), ML + colW * 1.45, y);
        }
        y += 5;
        kvi++;
      }
      y += 3;
    }

    // Table
    if (section.tableHeaders && section.tableRows) {
      autoTable(doc, {
        startY: y,
        head: [section.tableHeaders],
        body: section.tableRows.map((r) =>
          r.map((c) => (c === null || c === undefined ? '' : String(c))),
        ),
        margin: { left: ML, right: MR },
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: {
          fillColor: PDF_COLORS.tableHead,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: PDF_COLORS.tableAlt },
        didDrawPage: (pageData) => {
          const tableY =
            (pageData as any)?.table?.finalY ??
            (doc as any).lastAutoTable?.finalY;
          if (tableY != null) y = tableY + 5;
        },
      });
      y =
        (doc as any).lastAutoTable?.finalY != null
          ? (doc as any).lastAutoTable.finalY + 8
          : y;
    }

    y += 5;
  }

  // ── Footer on every page ──
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...PDF_COLORS.primary);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(
      'XenoCare — Confidential Medical Record',
      ML,
      pageH - 4,
    );
    doc.text(`Page ${p} of ${totalPages}`, pageW - MR, pageH - 4, {
      align: 'right',
    });
  }

  doc.save(`${safeFilename(filename)}.pdf`);
}

// ─── Generic multi-format dispatcher ─────────────────────────────────────────

/**
 * Dispatch export in the requested format.
 * `sheets` array supports multi-sheet Excel; first sheet is also used for CSV.
 */
export function dispatchExport(
  format: ExportFormat,
  sheets: ExcelSheet[],
  pdfOpts: PDFReportOptions,
  filename: string,
): void {
  switch (format) {
    case 'CSV':
      if (sheets[0]) exportToCSV(sheets[0].headers, sheets[0].rows, filename);
      break;
    case 'Excel':
      exportToExcel(sheets, filename);
      break;
    case 'PDF':
      exportToPDF(pdfOpts, filename);
      break;
  }
}

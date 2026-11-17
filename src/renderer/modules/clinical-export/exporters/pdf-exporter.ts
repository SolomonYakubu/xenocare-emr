/**
 * Clinical Export System - PDF Exporter
 * XENOCARE EMR - Military-Grade Clinical Documentation
 *
 * Comprehensive PDF generation for clinical records export
 * Following medical record documentation standards
 * Audit-ready, consultant-ready output
 *
 * @version 2.0.0
 * @date January 25, 2026
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PatientJourneyExport } from '../api';
import type { PDFExportOptions } from '../types';
import { getICD10ChapterTitle } from '../standards';

// ==================== CONSTANTS ====================

const COLORS = {
  primary: [22, 101, 52] as [number, number, number], // XenoCare navy
  secondary: [51, 65, 85] as [number, number, number], // Slate-700
  accent: [37, 99, 235] as [number, number, number], // Blue-600
  success: [22, 163, 74] as [number, number, number], // Green-600
  warning: [217, 119, 6] as [number, number, number], // Amber-600
  danger: [220, 38, 38] as [number, number, number], // Red-600
  light: [248, 250, 252] as [number, number, number], // Slate-50
  text: [17, 24, 39] as [number, number, number], // Gray-900
  muted: [100, 116, 139] as [number, number, number], // Slate-500
  confidential: [139, 0, 0] as [number, number, number], // Dark red for confidential
  tableHeader: [22, 101, 52] as [number, number, number], // XenoCare navy
  tableAlt: [248, 250, 252] as [number, number, number], // Slate-50
};

const FONTS = {
  title: 18,
  subtitle: 14,
  sectionTitle: 12,
  body: 10,
  small: 8,
  tiny: 7,
  micro: 6,
};

const MARGINS = {
  left: 15,
  right: 15,
  top: 28, // Increased for confidentiality banner
  bottom: 25, // Increased for footer
};

const CONFIDENTIALITY_NOTICE =
  'CONFIDENTIAL MEDICAL RECORD – UNAUTHORIZED DISCLOSURE IS PROHIBITED';
const SYSTEM_NAME = 'XenoCare v2.0';

// ==================== HELPER FUNCTIONS ====================

/**
 * Format value or return em-dash for missing data
 * Per specification: Use "—" instead of placeholders like "Unknown", "-----"
 */
function safeValue(value: string | number | undefined | null): string {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 'Unknown' ||
    value === '-----'
  ) {
    return '—';
  }
  return String(value);
}

/**
 * Format date for display (DD MMM YYYY)
 */
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Format datetime for display
 */
function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Format currency (Nigerian Naira)
 * Note: Using "NGN" prefix instead of ₦ symbol for PDF compatibility
 * jsPDF standard fonts don't support the Naira symbol
 */
function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '—';
  // Use NGN prefix instead of symbol for PDF font compatibility
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `NGN ${formatted}`;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string | undefined | null, maxLength: number): string {
  if (!text) return '—';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Calculate age from date of birth for validation
 */
function calculateAge(dob: string | undefined | null): string | null {
  if (!dob) return null;
  try {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    if (days < 0) {
      months--;
      const prev = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prev.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years === 0 && months === 0) {
      const weeks = Math.floor(days / 7);
      const rem = days % 7;
      if (weeks > 0 && rem > 0) return `${weeks}w ${rem}d`;
      if (weeks > 0) return `${weeks}w`;
      return `${days}d`;
    }
    if (years === 0) {
      const parts = [`${months}m`];
      if (days > 0) parts.push(`${days}d`);
      return parts.join(' ');
    }
    const parts = [`${years}y`];
    if (months > 0) parts.push(`${months}m`);
    if (days > 0) parts.push(`${days}d`);
    return parts.join(' ');
  } catch {
    return null;
  }
}

/**
 * Generate unique export ID
 */
function generateExportId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `EXP-${timestamp}-${random}`;
}

// ==================== CLINICAL INTEGRITY VALIDATION ====================

interface DataInconsistency {
  field: string;
  issue: string;
  severity: 'warning' | 'error';
}

/**
 * Validate clinical data integrity
 */
function validateClinicalData(data: PatientJourneyExport): DataInconsistency[] {
  const issues: DataInconsistency[] = [];

  // Validate age vs DOB consistency
  const calculatedAge = calculateAge(data.patient.date_of_birth);
  if (calculatedAge !== null && data.patient.age !== undefined) {
    // calculateAge returns a formatted string like "45y 3m 12d"; extract years for comparison
    const yearMatch = calculatedAge.match(/^(\d+)y/);
    const calculatedYears = yearMatch ? parseInt(yearMatch[1], 10) : null;
    if (
      calculatedYears !== null &&
      Math.abs(calculatedYears - data.patient.age) > 1
    ) {
      issues.push({
        field: 'Age/DOB',
        issue: `Stated age (${data.patient.age}) doesn't match calculated age from DOB (${calculatedAge})`,
        severity: 'warning',
      });
    }
  }

  // Check for encounters without clinical elements
  for (const encounter of data.encounters) {
    const hasDiagnosis = data.diagnoses.some(
      (d) => d.encounter_id === encounter.id,
    );
    const hasPrescription = data.prescriptions.some(
      (p) => p.encounter_id === encounter.id,
    );
    const hasLabRequest = data.labRequests.some(
      (l) => l.encounter_id === encounter.id,
    );
    const hasNote = encounter.chief_complaint;

    if (!hasDiagnosis && !hasPrescription && !hasLabRequest && !hasNote) {
      issues.push({
        field: `Encounter ${encounter.encounter_number || encounter.id}`,
        issue:
          'Encounter has no clinical elements (complaint, diagnosis, prescription, or lab)',
        severity: 'warning',
      });
    }
  }

  // Check for duplicate ICD-10 codes in same encounter
  const encounterDiagnoses = new Map<string, Set<string>>();
  for (const dx of data.diagnoses) {
    const encId = dx.encounter_id || 'unknown';
    if (!encounterDiagnoses.has(encId)) {
      encounterDiagnoses.set(encId, new Set());
    }
    const codes = encounterDiagnoses.get(encId)!;
    if (dx.icd10_code && codes.has(dx.icd10_code)) {
      issues.push({
        field: `ICD-10 ${dx.icd10_code}`,
        issue: `Duplicate diagnosis code in encounter`,
        severity: 'warning',
      });
    }
    if (dx.icd10_code) {
      codes.add(dx.icd10_code);
    }
  }

  // Validate admission dates
  for (const admission of data.admissions) {
    if (admission.discharge_date && admission.admission_date) {
      const admitDate = new Date(admission.admission_date);
      const dischargeDate = new Date(admission.discharge_date);
      if (dischargeDate < admitDate) {
        issues.push({
          field: `Admission ${admission.admission_number}`,
          issue: 'Discharge date is before admission date',
          severity: 'error',
        });
      }
    }
  }

  return issues;
}

/**
 * Deduplicate diagnoses within same encounter
 */
function deduplicateDiagnoses(
  diagnoses: PatientJourneyExport['diagnoses'],
): PatientJourneyExport['diagnoses'] {
  const seen = new Map<string, (typeof diagnoses)[0]>();

  for (const dx of diagnoses) {
    const key = `${dx.encounter_id || 'none'}-${dx.icd10_code || dx.diagnosis_text}`;
    if (!seen.has(key)) {
      seen.set(key, dx);
    }
  }

  return Array.from(seen.values());
}

// ==================== PDF GENERATOR CLASS ====================

/**
 * Clinical PDF Exporter class - Military-Grade Medical Documentation
 */
export class ClinicalPDFExporter {
  private doc: jsPDF;

  private options: PDFExportOptions;

  private pageNumber: number = 0;

  private totalPages: number = 0;

  private tocEntries: { title: string; page: number; level: number }[] = [];

  private currentY: number = MARGINS.top;

  private exportId: string;

  private exportTimestamp: Date;

  private dataInconsistencies: DataInconsistency[] = [];

  private patientEMR: string = '';

  private exportedBy: string = '';

  constructor(options: PDFExportOptions) {
    this.options = options;
    this.doc = new jsPDF({
      orientation: options.orientation,
      unit: 'mm',
      format: options.pageSize,
    });
    this.exportId = generateExportId();
    this.exportTimestamp = new Date();
  }

  /**
   * Get page dimensions
   */
  private getPageDimensions() {
    return {
      width: this.doc.internal.pageSize.getWidth(),
      height: this.doc.internal.pageSize.getHeight(),
      contentWidth:
        this.doc.internal.pageSize.getWidth() - MARGINS.left - MARGINS.right,
    };
  }

  /**
   * Add new page with header and footer
   */
  private addPage() {
    this.doc.addPage();
    this.pageNumber++;
    this.currentY = MARGINS.top;
  }

  /**
   * Add confidentiality header to every page
   */
  private addConfidentialityHeader() {
    const { width } = this.getPageDimensions();

    // Red confidentiality banner at top
    this.doc.setFillColor(...COLORS.confidential);
    this.doc.rect(0, 0, width, 8, 'F');

    this.doc.setFontSize(FONTS.tiny);
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(CONFIDENTIALITY_NOTICE, width / 2, 5.5, { align: 'center' });

    // Hospital name and page number line
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('XenoCare', MARGINS.left, 15);

    // Page X of Y (placeholder - updated at end)
    this.doc.text(`Page ${this.pageNumber}`, width - MARGINS.right, 15, {
      align: 'right',
    });

    // Subtle line separator
    this.doc.setDrawColor(...COLORS.light);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGINS.left, 18, width - MARGINS.right, 18);
  }

  /**
   * Add comprehensive footer with metadata
   */
  private addPageFooter(patientEMR: string, exportedBy: string) {
    const { width, height } = this.getPageDimensions();

    // Line separator above footer
    this.doc.setDrawColor(...COLORS.light);
    this.doc.setLineWidth(0.3);
    this.doc.line(
      MARGINS.left,
      height - 18,
      width - MARGINS.right,
      height - 18,
    );

    // Export metadata row
    this.doc.setFontSize(FONTS.micro);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.setFont('helvetica', 'normal');

    const metaY = height - 14;
    this.doc.text(`EMR: ${patientEMR}`, MARGINS.left, metaY);
    this.doc.text(`Export ID: ${this.exportId}`, MARGINS.left + 50, metaY);
    this.doc.text(`System: ${SYSTEM_NAME}`, width / 2, metaY, {
      align: 'center',
    });
    this.doc.text(
      `Exported: ${this.exportTimestamp.toLocaleString('en-GB')}`,
      width - MARGINS.right,
      metaY,
      { align: 'right' },
    );

    // Exported by row
    const byY = height - 10;
    this.doc.text(`Exported By: ${exportedBy}`, MARGINS.left, byY);

    // Confidentiality reminder at bottom
    this.doc.setFontSize(FONTS.micro);
    this.doc.setTextColor(...COLORS.confidential);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(
      'CONFIDENTIAL – PROTECT FROM UNAUTHORIZED ACCESS',
      width / 2,
      height - 5,
      { align: 'center' },
    );
  }

  /**
   * Check if need new page
   */
  private checkPageBreak(requiredSpace: number = 30): boolean {
    const { height } = this.getPageDimensions();
    if (this.currentY + requiredSpace > height - MARGINS.bottom) {
      this.addPage();
      return true;
    }
    return false;
  }

  /**
   * Add section title with numbering
   */
  private addSectionTitle(title: string, level: number = 1) {
    this.checkPageBreak(20);

    // Add to TOC
    this.tocEntries.push({ title, page: this.pageNumber, level });

    const fontSize = level === 1 ? FONTS.sectionTitle : FONTS.body;
    const color = level === 1 ? COLORS.primary : COLORS.secondary;

    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(...color);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, MARGINS.left, this.currentY);

    this.currentY += 2;

    // Underline for level 1
    if (level === 1) {
      this.doc.setDrawColor(...COLORS.accent);
      this.doc.setLineWidth(0.5);
      this.doc.line(
        MARGINS.left,
        this.currentY,
        MARGINS.left + 60,
        this.currentY,
      );
    }

    this.currentY += 6;
    this.doc.setFont('helvetica', 'normal');
  }

  /**
   * Add text paragraph
   */
  private addParagraph(
    text: string,
    options?: {
      bold?: boolean;
      color?: [number, number, number];
      italic?: boolean;
    },
  ) {
    this.checkPageBreak();

    const { contentWidth } = this.getPageDimensions();

    this.doc.setFontSize(FONTS.body);
    this.doc.setTextColor(...(options?.color || COLORS.text));

    let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
    if (options?.bold && options?.italic) fontStyle = 'bolditalic';
    else if (options?.bold) fontStyle = 'bold';
    else if (options?.italic) fontStyle = 'italic';

    this.doc.setFont('helvetica', fontStyle);

    const lines = this.doc.splitTextToSize(text, contentWidth);
    this.doc.text(lines, MARGINS.left, this.currentY);

    this.currentY += lines.length * 5 + 3;
    this.doc.setFont('helvetica', 'normal');
  }

  /**
   * Add key-value pair with consistent formatting
   */
  private addKeyValue(key: string, value: string | number | undefined | null) {
    this.doc.setFontSize(FONTS.body);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(`${key}:`, MARGINS.left, this.currentY);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...COLORS.text);
    this.doc.text(safeValue(value), MARGINS.left + 45, this.currentY);

    this.currentY += 5;
  }

  /**
   * Add two-column key-value pairs for demographics
   */
  private addTwoColumnKeyValue(
    pairs: { key: string; value: string | number | undefined | null }[],
  ) {
    const { contentWidth } = this.getPageDimensions();
    const colWidth = contentWidth / 2;

    for (let i = 0; i < pairs.length; i += 2) {
      this.checkPageBreak();

      const left = pairs[i];
      const right = pairs[i + 1];

      this.doc.setFontSize(FONTS.body);

      // Left column
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...COLORS.muted);
      this.doc.text(`${left.key}:`, MARGINS.left, this.currentY);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...COLORS.text);
      this.doc.text(safeValue(left.value), MARGINS.left + 38, this.currentY);

      // Right column
      if (right) {
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...COLORS.muted);
        this.doc.text(`${right.key}:`, MARGINS.left + colWidth, this.currentY);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...COLORS.text);
        this.doc.text(
          safeValue(right.value),
          MARGINS.left + colWidth + 38,
          this.currentY,
        );
      }

      this.currentY += 5;
    }

    this.currentY += 2;
  }

  /**
   * Add professional table with fixed columns
   */
  private addTable(
    headers: string[],
    data: (string | number)[][],
    options?: {
      columnWidths?: number[];
      headerColor?: [number, number, number];
      striped?: boolean;
    },
  ) {
    this.checkPageBreak(30);

    const self = this;
    const { contentWidth } = this.getPageDimensions();

    // Calculate column widths that fit within page
    let columnStyles:
      | Record<number, { cellWidth: number | 'auto' | 'wrap' }>
      | undefined;
    if (options?.columnWidths) {
      const totalWidth = options.columnWidths.reduce((sum, w) => sum + w, 0);
      if (totalWidth > contentWidth) {
        // Scale down column widths proportionally to fit
        const scale = contentWidth / totalWidth;
        columnStyles = headers.reduce(
          (acc, _, i) => {
            if (options.columnWidths![i]) {
              acc[i] = {
                cellWidth: Math.floor(options.columnWidths![i] * scale),
              };
            }
            return acc;
          },
          {} as Record<number, { cellWidth: number | 'auto' | 'wrap' }>,
        );
      } else {
        columnStyles = headers.reduce(
          (acc, _, i) => {
            if (options.columnWidths![i]) {
              acc[i] = { cellWidth: options.columnWidths![i] };
            }
            return acc;
          },
          {} as Record<number, { cellWidth: number | 'auto' | 'wrap' }>,
        );
      }
    }

    autoTable(this.doc, {
      startY: this.currentY,
      head: [headers],
      body: data,
      margin: { left: MARGINS.left, right: MARGINS.right },
      tableWidth: 'auto',
      styles: {
        fontSize: FONTS.small,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: options?.headerColor || COLORS.tableHeader,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles:
        options?.striped !== false
          ? {
              fillColor: COLORS.tableAlt,
            }
          : undefined,
      columnStyles,
      didDrawPage() {
        self.pageNumber++;
        self.addConfidentialityHeader();
        self.addPageFooter(self.patientEMR, self.exportedBy);
      },
    });

    // Update currentY after table
    const lastTable = (
      this.doc as unknown as { lastAutoTable: { finalY: number } }
    ).lastAutoTable;
    this.currentY = lastTable ? lastTable.finalY + 8 : this.currentY + 20;
  }

  /**
   * Add info box (highlighted section)
   */
  private addInfoBox(
    title: string,
    content: string[],
    type: 'info' | 'warning' | 'error' = 'info',
  ) {
    this.checkPageBreak(30);

    const { contentWidth } = this.getPageDimensions();
    const boxHeight = 8 + content.length * 5;

    const bgColor =
      type === 'error'
        ? [255, 235, 235]
        : type === 'warning'
          ? [255, 248, 220]
          : [235, 245, 255];
    const borderColor =
      type === 'error'
        ? COLORS.danger
        : type === 'warning'
          ? COLORS.warning
          : COLORS.accent;

    // Box background
    this.doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    this.doc.setDrawColor(...borderColor);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(
      MARGINS.left,
      this.currentY - 2,
      contentWidth,
      boxHeight,
      2,
      2,
      'FD',
    );

    // Title
    this.doc.setFontSize(FONTS.small);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...borderColor);
    this.doc.text(title, MARGINS.left + 3, this.currentY + 3);

    // Content
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(...COLORS.text);

    let y = this.currentY + 8;
    for (const line of content) {
      this.doc.text(`• ${line}`, MARGINS.left + 5, y);
      y += 5;
    }

    this.currentY += boxHeight + 5;
  }

  /**
   * Add spacing
   */
  private addSpacing(size: number = 5) {
    this.currentY += size;
  }

  // ==================== SECTION GENERATORS ====================

  /**
   * Generate professional cover page
   */
  private generateCoverPage(data: PatientJourneyExport) {
    const { width, height } = this.getPageDimensions();
    this.pageNumber = 1;

    // Confidentiality banner at top
    this.doc.setFillColor(...COLORS.confidential);
    this.doc.rect(0, 0, width, 10, 'F');
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(CONFIDENTIALITY_NOTICE, width / 2, 7, { align: 'center' });

    // Hospital header
    this.doc.setFillColor(...COLORS.primary);
    this.doc.rect(0, 10, width, 45, 'F');

    this.doc.setFontSize(22);
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('XENOCARE', width / 2, 30, {
      align: 'center',
    });
    this.doc.setFontSize(16);
    this.doc.text('MEDICAL CENTRE', width / 2, 42, { align: 'center' });

    // Document title
    this.currentY = 75;
    this.doc.setFontSize(24);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text('PATIENT MEDICAL SUMMARY', width / 2, this.currentY, {
      align: 'center',
    });

    this.currentY += 8;
    this.doc.setFontSize(14);
    this.doc.setTextColor(...COLORS.secondary);
    this.doc.text('CLINICAL RECORDS EXPORT', width / 2, this.currentY, {
      align: 'center',
    });

    // Patient info box
    this.currentY = 105;
    const boxWidth = 130;
    const boxX = (width - boxWidth) / 2;

    this.doc.setFillColor(...COLORS.light);
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(1);
    this.doc.roundedRect(boxX, this.currentY, boxWidth, 55, 3, 3, 'FD');

    // Patient name
    this.doc.setFontSize(16);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.setFont('helvetica', 'bold');
    const fullName =
      `${data.patient.first_name} ${data.patient.middle_name || ''} ${data.patient.surname}`.trim();
    this.doc.text(fullName, width / 2, this.currentY + 15, { align: 'center' });

    // Patient details
    this.doc.setFontSize(FONTS.body);
    this.doc.setTextColor(...COLORS.text);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(
      `EMR Number: ${safeValue(data.patient.emr_number)}`,
      width / 2,
      this.currentY + 27,
      { align: 'center' },
    );
    this.doc.text(
      `Gender: ${safeValue(data.patient.gender)} | Age: ${safeValue(data.patient.age)}`,
      width / 2,
      this.currentY + 35,
      { align: 'center' },
    );
    this.doc.text(
      `Date of Birth: ${formatDate(data.patient.date_of_birth)}`,
      width / 2,
      this.currentY + 43,
      { align: 'center' },
    );
    this.doc.text(
      `Nationality: ${safeValue(data.patient.nationality)} | Category: ${safeValue(data.patient.patient_category)}`,
      width / 2,
      this.currentY + 51,
      { align: 'center' },
    );

    // Export metadata box
    this.currentY = 175;
    this.doc.setFillColor(255, 255, 255);
    this.doc.setDrawColor(...COLORS.accent);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(boxX, this.currentY, boxWidth, 40, 2, 2, 'FD');

    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('EXPORT METADATA', width / 2, this.currentY + 8, {
      align: 'center',
    });

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(FONTS.small);
    const { exportMetadata } = data;

    // Metadata in two columns
    this.doc.text(
      `Export Date: ${this.exportTimestamp.toLocaleDateString('en-GB')}`,
      boxX + 5,
      this.currentY + 18,
    );
    this.doc.text(`Export ID: ${this.exportId}`, boxX + 70, this.currentY + 18);
    this.doc.text(
      `Exported By: ${exportMetadata.exportedBy.name}`,
      boxX + 5,
      this.currentY + 26,
    );
    this.doc.text(`System: ${SYSTEM_NAME}`, boxX + 70, this.currentY + 26);

    const periodText =
      exportMetadata.dateRange.from && exportMetadata.dateRange.to
        ? `Period: ${formatDate(exportMetadata.dateRange.from)} to ${formatDate(exportMetadata.dateRange.to)}`
        : 'Period: All Records';
    this.doc.text(periodText, width / 2, this.currentY + 34, {
      align: 'center',
    });

    // Clinical Activity Summary box
    this.currentY = 225;
    this.doc.setFillColor(...COLORS.light);
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(boxX, this.currentY, boxWidth, 45, 2, 2, 'FD');

    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(...COLORS.primary);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CLINICAL ACTIVITY SUMMARY', width / 2, this.currentY + 8, {
      align: 'center',
    });

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(FONTS.body);
    this.doc.setTextColor(...COLORS.text);

    const counts = exportMetadata.recordCounts;
    const col1X = boxX + 8;
    const col2X = boxX + 70;

    this.doc.text(
      `Encounters: ${counts.encounters}`,
      col1X,
      this.currentY + 20,
    );
    this.doc.text(`Diagnoses: ${counts.diagnoses}`, col2X, this.currentY + 20);
    this.doc.text(
      `Prescriptions: ${counts.prescriptions}`,
      col1X,
      this.currentY + 28,
    );
    this.doc.text(
      `Lab Tests: ${counts.labRequests}`,
      col2X,
      this.currentY + 28,
    );
    this.doc.text(
      `Procedures: ${counts.procedures}`,
      col1X,
      this.currentY + 36,
    );
    this.doc.text(
      `Admissions: ${counts.admissions}`,
      col2X,
      this.currentY + 36,
    );

    // Data integrity notice if there are issues
    if (this.dataInconsistencies.length > 0) {
      this.currentY = 278;
      this.doc.setFontSize(FONTS.tiny);
      this.doc.setTextColor(...COLORS.warning);
      this.doc.setFont('helvetica', 'italic');
      this.doc.text(
        `Note: ${this.dataInconsistencies.length} data inconsistencies flagged for review`,
        width / 2,
        this.currentY,
        { align: 'center' },
      );
    }

    // Footer
    this.doc.setFontSize(FONTS.tiny);
    this.doc.setTextColor(...COLORS.danger);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(CONFIDENTIALITY_NOTICE, width / 2, height - 15, {
      align: 'center',
    });

    this.doc.setFontSize(FONTS.micro);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(
      'This document may be reviewed by medical consultants, auditors, and military health administrators.',
      width / 2,
      height - 8,
      { align: 'center' },
    );
  }

  /**
   * Generate patient demographics section
   */
  private generateDemographicsSection(data: PatientJourneyExport) {
    this.addPage();
    this.addSectionTitle('1. PATIENT DEMOGRAPHICS');

    const { patient } = data;

    // Full name at top
    const fullName =
      `${patient.first_name} ${patient.middle_name || ''} ${patient.surname}`.trim();
    this.addKeyValue('Full Name', fullName);
    this.addSpacing(2);

    this.addTwoColumnKeyValue([
      { key: 'EMR Number', value: patient.emr_number },
      { key: 'Gender', value: patient.gender },
      { key: 'Date of Birth', value: formatDate(patient.date_of_birth) },
      { key: 'Age', value: patient.age || null },
      { key: 'Blood Group', value: patient.blood_group },
      { key: 'Genotype', value: patient.genotype },
      { key: 'Marital Status', value: patient.marital_status },
      { key: 'Nationality', value: patient.nationality },
      { key: 'State of Origin', value: patient.state_of_origin },
      { key: 'LGA', value: patient.lga },
      { key: 'Occupation', value: patient.occupation },
      { key: 'Category', value: patient.patient_category },
    ]);

    this.addSpacing(5);
    this.addSectionTitle('1.1 Contact Information', 2);

    this.addTwoColumnKeyValue([
      { key: 'Phone', value: patient.contact_phone },
      { key: 'Email', value: patient.contact_email },
      { key: 'Address', value: patient.address },
      { key: 'City', value: patient.city },
      { key: 'State', value: patient.state },
    ]);

    if (patient.emergency_contact) {
      this.addSpacing(5);
      this.addSectionTitle('1.2 Emergency Contact', 2);

      this.addTwoColumnKeyValue([
        { key: 'Name', value: patient.emergency_contact.name },
        { key: 'Relationship', value: patient.emergency_contact.relationship },
        { key: 'Phone', value: patient.emergency_contact.phone },
      ]);
    }

    if (patient.nhis_number || patient.hmo_name) {
      this.addSpacing(5);
      this.addSectionTitle('1.3 Insurance Information', 2);

      this.addTwoColumnKeyValue([
        { key: 'NHIS Number', value: patient.nhis_number },
        { key: 'HMO', value: patient.hmo_name },
        { key: 'Company', value: patient.company_name },
        { key: 'Staff ID', value: patient.staff_id },
      ]);
    }
  }

  /**
   * Generate encounter history section with proper structure
   */
  private generateEncountersSection(data: PatientJourneyExport) {
    if (data.encounters.length === 0) {
      this.addPage();
      this.addSectionTitle('2. ENCOUNTER HISTORY');
      this.addParagraph(
        'No encounters recorded for this patient in the selected period.',
        { italic: true },
      );
      return;
    }

    this.addPage();
    this.addSectionTitle('2. ENCOUNTER HISTORY');

    this.addParagraph(`Total Encounters: ${data.encounters.length}`, {
      bold: true,
    });
    this.addSpacing(3);

    // Sort encounters chronologically (newest first for review)
    const sortedEncounters = [...data.encounters].sort((a, b) => {
      const dateA = new Date(a.encounter_date || 0);
      const dateB = new Date(b.encounter_date || 0);
      return dateB.getTime() - dateA.getTime(); // Newest first
    });

    const tableData = sortedEncounters.map((enc) => {
      // Check if encounter has clinical elements
      const hasDiagnosis = data.diagnoses.some(
        (d) => d.encounter_id === enc.id,
      );
      const hasPrescription = data.prescriptions.some(
        (p) => p.encounter_id === enc.id,
      );
      const hasLabRequest = data.labRequests.some(
        (l) => l.encounter_id === enc.id,
      );

      const chiefComplaint = enc.chief_complaint || '—';
      const clinicalFlag =
        !hasDiagnosis &&
        !hasPrescription &&
        !hasLabRequest &&
        chiefComplaint === '—'
          ? '*'
          : '';

      return [
        formatDate(enc.encounter_date),
        safeValue(enc.encounter_number),
        safeValue(enc.encounter_type),
        safeValue(enc.department_name),
        safeValue(enc.attending_doctor_name),
        safeValue(enc.status),
        truncate(chiefComplaint, 25) + clinicalFlag,
      ];
    });

    this.addTable(
      [
        'Date',
        'Enc #',
        'Type',
        'Department',
        'Clinician',
        'Status',
        'Chief Complaint',
      ],
      tableData,
      { columnWidths: [22, 22, 20, 28, 32, 18, 35] },
    );

    // Legend for flags
    this.addSpacing(2);
    this.doc.setFontSize(FONTS.tiny);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.text(
      '* = Encounter may lack clinical documentation',
      MARGINS.left,
      this.currentY,
    );
    this.currentY += 5;
  }

  /**
   * Generate diagnoses section with ICD-10 standards
   */
  private generateDiagnosesSection(data: PatientJourneyExport) {
    // Deduplicate diagnoses per specification
    const uniqueDiagnoses = deduplicateDiagnoses(data.diagnoses);

    if (uniqueDiagnoses.length === 0) {
      this.addPage();
      this.addSectionTitle('3. DIAGNOSES (ICD-10)');
      this.addParagraph(
        'No diagnoses recorded for this patient in the selected period.',
        { italic: true },
      );
      return;
    }

    this.addPage();
    this.addSectionTitle('3. DIAGNOSES (ICD-10)');

    this.addParagraph(`Total Diagnoses: ${uniqueDiagnoses.length}`, {
      bold: true,
    });
    this.addSpacing(3);

    // Sort by date (newest first)
    const sortedDiagnoses = [...uniqueDiagnoses].sort((a, b) => {
      const dateA = new Date(a.diagnosed_at || 0);
      const dateB = new Date(b.diagnosed_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const tableData = sortedDiagnoses.map((dx) => [
      formatDate(dx.diagnosed_at),
      safeValue(dx.icd10_code),
      truncate(dx.diagnosis_text, 35),
      safeValue(dx.diagnosis_type),
      truncate(getICD10ChapterTitle(dx.icd10_code), 30),
    ]);

    this.addTable(
      [
        'Date',
        'ICD-10 Code',
        'Diagnosis Description',
        'Type',
        'ICD-10 Category',
      ],
      tableData,
      { columnWidths: [22, 22, 50, 22, 50] },
    );
  }

  /**
   * Generate vitals section with LOINC standards
   */
  private generateVitalsSection(data: PatientJourneyExport) {
    if (data.vitals.length === 0) return;

    this.addPage();
    this.addSectionTitle('4. VITAL SIGNS (LOINC)');

    this.addParagraph(`Total Recordings: ${data.vitals.length}`, {
      bold: true,
    });
    this.addSpacing(3);

    // Sort by date (newest first)
    const sortedVitals = [...data.vitals].sort((a, b) => {
      const dateA = new Date(a.recorded_at || 0);
      const dateB = new Date(b.recorded_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const tableData = sortedVitals.map((v) => [
      formatDateTime(v.recorded_at),
      v.temperature ? `${v.temperature}C` : '—',
      v.blood_pressure_systolic && v.blood_pressure_diastolic
        ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}`
        : '—',
      v.pulse_rate ? `${v.pulse_rate}/min` : '—',
      v.respiratory_rate ? `${v.respiratory_rate}/min` : '—',
      v.oxygen_saturation ? `${v.oxygen_saturation}%` : '—',
      v.weight ? `${v.weight}kg` : '—',
      v.pain_score !== undefined && v.pain_score !== null
        ? `${v.pain_score}/10`
        : '—',
    ]);

    this.addTable(
      [
        'Date/Time',
        'Temp',
        'BP (mmHg)',
        'Pulse',
        'RR',
        'SpO2',
        'Weight',
        'Pain',
      ],
      tableData,
      { columnWidths: [35, 18, 22, 18, 18, 18, 20, 18] },
    );
  }

  /**
   * Generate prescriptions section
   */
  private generatePrescriptionsSection(data: PatientJourneyExport) {
    if (data.prescriptions.length === 0) return;

    this.addPage();
    this.addSectionTitle('5. MEDICATIONS & PRESCRIPTIONS');

    this.addParagraph(`Total Prescriptions: ${data.prescriptions.length}`, {
      bold: true,
    });
    this.addSpacing(3);

    // Sort by date (newest first)
    const sortedPrescriptions = [...data.prescriptions].sort((a, b) => {
      const dateA = new Date(a.prescribed_at || 0);
      const dateB = new Date(b.prescribed_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const tableData = sortedPrescriptions.map((rx) => [
      formatDate(rx.prescribed_at),
      truncate(rx.drug_name, 25),
      safeValue(rx.dosage),
      safeValue(rx.route),
      safeValue(rx.frequency),
      safeValue(rx.duration),
      safeValue(rx.quantity_prescribed),
      safeValue(rx.status),
    ]);

    this.addTable(
      [
        'Date',
        'Medication',
        'Dosage',
        'Route',
        'Frequency',
        'Duration',
        'Qty',
        'Status',
      ],
      tableData,
      { columnWidths: [22, 35, 22, 15, 22, 20, 15, 20] },
    );
  }

  /**
   * Generate laboratory section
   */
  private generateLaboratorySection(data: PatientJourneyExport) {
    if (data.labRequests.length === 0) return;

    this.addPage();
    this.addSectionTitle('6. LABORATORY INVESTIGATIONS');

    this.addParagraph(`Total Lab Requests: ${data.labRequests.length}`, {
      bold: true,
    });
    this.addSpacing(3);

    // Sort by date (newest first)
    const sortedLabs = [...data.labRequests].sort((a, b) => {
      const dateA = new Date(a.ordered_at || 0);
      const dateB = new Date(b.ordered_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const requestData = sortedLabs.map((lab) => [
      formatDate(lab.ordered_at),
      safeValue(lab.test_name),
      safeValue(lab.test_category),
      safeValue(lab.priority),
      safeValue(lab.status),
      safeValue(lab.ordered_by_name),
    ]);

    this.addTable(
      ['Date', 'Test', 'Category', 'Priority', 'Status', 'Ordered By'],
      requestData,
      { columnWidths: [22, 50, 30, 20, 22, 30] },
    );

    // Lab results if available
    if (data.labResults.length > 0) {
      this.addSpacing(10);
      this.addSectionTitle('6.1 Laboratory Results', 2);

      const resultData = data.labResults.map((result) => [
        safeValue(result.test_name),
        safeValue(result.result_value),
        safeValue(result.unit),
        result.reference_range_text ||
          (result.reference_range_low !== undefined &&
          result.reference_range_high !== undefined
            ? `${result.reference_range_low}-${result.reference_range_high}`
            : '—'),
        result.abnormal_flag || 'N',
      ]);

      this.addTable(
        ['Test', 'Result', 'Unit', 'Reference Range', 'Flag'],
        resultData,
        { columnWidths: [50, 30, 20, 40, 20] },
      );
    }
  }

  /**
   * Generate radiology section
   */
  private generateRadiologySection(data: PatientJourneyExport) {
    if (data.radiologyRequests.length === 0) return;

    this.addPage();
    this.addSectionTitle('7. RADIOLOGY & IMAGING');

    this.addParagraph(
      `Total Imaging Studies: ${data.radiologyRequests.length}`,
      { bold: true },
    );
    this.addSpacing(3);

    // Sort by date (newest first)
    const sortedRadiology = [...data.radiologyRequests].sort((a, b) => {
      const dateA = new Date(a.ordered_at || 0);
      const dateB = new Date(b.ordered_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const requestData = sortedRadiology.map((rad) => [
      formatDate(rad.ordered_at),
      safeValue(rad.imaging_type),
      safeValue(rad.examination_name),
      safeValue(rad.body_part),
      safeValue(rad.priority),
      safeValue(rad.status),
    ]);

    this.addTable(
      ['Date', 'Modality', 'Examination', 'Body Part', 'Priority', 'Status'],
      requestData,
      { columnWidths: [22, 22, 50, 30, 20, 22] },
    );

    // Radiology reports
    if (data.radiologyReports.length > 0) {
      this.addSpacing(10);
      this.addSectionTitle('7.1 Radiology Reports', 2);

      for (const report of data.radiologyReports) {
        this.checkPageBreak(40);

        this.doc.setFontSize(FONTS.small);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...COLORS.secondary);
        this.doc.text(
          `Report Date: ${formatDate(report.reported_at)}`,
          MARGINS.left,
          this.currentY,
        );
        this.currentY += 5;

        this.doc.setFont('helvetica', 'normal');

        if (report.findings) {
          this.addParagraph(`Findings: ${report.findings}`);
        }
        if (report.impression) {
          this.addParagraph(`Impression: ${report.impression}`, { bold: true });
        }
        if (report.recommendation) {
          this.addParagraph(`Recommendation: ${report.recommendation}`);
        }

        this.addSpacing(5);
      }
    }
  }

  /**
   * Generate procedures section
   */
  private generateProceduresSection(data: PatientJourneyExport) {
    if (data.procedures.length === 0) return;

    this.addPage();
    this.addSectionTitle('8. PROCEDURES');

    this.addParagraph(`Total Procedures: ${data.procedures.length}`, {
      bold: true,
    });
    this.addSpacing(3);

    // Sort by date (newest first)
    const sortedProcedures = [...data.procedures].sort((a, b) => {
      const dateA = new Date(a.performed_at || 0);
      const dateB = new Date(b.performed_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const tableData = sortedProcedures.map((proc) => [
      formatDate(proc.performed_at),
      truncate(proc.procedure_name, 30),
      safeValue(proc.procedure_type),
      safeValue(proc.cpt_code || proc.icd10_pcs_code),
      safeValue(proc.outcome),
      safeValue(proc.performed_by_name),
    ]);

    this.addTable(
      ['Date', 'Procedure', 'Type', 'Code', 'Outcome', 'Performed By'],
      tableData,
      { columnWidths: [22, 45, 22, 22, 25, 35] },
    );
  }

  /**
   * Generate admissions section
   */
  private generateAdmissionsSection(data: PatientJourneyExport) {
    if (data.admissions.length === 0) return;

    this.addPage();
    this.addSectionTitle('9. ADMISSIONS & INPATIENT CARE');

    this.addParagraph(`Total Admissions: ${data.admissions.length}`, {
      bold: true,
    });
    this.addSpacing(3);

    // Sort by date (newest first)
    const sortedAdmissions = [...data.admissions].sort((a, b) => {
      const dateA = new Date(a.admission_date || 0);
      const dateB = new Date(b.admission_date || 0);
      return dateB.getTime() - dateA.getTime();
    });

    for (const admission of sortedAdmissions) {
      this.checkPageBreak(50);

      // Admission header
      const { contentWidth } = this.getPageDimensions();
      this.doc.setFillColor(...COLORS.light);
      this.doc.roundedRect(
        MARGINS.left,
        this.currentY - 2,
        contentWidth,
        8,
        1,
        1,
        'F',
      );

      this.doc.setFontSize(FONTS.body);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...COLORS.primary);
      this.doc.text(
        `Admission: ${safeValue(admission.admission_number)}`,
        MARGINS.left + 2,
        this.currentY + 3,
      );

      const statusColor =
        admission.status === 'Discharged' ? COLORS.success : COLORS.warning;
      this.doc.setTextColor(...statusColor);
      this.doc.text(
        safeValue(admission.status).toUpperCase(),
        MARGINS.left + contentWidth - 30,
        this.currentY + 3,
      );

      this.currentY += 12;

      this.addTwoColumnKeyValue([
        { key: 'Admission Date', value: formatDate(admission.admission_date) },
        {
          key: 'Discharge Date',
          value: admission.discharge_date
            ? formatDate(admission.discharge_date)
            : 'Still Admitted',
        },
        { key: 'Type', value: admission.admission_type },
        { key: 'Ward', value: admission.ward_name },
        { key: 'Bed', value: admission.bed_number },
        {
          key: 'LOS',
          value: admission.length_of_stay
            ? `${admission.length_of_stay} days`
            : '—',
        },
        {
          key: 'Admission Dx',
          value: truncate(admission.admission_diagnosis, 35),
        },
        {
          key: 'Discharge Dx',
          value: truncate(admission.discharge_diagnosis, 35),
        },
        { key: 'Outcome', value: admission.outcome },
        { key: 'Attending', value: admission.attending_doctor_name },
      ]);

      this.addSpacing(5);
    }
  }

  /**
   * Generate billing summary section
   */
  private generateBillingSection(data: PatientJourneyExport) {
    if (data.billingRecords.length === 0) return;

    this.addPage();
    this.addSectionTitle('10. BILLING SUMMARY');

    // Calculate totals
    const totalBilled = data.billingRecords.reduce(
      (sum, b) => sum + (b.total_amount || 0),
      0,
    );
    const totalPaid = data.billingRecords.reduce(
      (sum, b) => sum + (b.amount_paid || 0),
      0,
    );
    const totalBalance = data.billingRecords.reduce(
      (sum, b) => sum + (b.balance || 0),
      0,
    );

    // Summary box
    this.addInfoBox(
      'Financial Summary',
      [
        `Total Billed: ${formatCurrency(totalBilled)}`,
        `Total Paid: ${formatCurrency(totalPaid)}`,
        `Outstanding Balance: ${formatCurrency(totalBalance)}`,
        `Number of Invoices: ${data.billingRecords.length}`,
      ],
      totalBalance > 0 ? 'warning' : 'info',
    );

    this.addSpacing(5);

    // Sort by date (newest first)
    const sortedBilling = [...data.billingRecords].sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const tableData = sortedBilling.map((bill) => [
      formatDate(bill.created_at),
      safeValue(bill.order_number),
      safeValue(bill.payment_category),
      formatCurrency(bill.total_amount),
      formatCurrency(bill.amount_paid),
      formatCurrency(bill.balance),
      safeValue(bill.status),
    ]);

    this.addTable(
      ['Date', 'Invoice #', 'Category', 'Amount', 'Paid', 'Balance', 'Status'],
      tableData,
      { columnWidths: [22, 25, 25, 28, 28, 28, 20] },
    );
  }

  /**
   * Generate nursing notes section
   */
  private generateNursingSection(data: PatientJourneyExport) {
    if (data.nursingRecords.length === 0) return;

    this.addPage();
    this.addSectionTitle('11. NURSING NOTES');

    this.addParagraph(`Total Notes: ${data.nursingRecords.length}`, {
      bold: true,
    });
    this.addSpacing(3);

    // Sort by date (newest first)
    const sortedNotes = [...data.nursingRecords].sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    // Limit to most recent 20 notes
    const displayNotes = sortedNotes.slice(0, 20);

    for (const note of displayNotes) {
      this.checkPageBreak(30);

      this.doc.setFontSize(FONTS.small);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...COLORS.secondary);
      this.doc.text(
        `${formatDateTime(note.created_at)} | ${safeValue(note.note_type)} | ${safeValue(note.patient_condition)} | ${safeValue(note.nurse_name)}`,
        MARGINS.left,
        this.currentY,
      );
      this.currentY += 5;

      if (note.notes) {
        this.addParagraph(truncate(note.notes, 300));
      }

      this.addSpacing(3);
    }

    if (data.nursingRecords.length > 20) {
      this.addParagraph(
        `... and ${data.nursingRecords.length - 20} additional notes (not shown)`,
        { color: COLORS.muted, italic: true },
      );
    }
  }

  /**
   * Generate data integrity warnings section
   */
  private generateDataIntegritySection() {
    if (this.dataInconsistencies.length === 0) return;

    this.addPage();
    this.addSectionTitle('12. DATA INTEGRITY NOTES');

    this.addParagraph(
      'The following potential data inconsistencies were identified during export. These items are flagged for review and do not necessarily indicate errors.',
      { italic: true },
    );
    this.addSpacing(5);

    const warnings = this.dataInconsistencies.filter(
      (i) => i.severity === 'warning',
    );
    const errors = this.dataInconsistencies.filter(
      (i) => i.severity === 'error',
    );

    if (errors.length > 0) {
      this.addInfoBox(
        'Critical Issues',
        errors.map((e) => `${e.field}: ${e.issue}`),
        'error',
      );
    }

    if (warnings.length > 0) {
      this.addInfoBox(
        'Warnings',
        warnings.map((w) => `${w.field}: ${w.issue}`),
        'warning',
      );
    }
  }

  /**
   * Generate authorization/signature section
   */
  private generateAuthorizationSection(data: PatientJourneyExport) {
    this.addPage();
    this.addSectionTitle('13. AUTHORIZATION & CERTIFICATION');

    this.addParagraph(
      "This document is a certified export of electronic medical records from the XenoCare system. The information contained herein has been extracted directly from the patient's electronic health record without modification.",
      { italic: false },
    );

    this.addSpacing(10);

    // Export certification box
    const { contentWidth } = this.getPageDimensions();

    this.doc.setFillColor(...COLORS.light);
    this.doc.setDrawColor(...COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(
      MARGINS.left,
      this.currentY,
      contentWidth,
      45,
      2,
      2,
      'FD',
    );

    this.doc.setFontSize(FONTS.body);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...COLORS.primary);
    this.doc.text('EXPORT CERTIFICATION', MARGINS.left + 5, this.currentY + 8);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(FONTS.small);
    this.doc.setTextColor(...COLORS.text);

    this.doc.text(
      `Export ID: ${this.exportId}`,
      MARGINS.left + 5,
      this.currentY + 18,
    );
    this.doc.text(
      `Export Date & Time: ${this.exportTimestamp.toLocaleString('en-GB')}`,
      MARGINS.left + 5,
      this.currentY + 25,
    );
    this.doc.text(
      `Exported By: ${data.exportMetadata.exportedBy.name} (${data.exportMetadata.exportedBy.role})`,
      MARGINS.left + 5,
      this.currentY + 32,
    );
    this.doc.text(
      `System: ${SYSTEM_NAME}`,
      MARGINS.left + 5,
      this.currentY + 39,
    );

    this.currentY += 55;

    // Signature lines
    this.addSpacing(10);
    this.doc.setFontSize(FONTS.body);
    this.doc.setTextColor(...COLORS.text);

    // Authorization signature block
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('AUTHORIZED SIGNATURE', MARGINS.left, this.currentY);
    this.currentY += 20;

    this.doc.setDrawColor(...COLORS.text);
    this.doc.setLineWidth(0.3);
    this.doc.line(
      MARGINS.left,
      this.currentY,
      MARGINS.left + 70,
      this.currentY,
    );
    this.doc.line(
      MARGINS.left + 90,
      this.currentY,
      MARGINS.left + 130,
      this.currentY,
    );

    this.doc.setFontSize(FONTS.small);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 5;
    this.doc.text('Signature', MARGINS.left + 25, this.currentY);
    this.doc.text('Date', MARGINS.left + 105, this.currentY);

    this.currentY += 15;
    this.doc.line(
      MARGINS.left,
      this.currentY,
      MARGINS.left + 70,
      this.currentY,
    );
    this.currentY += 5;
    this.doc.text('Name & Designation', MARGINS.left + 15, this.currentY);

    // Receiving party block
    this.currentY += 20;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(FONTS.body);
    this.doc.text('RECEIVED BY (if applicable)', MARGINS.left, this.currentY);
    this.currentY += 20;

    this.doc.line(
      MARGINS.left,
      this.currentY,
      MARGINS.left + 70,
      this.currentY,
    );
    this.doc.line(
      MARGINS.left + 90,
      this.currentY,
      MARGINS.left + 130,
      this.currentY,
    );

    this.doc.setFontSize(FONTS.small);
    this.doc.setFont('helvetica', 'normal');
    this.currentY += 5;
    this.doc.text('Signature', MARGINS.left + 25, this.currentY);
    this.doc.text('Date', MARGINS.left + 105, this.currentY);

    this.currentY += 15;
    this.doc.line(
      MARGINS.left,
      this.currentY,
      MARGINS.left + 70,
      this.currentY,
    );
    this.currentY += 5;
    this.doc.text('Name & Organization', MARGINS.left + 15, this.currentY);

    // Legal disclaimer
    this.currentY += 20;
    this.doc.setFontSize(FONTS.tiny);
    this.doc.setTextColor(...COLORS.muted);
    this.doc.setFont('helvetica', 'italic');
    const disclaimer =
      'This document contains protected health information. Unauthorized access, use, or disclosure is prohibited and may be punishable under applicable laws. If you have received this document in error, please notify the sender immediately and destroy all copies.';
    const lines = this.doc.splitTextToSize(disclaimer, contentWidth);
    this.doc.text(lines, MARGINS.left, this.currentY);
  }

  // ==================== MAIN EXPORT FUNCTION ====================

  /**
   * Generate complete clinical export PDF - Military-Grade Output
   */
  public async generate(data: PatientJourneyExport): Promise<Blob> {
    // Store patient info for footer
    this.patientEMR = data.patient.emr_number || '';
    this.exportedBy = data.exportMetadata.exportedBy.name || '';

    // Validate clinical data integrity
    this.dataInconsistencies = validateClinicalData(data);

    // Generate cover page
    if (this.options.includeCoverPage) {
      this.generateCoverPage(data);
    }

    // Generate sections based on included modules
    const modules = data.exportMetadata.modulesCovered;

    if (modules.includes('demographics')) {
      this.generateDemographicsSection(data);
    }

    if (modules.includes('encounters')) {
      this.generateEncountersSection(data);
    }

    if (modules.includes('diagnoses')) {
      this.generateDiagnosesSection(data);
    }

    if (modules.includes('vitals')) {
      this.generateVitalsSection(data);
    }

    if (modules.includes('prescriptions')) {
      this.generatePrescriptionsSection(data);
    }

    if (modules.includes('laboratory')) {
      this.generateLaboratorySection(data);
    }

    if (modules.includes('radiology')) {
      this.generateRadiologySection(data);
    }

    if (modules.includes('procedures')) {
      this.generateProceduresSection(data);
    }

    if (modules.includes('admissions')) {
      this.generateAdmissionsSection(data);
    }

    if (modules.includes('billing')) {
      this.generateBillingSection(data);
    }

    if (modules.includes('nursing')) {
      this.generateNursingSection(data);
    }

    // Generate data integrity section if there are issues
    this.generateDataIntegritySection();

    // Generate authorization section
    this.generateAuthorizationSection(data);

    // Update all page numbers with "Page X of Y" format
    this.totalPages = this.doc.getNumberOfPages();

    for (let i = 1; i <= this.totalPages; i++) {
      this.doc.setPage(i);
      const { width, height } = this.getPageDimensions();

      // Skip cover page (page 1) - it has its own formatting
      if (i > 1) {
        // Add confidentiality header
        this.addConfidentialityHeader();

        // Add footer with metadata
        this.addPageFooter(this.patientEMR, this.exportedBy);
      }

      // Update page number to "Page X of Y"
      this.doc.setFontSize(FONTS.small);
      this.doc.setTextColor(...COLORS.muted);
      this.doc.setFont('helvetica', 'normal');

      if (i === 1) {
        // Cover page - page number at bottom
        this.doc.text(`Page 1 of ${this.totalPages}`, width / 2, height - 25, {
          align: 'center',
        });
      } else {
        // Content pages - page number in header (overwrite placeholder)
        this.doc.setFillColor(255, 255, 255);
        this.doc.rect(width - MARGINS.right - 30, 10, 30, 8, 'F');
        this.doc.text(
          `Page ${i} of ${this.totalPages}`,
          width - MARGINS.right,
          15,
          { align: 'right' },
        );
      }
    }

    return this.doc.output('blob');
  }

  /**
   * Generate and download PDF
   */
  public async download(
    data: PatientJourneyExport,
    filename?: string,
  ): Promise<void> {
    const blob = await this.generate(data);

    const defaultFilename = `${data.patient.emr_number}_Clinical_Export_${this.exportTimestamp.toISOString().split('T')[0]}.pdf`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}

// ==================== EXPORT FUNCTIONS ====================

/**
 * Generate clinical export PDF
 */
export async function generateClinicalExportPDF(
  data: PatientJourneyExport,
  options?: Partial<PDFExportOptions>,
): Promise<Blob> {
  const defaultOptions: PDFExportOptions = {
    orientation: 'portrait',
    pageSize: 'A4',
    includeHeader: true,
    includeFooter: true,
    includePageNumbers: true,
    includeTOC: false,
    includeCharts: false,
    includeCoverPage: true,
    confidentialityNotice: true,
    hospitalLogo: true,
    compressImages: true,
  };

  const exporter = new ClinicalPDFExporter({ ...defaultOptions, ...options });
  return exporter.generate(data);
}

/**
 * Download clinical export PDF
 */
export async function downloadClinicalExportPDF(
  data: PatientJourneyExport,
  options?: Partial<PDFExportOptions>,
  filename?: string,
): Promise<void> {
  const defaultOptions: PDFExportOptions = {
    orientation: 'portrait',
    pageSize: 'A4',
    includeHeader: true,
    includeFooter: true,
    includePageNumbers: true,
    includeTOC: false,
    includeCharts: false,
    includeCoverPage: true,
    confidentialityNotice: true,
    hospitalLogo: true,
    compressImages: true,
  };

  const exporter = new ClinicalPDFExporter({ ...defaultOptions, ...options });
  return exporter.download(data, filename);
}

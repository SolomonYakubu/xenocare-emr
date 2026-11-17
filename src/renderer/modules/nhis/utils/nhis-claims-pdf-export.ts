/**
 * NHIS Claims PDF Export Utility
 * XENOCARE EMR - NHIS Module
 *
 * Generates comprehensive, audit-ready PDF reports for NHIS claims
 * Including claim summary, patient breakdown, service details, and authorization mapping
 *
 * @version 1.0.0
 * @date January 27, 2026
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  NhisPendingClaimsSummary,
  NhisPendingClaimItem,
  NhisComprehensiveClaimsSummary,
  NhisComprehensiveClaimItem,
} from '../api/nhis.api';

// ===========================================================================
// COMPREHENSIVE NHIS CLAIMS PDF EXPORT
// With billing-style table, NDC branding, and full financial breakdown
// ===========================================================================

// ==================== CONSTANTS ====================

const COLORS = {
  primary: [22, 101, 52] as [number, number, number], // XenoCare navy (facility brand)
  secondary: [51, 65, 85] as [number, number, number], // Slate-700
  accent: [37, 99, 235] as [number, number, number], // Blue-600
  success: [22, 163, 74] as [number, number, number], // Green-600
  warning: [217, 119, 6] as [number, number, number], // Amber-600
  danger: [220, 38, 38] as [number, number, number], // Red-600
  light: [248, 250, 252] as [number, number, number], // Slate-50
  text: [17, 24, 39] as [number, number, number], // Gray-900
  muted: [100, 116, 139] as [number, number, number], // Slate-500
  tableHeader: [22, 101, 52] as [number, number, number], // XenoCare navy — primary tables
  tableAlt: [248, 250, 252] as [number, number, number], // Slate-50
};

const FONTS = {
  title: 18,
  subtitle: 14,
  sectionTitle: 12,
  body: 10,
  small: 9,
  tiny: 8,
};

const MARGINS = {
  left: 10,
  right: 10,
  top: 20,
  bottom: 25,
};

// ==================== HELPER FUNCTIONS ====================

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `NGN ${formatted}`;
}

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

function getServiceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    lab: 'Laboratory',
    radiology: 'Radiology',
    pharmacy: 'Pharmacy',
    procedure: 'Procedure',
    specialty: 'Specialty',
    consultation: 'Consultation',
  };
  return labels[type] || type;
}

function getServiceTypeColor(type: string): [number, number, number] {
  const colors: Record<string, [number, number, number]> = {
    lab: [41, 128, 185], // Blue
    radiology: [39, 174, 96], // Green
    pharmacy: [243, 156, 18], // Orange
    procedure: [192, 57, 43], // Red
    specialty: [142, 68, 173], // Purple
    consultation: [52, 73, 94], // Slate
  };
  return colors[type] || COLORS.text;
}

// ==================== PDF GENERATION ====================

export interface NhisClaimsPdfOptions {
  facilityName?: string;
  facilityAddress?: string;
  facilityNhisId?: string;
  reportPeriod?: { start: Date; end: Date };
  generatedBy?: string;
  includeProvisional?: boolean;
}

export async function generateNhisClaimsPdf(
  summary: NhisPendingClaimsSummary,
  options: NhisClaimsPdfOptions = {},
): Promise<Blob> {
  const {
    facilityName = 'XenoCare',
    facilityAddress = 'XenoCare',
    facilityNhisId = 'NHIS-NDC-001',
    generatedBy = 'System',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = MARGINS.top;

  // Helper to add new page if needed
  const checkPageBreak = (requiredSpace: number): void => {
    if (yPos + requiredSpace > pageHeight - MARGINS.bottom) {
      doc.addPage();
      yPos = MARGINS.top;
      addHeader();
    }
  };

  // Add header to each page
  const addHeader = (): void => {
    // NHIS Header Banner
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('NATIONAL HEALTH INSURANCE SCHEME', pageWidth / 2, 7, {
      align: 'center',
    });
    doc.setFont('helvetica', 'normal');
    doc.text('PENDING CLAIMS REPORT', pageWidth / 2, 10, { align: 'center' });
  };

  // Add footer to each page
  const addFooter = (): void => {
    const footerY = pageHeight - 8;
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${facilityName}  \u2022  NHIS ID: ${facilityNhisId}  \u2022  Page ${doc.getCurrentPageInfo().pageNumber}`,
      pageWidth / 2,
      footerY,
      { align: 'center' },
    );
  };

  // Add header to first page
  addHeader();
  yPos = 18;

  // ==================== FACILITY INFORMATION ====================
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(FONTS.title);
  doc.setFont('helvetica', 'bold');
  doc.text(facilityName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(facilityAddress, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // ==================== REPORT TITLE ====================
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(
    MARGINS.left,
    yPos,
    pageWidth - MARGINS.left - MARGINS.right,
    12,
    2,
    2,
    'F',
  );

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(FONTS.subtitle);
  doc.setFont('helvetica', 'bold');
  doc.text('NHIS PENDING CLAIMS SUMMARY', pageWidth / 2, yPos + 8, {
    align: 'center',
  });
  yPos += 18;

  // ==================== EXECUTIVE SUMMARY ====================
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(FONTS.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', MARGINS.left, yPos);
  yPos += 6;

  // Summary stats box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(
    MARGINS.left,
    yPos,
    pageWidth - MARGINS.left - MARGINS.right,
    28,
    2,
    2,
    'F',
  );
  doc.setDrawColor(...COLORS.purple);
  doc.roundedRect(
    MARGINS.left,
    yPos,
    pageWidth - MARGINS.left - MARGINS.right,
    28,
    2,
    2,
    'S',
  );

  const boxY = yPos + 5;
  const colWidth = (pageWidth - MARGINS.left - MARGINS.right) / 3;

  // Total Claims Amount
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text('Total Pending Claims Value', MARGINS.left + colWidth / 2, boxY, {
    align: 'center',
  });
  doc.setFontSize(FONTS.subtitle);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.success);
  doc.text(
    formatCurrency(summary.total_amount),
    MARGINS.left + colWidth / 2,
    boxY + 8,
    { align: 'center' },
  );

  // Total Items
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(
    'Total Services Approved',
    MARGINS.left + colWidth + colWidth / 2,
    boxY,
    { align: 'center' },
  );
  doc.setFontSize(FONTS.subtitle);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text(
    summary.total_items.toString(),
    MARGINS.left + colWidth + colWidth / 2,
    boxY + 8,
    { align: 'center' },
  );

  // Report Date
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(
    'Report Generated',
    MARGINS.left + 2 * colWidth + colWidth / 2,
    boxY,
    { align: 'center' },
  );
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.text);
  doc.text(
    formatDate(new Date().toISOString()),
    MARGINS.left + 2 * colWidth + colWidth / 2,
    boxY + 8,
    { align: 'center' },
  );

  // Category breakdown text
  doc.setFontSize(FONTS.tiny);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  const breakdownText = `Lab: ${summary.by_category.lab.count} | Radiology: ${summary.by_category.radiology.count} | Pharmacy: ${summary.by_category.pharmacy.count} | Procedures: ${summary.by_category.procedure.count} | Specialty: ${summary.by_category.specialty.count} | Physiotherapy: ${summary.by_category.physiotherapy?.count || 0} | Consultation: ${summary.by_category.consultation?.count || 0} | Admission: ${summary.by_category.admission?.count || 0}`;
  doc.text(breakdownText, pageWidth / 2, boxY + 18, { align: 'center' });

  yPos += 34;

  // ==================== CATEGORY BREAKDOWN TABLE ====================
  checkPageBreak(40);
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(FONTS.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('Claims by Service Category', MARGINS.left, yPos);
  yPos += 4;

  const categoryData = [
    [
      'Laboratory',
      summary.by_category.lab.count.toString(),
      formatCurrency(summary.by_category.lab.amount),
    ],
    [
      'Radiology',
      summary.by_category.radiology.count.toString(),
      formatCurrency(summary.by_category.radiology.amount),
    ],
    [
      'Pharmacy',
      summary.by_category.pharmacy.count.toString(),
      formatCurrency(summary.by_category.pharmacy.amount),
    ],
    [
      'Procedures',
      summary.by_category.procedure.count.toString(),
      formatCurrency(summary.by_category.procedure.amount),
    ],
    [
      'Specialty Referrals',
      summary.by_category.specialty.count.toString(),
      formatCurrency(summary.by_category.specialty.amount),
    ],
    [
      'Physiotherapy',
      (summary.by_category.physiotherapy?.count || 0).toString(),
      formatCurrency(summary.by_category.physiotherapy?.amount || 0),
    ],
    [
      'Consultations',
      (summary.by_category.consultation?.count || 0).toString(),
      formatCurrency(summary.by_category.consultation?.amount || 0),
    ],
    [
      'Admissions/Inpatient',
      (summary.by_category.admission?.count || 0).toString(),
      formatCurrency(summary.by_category.admission?.amount || 0),
    ],
    [
      'TOTAL',
      summary.total_items.toString(),
      formatCurrency(summary.total_amount),
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Service Category', 'Count', 'Amount (NGN)']],
    body: categoryData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: {
      fontSize: FONTS.small,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: COLORS.tableAlt,
    },
    willDrawCell: (data) => {
      // Highlight total row
      if (data.row.index === categoryData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 250];
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ==================== DETAILED CLAIMS LIST ====================
  if (summary.items.length > 0) {
    checkPageBreak(30);
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(FONTS.sectionTitle);
    doc.setFont('helvetica', 'bold');
    doc.text('Detailed Pending Claims', MARGINS.left, yPos);
    yPos += 4;

    // Group items by patient for better readability
    const itemsByPatient = summary.items.reduce(
      (acc, item) => {
        const key = item.patient_id;
        if (!acc[key]) {
          acc[key] = {
            patient_name: item.patient_name,
            emr_number: item.emr_number,
            items: [],
            total: 0,
          };
        }
        acc[key].items.push(item);
        acc[key].total += item.amount;
        return acc;
      },
      {} as Record<
        string,
        {
          patient_name: string;
          emr_number: string;
          items: NhisPendingClaimItem[];
          total: number;
        }
      >,
    );

    const detailedData = summary.items.map((item) => [
      item.emr_number || '—',
      item.patient_name || '—',
      getServiceTypeLabel(item.service_type),
      item.service_name.length > 25
        ? `${item.service_name.substring(0, 22)}...`
        : item.service_name,
      item.authorization_code || 'Pending',
      formatDate(item.service_date),
      formatCurrency(item.amount),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [
        [
          'EMR #',
          'Patient Name',
          'Category',
          'Service',
          'Auth Code',
          'Date',
          'Amount',
        ],
      ],
      body: detailedData,
      margin: { left: MARGINS.left, right: MARGINS.right },
      styles: {
        fontSize: FONTS.tiny,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: COLORS.tableHeader,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: COLORS.tableAlt,
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 35 },
        2: { cellWidth: 22 },
        3: { cellWidth: 30 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 25, halign: 'right' },
      },
      didDrawPage: () => {
        addHeader();
        addFooter();
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ==================== PATIENT SUMMARY ====================
  if (summary.items.length > 0) {
    checkPageBreak(30);
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(FONTS.sectionTitle);
    doc.setFont('helvetica', 'bold');
    doc.text('Claims by Patient', MARGINS.left, yPos);
    yPos += 4;

    // Aggregate by patient
    const patientSummary = summary.items.reduce(
      (acc, item) => {
        const key = item.patient_id;
        if (!acc[key]) {
          acc[key] = {
            emr_number: item.emr_number,
            patient_name: item.patient_name,
            services: 0,
            total: 0,
          };
        }
        acc[key].services++;
        acc[key].total += item.amount;
        return acc;
      },
      {} as Record<
        string,
        {
          emr_number: string;
          patient_name: string;
          services: number;
          total: number;
        }
      >,
    );

    const patientData = Object.values(patientSummary)
      .sort((a, b) => b.total - a.total)
      .map((p) => [
        p.emr_number,
        p.patient_name,
        p.services.toString(),
        formatCurrency(p.total),
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [['EMR #', 'Patient Name', 'Services', 'Total Amount']],
      body: patientData,
      margin: { left: MARGINS.left, right: MARGINS.right },
      styles: {
        fontSize: FONTS.small,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: COLORS.accent,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: COLORS.tableAlt,
      },
      columnStyles: {
        3: { halign: 'right' },
      },
      didDrawPage: () => {
        addHeader();
        addFooter();
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ==================== AUTHORIZATION SUMMARY ====================
  checkPageBreak(40);
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(FONTS.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorization Status Summary', MARGINS.left, yPos);
  yPos += 6;

  const authorizedItems = summary.items.filter((i) => i.authorization_code);
  const pendingAuthItems = summary.items.filter((i) => !i.authorization_code);

  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text(
    `Services with Authorization Code: ${authorizedItems.length}`,
    MARGINS.left + 5,
    yPos,
  );
  yPos += 5;
  doc.text(
    `Services Pending Authorization Code: ${pendingAuthItems.length}`,
    MARGINS.left + 5,
    yPos,
  );
  yPos += 10;

  // ==================== CERTIFICATION SECTION ====================
  checkPageBreak(50);
  doc.setDrawColor(...COLORS.muted);
  doc.line(MARGINS.left, yPos, pageWidth - MARGINS.right, yPos);
  yPos += 8;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(FONTS.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('Certification', MARGINS.left, yPos);
  yPos += 8;

  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'I hereby certify that the above services were rendered to the listed NHIS beneficiaries',
    MARGINS.left,
    yPos,
  );
  yPos += 5;
  doc.text(
    'and the claims are accurate and submitted in accordance with NHIS guidelines.',
    MARGINS.left,
    yPos,
  );
  yPos += 15;

  // Signature lines
  const sigWidth = (pageWidth - MARGINS.left - MARGINS.right - 20) / 2;

  // Left signature
  doc.line(MARGINS.left, yPos, MARGINS.left + sigWidth, yPos);
  yPos += 5;
  doc.setFontSize(FONTS.small);
  doc.text('NHIS Desk Officer', MARGINS.left, yPos);
  doc.text('Date: ____________________', MARGINS.left, yPos + 5);

  // Right signature
  const rightX = MARGINS.left + sigWidth + 20;
  doc.line(rightX, yPos - 5, rightX + sigWidth, yPos - 5);
  doc.text('Medical Director / Authorized Signatory', rightX, yPos);
  doc.text('Date: ____________________', rightX, yPos + 5);

  yPos += 20;

  // Official stamp placeholder
  doc.setDrawColor(...COLORS.muted);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(pageWidth - MARGINS.right - 40, yPos - 15, 35, 25);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(FONTS.tiny);
  doc.setTextColor(...COLORS.muted);
  doc.text('Official Stamp', pageWidth - MARGINS.right - 22.5, yPos + 2, {
    align: 'center',
  });

  // Add footer to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter();
  }

  return doc.output('blob');
}

/**
 * Download the PDF report
 */
export async function downloadNhisClaimsPdf(
  summary: NhisPendingClaimsSummary,
  options?: NhisClaimsPdfOptions,
): Promise<void> {
  const blob = await generateNhisClaimsPdf(summary, options);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `NHIS_Claims_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface NhisComprehensiveClaimsPdfOptions {
  facilityName?: string;
  facilityAddress?: string;
  facilityNhisId?: string;
  reportPeriod?: { start: string; end: string };
  generatedBy?: string;
  filters?: {
    insuranceType?: string;
    category?: string;
    hasAuthCode?: boolean;
  };
  /**
   * Report format:
   * - 'standard': Lists all claims grouped by Auth Code status
   * - 'patient_breakdown': Detailed table per patient
   */
  format?: 'standard' | 'patient_breakdown';
}

/**
 * Generate comprehensive NHIS claims PDF with billing-style table
 * Includes S/N, Patient, Insurance Type, Category, Service, Auth Code, Coverage %, NHIS Amount, Patient Amount
 */
export async function generateComprehensiveNhisClaimsPdf(
  data: NhisComprehensiveClaimsSummary,
  options: NhisComprehensiveClaimsPdfOptions = {},
): Promise<Blob> {
  const {
    facilityName = 'XenoCare',
    facilityAddress = 'XenoCare',
    facilityNhisId = 'NHIS-NDC-001',
    generatedBy = 'System',
    reportPeriod,
    filters,
    format = 'patient_breakdown',
  } = options;

  const doc = new jsPDF({
    orientation: 'landscape', // Landscape for wide table
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = MARGINS.top;

  // XenoCare navy color
  const NDC_GREEN: [number, number, number] = [22, 101, 52];
  const NDC_GREEN_LIGHT: [number, number, number] = [240, 253, 244];

  // Add header to each page
  const addHeader = (): void => {
    // XenoCare navy Header Banner
    doc.setFillColor(...NDC_GREEN);
    doc.rect(0, 0, pageWidth, 14, 'F');
    // Centered facility name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(facilityName.toUpperCase(), pageWidth / 2, 6, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('NHIS CLAIMS REPORT', pageWidth / 2, 11, { align: 'center' });

    // Right side: Report date
    doc.setFontSize(8);
    doc.text(
      `Report Date: ${formatDate(new Date().toISOString())}`,
      pageWidth - MARGINS.right,
      8,
      { align: 'right' },
    );
    if (reportPeriod) {
      doc.text(
        `Period: ${formatDate(reportPeriod.start)} - ${formatDate(reportPeriod.end)}`,
        pageWidth - MARGINS.right,
        13,
        { align: 'right' },
      );
    }
  };

  // Add footer to each page
  const addFooter = (): void => {
    const footerY = pageHeight - 8;
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${facilityName}  \u2022  NHIS ID: ${facilityNhisId}  \u2022  Page ${doc.getCurrentPageInfo().pageNumber}`,
      pageWidth / 2,
      footerY,
      { align: 'center' },
    );
  };

  // Add first page header
  addHeader();
  yPos = 20;

  // ==================== REPORT METADATA ====================
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${formatDateTime(new Date().toISOString())}  |  By: ${generatedBy}  |  Format: ${format === 'patient_breakdown' ? 'Patient Breakdown' : 'Summary'}`,
    MARGINS.left,
    yPos,
  );
  yPos += 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(MARGINS.left, yPos, pageWidth - MARGINS.right, yPos);
  yPos += 6;

  // ==================== EXECUTIVE SUMMARY STATS ====================
  const statsBoxWidth = (pageWidth - MARGINS.left - MARGINS.right - 15) / 4;
  const statsY = yPos;

  // Stat box helper
  const drawStatBox = (
    x: number,
    label: string,
    value: string,
    color: [number, number, number],
    subLabel?: string,
  ) => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, statsY, statsBoxWidth, 18, 2, 2, 'F');
    doc.setDrawColor(...color);
    doc.roundedRect(x, statsY, statsBoxWidth, 18, 2, 2, 'S');

    doc.setFontSize(FONTS.tiny);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + statsBoxWidth / 2, statsY + 5, { align: 'center' });

    doc.setFontSize(FONTS.sectionTitle);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + statsBoxWidth / 2, statsY + 12, { align: 'center' });

    if (subLabel) {
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.muted);
      doc.setFont('helvetica', 'normal');
      doc.text(subLabel, x + statsBoxWidth / 2, statsY + 16, {
        align: 'center',
      });
    }
  };

  drawStatBox(
    MARGINS.left,
    'Total Claims',
    data.totalItems.toString(),
    COLORS.primary,
    `${data.itemsWithAuthCode.length} with auth codes`,
  );
  drawStatBox(
    MARGINS.left + statsBoxWidth + 5,
    'Total Amount',
    formatCurrency(data.totalAmount),
    COLORS.secondary,
  );
  drawStatBox(
    MARGINS.left + (statsBoxWidth + 5) * 2,
    'NHIS Covers',
    formatCurrency(data.totalNhisCovered),
    COLORS.success,
    `${Math.round((data.totalNhisCovered / Math.max(data.totalAmount, 1)) * 100)}% coverage`,
  );
  drawStatBox(
    MARGINS.left + (statsBoxWidth + 5) * 3,
    'Patient Pays',
    formatCurrency(data.totalPatientPortion),
    COLORS.warning,
  );

  yPos += 24;

  // Verified vs Pending NHIS totals
  doc.setFontSize(FONTS.tiny);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `Verified NHIS: ${formatCurrency(data.totalVerifiedNhis)} | Pending NHIS: ${formatCurrency(data.totalPendingNhis)}`,
    pageWidth / 2,
    yPos,
    { align: 'center' },
  );
  yPos += 6;

  // ==================== INSURANCE TYPE BREAKDOWN ====================
  if (data.byInsuranceType.length > 0) {
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.text('Claims by Insurance Type:', MARGINS.left, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [['Insurance Type', 'Count', 'Total Amount', 'NHIS Covered']],
      body: data.byInsuranceType.map((ins) => [
        ins.insuranceType,
        ins.count.toString(),
        formatCurrency(ins.totalAmount),
        formatCurrency(ins.nhisCovered),
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: NDC_GREEN,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: MARGINS.left, right: MARGINS.right },
      tableWidth: 'wrap',
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==================== CATEGORY BREAKDOWN ====================
  if (data.byCategory.length > 0) {
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(FONTS.body);
    doc.setFont('helvetica', 'bold');
    doc.text('Claims by Category:', MARGINS.left, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [
        ['Category', 'Count', 'Total Amount', 'NHIS Covered', 'Patient Pays'],
      ],
      body: data.byCategory.map((cat) => [
        cat.categoryLabel,
        cat.count.toString(),
        formatCurrency(cat.totalAmount),
        formatCurrency(cat.nhisCovered),
        formatCurrency(cat.patientPortion),
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: NDC_GREEN,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: MARGINS.left, right: MARGINS.right },
      tableWidth: 'wrap',
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ==================== REPORT BODY (Conditional) ====================

  if (format === 'patient_breakdown') {
    // ==================== PATIENT DETAILED BREAKDOWN ====================
    // Group all items by patient
    const patientGroups: Record<
      string,
      {
        patientName: string;
        emrNumber: string;
        hmoName: string;
        insuranceType: string;
        dateOfBirth: string | null;
        icdCode: string | null;
        diagnosis: string | null;
        authStatus: string;
        nhisNumber: string | null;
        items: NhisComprehensiveClaimItem[];
      }
    > = {};

    data.allItems.forEach((item) => {
      // Robust key generation
      const key = item.patientId || item.patientName || 'Unknown';
      if (!patientGroups[key]) {
        patientGroups[key] = {
          patientName: item.patientName || 'Unknown Patient',
          emrNumber: item.emrNumber || '—',
          hmoName: item.payerName || item.hmoName || '—',
          insuranceType: item.insuranceType || '—',
          dateOfBirth: item.dateOfBirth || null,
          icdCode: item.icdCode || null,
          diagnosis: item.diagnosis || null,
          authStatus: item.authorizationStatus || '—',
          nhisNumber: item.nhisNumber || '—',
          items: [],
        };
      }
      patientGroups[key].items.push(item);
    });

    // Sort groups by patient name
    const sortedPatientKeys = Object.keys(patientGroups).sort((a, b) =>
      patientGroups[a].patientName.localeCompare(patientGroups[b].patientName),
    );

    // New page for detailed breakdown
    doc.addPage();
    addHeader();
    yPos = 30;

    doc.setFillColor(...NDC_GREEN);
    doc.roundedRect(
      MARGINS.left,
      yPos,
      pageWidth - MARGINS.left - MARGINS.right,
      10,
      2,
      2,
      'F',
    );
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(FONTS.subtitle);
    doc.setFont('helvetica', 'bold');
    doc.text('DETAILED CLAIMS BREAKDOWN BY PATIENT', pageWidth / 2, yPos + 7, {
      align: 'center',
    });
    yPos += 18;

    // Iterate through patients
    sortedPatientKeys.forEach((key, index) => {
      const group = patientGroups[key];

      // Check page break for header (need ~28pt for header + info block)
      if (yPos > pageHeight - 65) {
        doc.addPage();
        addHeader();
        yPos = 30;
      }

      // Patient Header Strip
      doc.setFillColor(...NDC_GREEN_LIGHT);
      doc.roundedRect(
        MARGINS.left,
        yPos,
        pageWidth - MARGINS.left - MARGINS.right,
        7,
        1,
        1,
        'F',
      );
      doc.setFontSize(FONTS.body);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NDC_GREEN);

      const headerText = `${index + 1}. ${group.patientName} (${group.emrNumber})`;
      doc.text(headerText, MARGINS.left + 5, yPos + 5);

      yPos += 9;

      // ── Patient Details Info Block ──
      // Compute age from DOB
      let ageStr = '—';
      if (group.dateOfBirth) {
        const dob = new Date(group.dateOfBirth);
        const now = new Date();
        let age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
        ageStr = `${age} yrs (${formatDate(group.dateOfBirth)})`;
      }

      // Collect unique auth statuses and ICD codes from all items
      const uniqueAuthStatuses = [
        ...new Set(
          group.items.map((i) => i.authorizationStatus).filter(Boolean),
        ),
      ];
      const uniqueIcdCodes = [
        ...new Set(group.items.map((i) => i.icdCode).filter(Boolean)),
      ];

      const infoBoxY = yPos;
      const infoBoxWidth = pageWidth - MARGINS.left - MARGINS.right;
      const infoBoxHeight = 20;

      // Light background for the info block
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(
        MARGINS.left,
        infoBoxY,
        infoBoxWidth,
        infoBoxHeight,
        1,
        1,
        'F',
      );
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(
        MARGINS.left,
        infoBoxY,
        infoBoxWidth,
        infoBoxHeight,
        1,
        1,
        'S',
      );

      const infoX = MARGINS.left + 4;
      const infoY1 = infoBoxY + 6;
      const infoY2 = infoBoxY + 14;

      doc.setFontSize(8);

      // Row 1: Ins. Type | Payer/HMO | DOB/Age | NHIS#
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('Ins. Type:', infoX, infoY1);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);
      doc.text(group.insuranceType, infoX + 20, infoY1);

      const col2X = infoX + 60;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Payer/HMO:', col2X, infoY1);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);
      doc.text(truncateText(group.hmoName, 25), col2X + 22, infoY1);

      const col3X = col2X + 65;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('DOB/Age:', col3X, infoY1);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);
      doc.text(ageStr, col3X + 18, infoY1);

      const col4X = col3X + 60;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('NHIS#:', col4X, infoY1);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);
      doc.text(group.nhisNumber || '—', col4X + 14, infoY1);

      // Row 2: ICD-10 | Diagnosis | Auth Status
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('ICD-10:', infoX, infoY2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);
      doc.text(
        uniqueIcdCodes.length > 0 ? uniqueIcdCodes.join(', ') : '—',
        infoX + 16,
        infoY2,
      );

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Diagnosis:', col2X, infoY2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);
      doc.text(truncateText(group.diagnosis || '—', 40), col2X + 20, infoY2);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Auth Status:', col3X, infoY2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);
      doc.text(
        uniqueAuthStatuses.length > 0 ? uniqueAuthStatuses.join(', ') : '—',
        col3X + 24,
        infoY2,
      );

      yPos = infoBoxY + infoBoxHeight + 3;

      // Claims Table
      autoTable(doc, {
        startY: yPos,
        head: [
          [
            'Date',
            'Category',
            'Service Item',
            'Qty',
            'Inv #',
            'Rcpt #',
            'Auth Code',
            'Total',
            'NHIS Pay',
            'Pt Pay',
          ],
        ],
        body: group.items.map((item) => [
          formatDate(item.serviceDate),
          item.categoryLabel || item.category,
          item.serviceName || '—',
          item.quantity.toString(),
          item.invoiceNumber || '—',
          item.receiptNumber || '—',
          (item.authorizationCode && /[0-9a-f]{8}-[0-9a-f]{4}/i.test(item.authorizationCode)) ? '—' : (item.authorizationCode || '—'),
          formatCurrency(item.totalAmount).replace('NGN ', ''),
          formatCurrency(item.nhisAmount).replace('NGN ', ''),
          formatCurrency(item.patientAmount).replace('NGN ', ''),
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: COLORS.secondary,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: 'ellipsize',
        },
        columnStyles: {
          0: { cellWidth: 18 }, // Date
          1: { cellWidth: 20 }, // Cat
          2: { cellWidth: 'auto' }, // Service (flexible)
          3: { cellWidth: 8, halign: 'center' }, // Qty
          4: { cellWidth: 22 }, // Inv
          5: { cellWidth: 22 }, // Rcpt
          6: { cellWidth: 22 }, // Auth
          7: { cellWidth: 20, halign: 'right' }, // Total
          8: { cellWidth: 20, halign: 'right' }, // NHIS
          9: { cellWidth: 20, halign: 'right' }, // Pt
        },
        alternateRowStyles: { fillColor: COLORS.tableAlt },
        margin: { left: MARGINS.left, right: MARGINS.right },
        tableWidth: 'auto',
      });

      yPos = (doc as any).lastAutoTable.finalY + 2;

      // Patient Subtotal Line
      const totalService = group.items.reduce(
        (sum, i) => sum + i.totalAmount,
        0,
      );
      const totalNhis = group.items.reduce((sum, i) => sum + i.nhisAmount, 0);
      const totalPt = group.items.reduce((sum, i) => sum + i.patientAmount, 0);

      // Ensure we have space for the subtotal line
      if (yPos > pageHeight - 15) {
        doc.addPage();
        addHeader();
        yPos = 30;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.text);

      // Right aligned totals text
      const text = `Patient Total:  Service: ${formatCurrency(totalService)}   |   NHIS: ${formatCurrency(totalNhis)}   |   Patient: ${formatCurrency(totalPt)}`;
      doc.text(text, pageWidth - MARGINS.right, yPos + 3, { align: 'right' });

      yPos += 10; // Space after patient block
    });
  } else {
    // ==================== STANDARD / AUTH STATUS VIEW ====================
    // ==================== CLAIMS WITH AUTHORIZATION CODES ====================
    if (data.itemsWithAuthCode.length > 0) {
      // New page for detailed claims
      doc.addPage();
      addHeader();
      yPos = 25;

      doc.setFillColor(...COLORS.success);
      doc.roundedRect(
        MARGINS.left,
        yPos,
        pageWidth - MARGINS.left - MARGINS.right,
        8,
        1,
        1,
        'F',
      );
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(FONTS.body);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `CLAIMS WITH AUTHORIZATION CODES (${data.itemsWithAuthCode.length} items)`,
        MARGINS.left + 5,
        yPos + 5.5,
      );
      yPos += 12;

      autoTable(doc, {
        startY: yPos,
        head: [
          [
            'S/N',
            'Date',
            'Patient',
            'Category',
            'Service',
            'Qty',
            'Total',
            'NHIS%',
            'NHIS Payable',
            'Patient Paid',
            'Auth Code',
            'Invoice',
            'Receipt',
            'Referral',
          ],
        ],
        body: data.itemsWithAuthCode.map((item, idx) => [
          (idx + 1).toString(),
          formatDate(item.serviceDate),
          item.patientName || '—',
          item.categoryLabel || getCategoryLabelForPdf(item.category),
          item.serviceName || '—',
          item.quantity.toString(),
          formatCurrency(item.totalAmount),
          `${item.coveragePercentage}%`,
          formatCurrency(item.nhisAmount),
          formatCurrency(item.patientAmount),
          (item.authorizationCode && /[0-9a-f]{8}-[0-9a-f]{4}/i.test(item.authorizationCode)) ? '—' : (item.authorizationCode || '—'),
          item.invoiceNumber || '—',
          item.receiptNumber || '—',
          item.isReferral ? item.referralType || 'Yes' : '—',
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: NDC_GREEN,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 2,
        },
        bodyStyles: { fontSize: 7, cellPadding: 2, overflow: 'ellipsize' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: MARGINS.left, right: MARGINS.right },
        columnStyles: {
          0: { cellWidth: 8 }, // S/N
          1: { cellWidth: 16 }, // Date
          2: { cellWidth: 22 }, // Patient
          3: { cellWidth: 16 }, // Category
          4: { cellWidth: 'auto' }, // Service (flexible)
          5: { cellWidth: 8, halign: 'center' }, // Qty
          6: { cellWidth: 20, halign: 'right' }, // Total
          7: { cellWidth: 10, halign: 'center' }, // NHIS%
          8: { cellWidth: 20, halign: 'right' }, // NHIS Payable
          9: { cellWidth: 20, halign: 'right' }, // Patient Paid
          10: { cellWidth: 20 }, // Auth Code
          11: { cellWidth: 18 }, // Invoice
          12: { cellWidth: 18 }, // Receipt
          13: { cellWidth: 14 }, // Referral
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;

      // Subtotal for authorized claims
      const authTotal = data.itemsWithAuthCode.reduce(
        (sum, i) => sum + i.nhisAmount,
        0,
      );
      const authPatientTotal = data.itemsWithAuthCode.reduce(
        (sum, i) => sum + i.patientAmount,
        0,
      );
      const authServiceTotal = data.itemsWithAuthCode.reduce(
        (sum, i) => sum + i.totalAmount,
        0,
      );
      doc.setFillColor(...NDC_GREEN_LIGHT);
      doc.rect(
        MARGINS.left,
        yPos,
        pageWidth - MARGINS.left - MARGINS.right,
        10,
        'F',
      );
      doc.setTextColor(...NDC_GREEN);
      doc.setFontSize(FONTS.small);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Subtotal: Service Cost: ${formatCurrency(authServiceTotal)} | Patient Paid: ${formatCurrency(authPatientTotal)} | NHIS Payable: ${formatCurrency(authTotal)}`,
        pageWidth / 2,
        yPos + 6.5,
        { align: 'center' },
      );
    }

    // ==================== CLAIMS WITHOUT AUTHORIZATION CODES ====================
    if (data.itemsWithoutAuthCode.length > 0) {
      doc.addPage();
      addHeader();
      yPos = 25;

      doc.setFillColor(...COLORS.warning);
      doc.roundedRect(
        MARGINS.left,
        yPos,
        pageWidth - MARGINS.left - MARGINS.right,
        8,
        1,
        1,
        'F',
      );
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(FONTS.body);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `CLAIMS PENDING AUTHORIZATION CODES (${data.itemsWithoutAuthCode.length} items)`,
        MARGINS.left + 5,
        yPos + 5.5,
      );
      yPos += 12;

      autoTable(doc, {
        startY: yPos,
        head: [
          [
            'S/N',
            'Date',
            'Patient',
            'Category',
            'Service',
            'Qty',
            'Total',
            'NHIS%',
            'NHIS Payable',
            'Patient Paid',
            'Invoice',
            'Receipt',
            'Referral',
          ],
        ],
        body: data.itemsWithoutAuthCode.map((item, idx) => [
          (idx + 1).toString(),
          formatDate(item.serviceDate),
          item.patientName || '—',
          item.categoryLabel || getCategoryLabelForPdf(item.category),
          item.serviceName || '—',
          item.quantity.toString(),
          formatCurrency(item.totalAmount),
          `${item.coveragePercentage}%`,
          formatCurrency(item.nhisAmount),
          formatCurrency(item.patientAmount),
          item.invoiceNumber || '—',
          item.receiptNumber || '—',
          item.isReferral ? item.referralType || 'Yes' : '—',
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [180, 83, 9],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: 2,
        },
        bodyStyles: { fontSize: 7, cellPadding: 2, overflow: 'ellipsize' },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        margin: { left: MARGINS.left, right: MARGINS.right },
        columnStyles: {
          0: { cellWidth: 8 }, // S/N
          1: { cellWidth: 16 }, // Date
          2: { cellWidth: 22 }, // Patient
          3: { cellWidth: 18 }, // Category
          4: { cellWidth: 'auto' }, // Service (flexible)
          5: { cellWidth: 8, halign: 'center' }, // Qty
          6: { cellWidth: 20, halign: 'right' }, // Total
          7: { cellWidth: 10, halign: 'center' }, // NHIS%
          8: { cellWidth: 20, halign: 'right' }, // NHIS Payable
          9: { cellWidth: 20, halign: 'right' }, // Patient Paid
          10: { cellWidth: 18 }, // Invoice
          11: { cellWidth: 18 }, // Receipt
          12: { cellWidth: 14 }, // Referral
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;

      // Subtotal for pending claims
      const pendingTotal = data.itemsWithoutAuthCode.reduce(
        (sum, i) => sum + i.nhisAmount,
        0,
      );
      const pendingPatientTotal = data.itemsWithoutAuthCode.reduce(
        (sum, i) => sum + i.patientAmount,
        0,
      );
      const pendingServiceTotal = data.itemsWithoutAuthCode.reduce(
        (sum, i) => sum + i.totalAmount,
        0,
      );
      doc.setFillColor(255, 251, 235);
      doc.rect(
        MARGINS.left,
        yPos,
        pageWidth - MARGINS.left - MARGINS.right,
        10,
        'F',
      );
      doc.setTextColor(...COLORS.warning);
      doc.setFontSize(FONTS.small);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Subtotal: Service Cost: ${formatCurrency(pendingServiceTotal)} | Patient Paid: ${formatCurrency(pendingPatientTotal)} | NHIS Payable: ${formatCurrency(pendingTotal)}`,
        pageWidth / 2,
        yPos + 6.5,
        { align: 'center' },
      );
    }
  }

  // ==================== GRAND TOTAL ====================
  doc.addPage();
  addHeader();
  yPos = 25;

  doc.setFillColor(...NDC_GREEN);
  doc.roundedRect(
    MARGINS.left,
    yPos,
    pageWidth - MARGINS.left - MARGINS.right,
    30,
    3,
    3,
    'F',
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(FONTS.subtitle);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL NHIS CLAIMS', pageWidth / 2, yPos + 10, {
    align: 'center',
  });

  doc.setFontSize(18);
  doc.text(formatCurrency(data.totalNhisCovered), pageWidth / 2, yPos + 22, {
    align: 'center',
  });

  yPos += 40;

  // Summary table
  autoTable(doc, {
    startY: yPos,
    head: [['Description', 'Amount']],
    body: [
      ['Total Service Value', formatCurrency(data.totalAmount)],
      ['Total NHIS Coverage', formatCurrency(data.totalNhisCovered)],
      ['Total Patient Portion', formatCurrency(data.totalPatientPortion)],
      ['Verified NHIS Payments', formatCurrency(data.totalVerifiedNhis)],
      ['Pending NHIS Payments', formatCurrency(data.totalPendingNhis)],
      [
        'Claims with Authorization Codes',
        data.itemsWithAuthCode.length.toString(),
      ],
      [
        'Claims Pending Authorization',
        data.itemsWithoutAuthCode.length.toString(),
      ],
      ['Total Claims', data.totalItems.toString()],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: NDC_GREEN,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 150 },
      1: { cellWidth: 80, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: MARGINS.left + 30, right: MARGINS.right + 30 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 20;

  // ==================== AUDIT TRAIL LEGEND ====================
  doc.setDrawColor(...COLORS.muted);
  doc.line(MARGINS.left, yPos, pageWidth - MARGINS.right, yPos);
  yPos += 10;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(FONTS.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('Audit Trail & Timestamp Legend', MARGINS.left, yPos);
  yPos += 8;

  // Create audit trail table
  autoTable(doc, {
    startY: yPos,
    head: [['Timestamp Field', 'Description', 'Format']],
    body: [
      [
        'created_at',
        'When the claim was initially created in the system',
        'YYYY-MM-DD HH:MM:SS',
      ],
      ['updated_at', 'When the claim was last modified', 'YYYY-MM-DD HH:MM:SS'],
      [
        'submitted_at',
        'When the claim was submitted to NHIS for processing',
        'YYYY-MM-DD HH:MM:SS',
      ],
      [
        'processed_at',
        'When the claim was fully processed by NHIS desk',
        'YYYY-MM-DD HH:MM:SS',
      ],
      [
        'approved_at',
        'When the claim was authorized/approved',
        'YYYY-MM-DD HH:MM:SS',
      ],
      [
        'rejected_at',
        'When the claim was rejected (if applicable)',
        'YYYY-MM-DD HH:MM:SS',
      ],
      ['paid_at', 'When payment was received/recorded', 'YYYY-MM-DD HH:MM:SS'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.secondary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 120 },
      2: { cellWidth: 50, halign: 'center' },
    },
    margin: { left: MARGINS.left, right: MARGINS.right },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // ==================== AUTHORIZATION CODE POLICY ====================
  doc.setFillColor(252, 248, 227);
  doc.roundedRect(
    MARGINS.left,
    yPos,
    pageWidth - MARGINS.left - MARGINS.right,
    22,
    2,
    2,
    'F',
  );
  doc.setDrawColor(...COLORS.warning);
  doc.roundedRect(
    MARGINS.left,
    yPos,
    pageWidth - MARGINS.left - MARGINS.right,
    22,
    2,
    2,
    'S',
  );

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorization Code Policy', MARGINS.left + 5, yPos + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONTS.tiny);
  doc.text(
    '• Authorization codes are displayed when available and verified.',
    MARGINS.left + 5,
    yPos + 12,
  );
  doc.text(
    '• When no authorization code exists (nil), the field displays "—" (em dash) to indicate absence.',
    MARGINS.left + 5,
    yPos + 17,
  );
  doc.text(
    '• FFS claims cannot be marked "Paid" without a valid authorization code (NHIA rule).',
    MARGINS.left + 140,
    yPos + 12,
  );
  doc.text(
    '• Pending authorization table excludes already-paid claims.',
    MARGINS.left + 140,
    yPos + 17,
  );

  yPos += 28;

  // ==================== CERTIFICATION SECTION ====================
  doc.setDrawColor(...COLORS.muted);
  doc.line(MARGINS.left, yPos, pageWidth - MARGINS.right, yPos);
  yPos += 10;

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(FONTS.sectionTitle);
  doc.setFont('helvetica', 'bold');
  doc.text('Certification', MARGINS.left, yPos);
  yPos += 8;

  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'I hereby certify that the above services were rendered to the listed NHIS beneficiaries',
    MARGINS.left,
    yPos,
  );
  yPos += 5;
  doc.text(
    'and the claims are accurate and submitted in accordance with NHIS guidelines.',
    MARGINS.left,
    yPos,
  );
  yPos += 15;

  // Signature lines
  const sigWidth = 80;
  const sigGap = 40;
  const startX = (pageWidth - (sigWidth * 3 + sigGap * 2)) / 2;

  // Signature 1
  doc.line(startX, yPos, startX + sigWidth, yPos);
  yPos += 5;
  doc.setFontSize(FONTS.small);
  doc.text('NHIS Desk Officer', startX, yPos);
  doc.text('Date: _______________', startX, yPos + 5);

  // Signature 2
  const sig2X = startX + sigWidth + sigGap;
  doc.line(sig2X, yPos - 5, sig2X + sigWidth, yPos - 5);
  doc.text('Accounts Officer', sig2X, yPos);
  doc.text('Date: _______________', sig2X, yPos + 5);

  // Signature 3
  const sig3X = sig2X + sigWidth + sigGap;
  doc.line(sig3X, yPos - 5, sig3X + sigWidth, yPos - 5);
  doc.text('Medical Director', sig3X, yPos);
  doc.text('Date: _______________', sig3X, yPos + 5);

  yPos += 20;

  // Official stamp
  doc.setDrawColor(...COLORS.muted);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(pageWidth - MARGINS.right - 45, yPos - 15, 40, 30);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(FONTS.tiny);
  doc.setTextColor(...COLORS.muted);
  doc.text('Official Stamp', pageWidth - MARGINS.right - 25, yPos + 5, {
    align: 'center',
  });

  // Add footer to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter();
  }

  return doc.output('blob');
}

// Helper functions for PDF
function getCategoryLabelForPdf(category: string): string {
  const labels: Record<string, string> = {
    lab: 'Laboratory',
    radiology: 'Radiology',
    pharmacy: 'Pharmacy',
    procedure: 'Procedure',
    specialty: 'Specialty',
    consultation: 'Consultation',
    nursing: 'Nursing',
    admission: 'Admission/Inpatient',
  };
  return labels[category] || category;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Download comprehensive NHIS claims PDF
 */
export async function downloadComprehensiveNhisClaimsPdf(
  data: NhisComprehensiveClaimsSummary,
  options?: NhisComprehensiveClaimsPdfOptions,
): Promise<void> {
  const blob = await generateComprehensiveNhisClaimsPdf(data, options);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `NHIS_Comprehensive_Claims_${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

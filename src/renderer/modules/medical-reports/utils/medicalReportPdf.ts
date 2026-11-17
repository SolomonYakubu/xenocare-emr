import { jsPDF } from 'jspdf';
import {
  MedicalReportDTO,
  getReportTypeLabel,
} from '../dtos/medical-reports.dto';
import {
  getFacilityAddress,
  getFacilityName,
} from '../../../lib/facility';

interface PdfOptions {
  generatedByName?: string;
  logoBase64?: string;
}

const PAGE_MARGIN = 16;
const PAGE_TOP = 16;
const PAGE_BOTTOM = 16;
let logoBase64Cache: string | null = null;
let logoBase64Promise: Promise<string | null> | null = null;

const imageToBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
};

async function getCachedLogoBase64(): Promise<string | null> {
  if (logoBase64Cache) {
    return logoBase64Cache;
  }

  if (!logoBase64Promise) {
    logoBase64Promise = imageToBase64(ndcLogo)
      .then((value) => {
        logoBase64Cache = value;
        return value;
      })
      .catch((error) => {
        console.error('Failed to load XenoCare logo', error);
        return null;
      })
      .finally(() => {
        logoBase64Promise = null;
      });
  }

  return logoBase64Promise;
}

function formatDate(value?: string | null): string {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function sanitizePdfText(value: string): string {
  // First convert basic HTML to text approximations if Rich Text is detected
  let processed = value
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ''); // strip all other HTML tags

  // Deal with HTML entities from quill
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };
  processed = processed.replace(/&[a-z0-9#]+;/gi, (m) => entityMap[m] || m);

  return processed
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function resolvePatientName(report: MedicalReportDTO): string {
  const fullName = [
    report.patient?.first_name,
    report.patient?.middle_name,
    report.patient?.surname,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || 'Unknown Patient';
}

function resolveDoctorName(
  report: MedicalReportDTO,
  fallback?: string,
): string {
  const creatorName = [report.creator?.first_name, report.creator?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return creatorName || fallback || 'Attending Clinician';
}

function resolvePatientReference(report: MedicalReportDTO): string {
  return (
    report.patient?.emr_number ||
    report.patient?.patient_id ||
    report.patient_id ||
    'N/A'
  );
}

function replacePlaceholders(
  content: string,
  report: MedicalReportDTO,
  doctorName: string,
): string {
  const replacementDate = formatDate(report.issued_at || report.created_at);
  const substituted = content
    .replace(/\{patient_name\}/gi, resolvePatientName(report))
    .replace(/\{doctor_name\}/gi, doctorName)
    .replace(/\{date\}/gi, replacementDate)
    .replace(/\{document_number\}/gi, report.document_number || '')
    .replace(/\{report_type\}/gi, getReportTypeLabel(report.report_type));

  // Remove auxiliary AI disclaimer lines from the final issued PDF body.
  return substituted
    .split('\n')
    .filter((line) => !/AI-generated summary\s*-\s*verify/i.test(line))
    .join('\n');
}

function sanitizeFileName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '-');
  const safe = normalized.replace(/[^a-z0-9-_]/g, '');
  return safe || 'medical-report';
}

function ensureSpaceOrAddPage(
  doc: jsPDF,
  yPosition: number,
  requiredHeight: number,
  topMargin: number,
  bottomMargin: number,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPosition + requiredHeight <= pageHeight - bottomMargin) {
    return yPosition;
  }

  doc.addPage();
  return topMargin;
}

function drawLabelValuePair(
  doc: jsPDF,
  label: string,
  value: string,
  xLabel: number,
  xValue: number,
  y: number,
  valueMaxWidth: number,
): void {
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(label, xLabel, y);

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const valueLines = doc.splitTextToSize(
    sanitizePdfText(value || 'N/A'),
    valueMaxWidth,
  );
  doc.text(valueLines.slice(0, 2), xValue, y);
}

export async function buildMedicalReportPdf(
  report: MedicalReportDTO,
  options: PdfOptions = {},
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  if (!options.logoBase64) {
    options.logoBase64 = (await getCachedLogoBase64()) || undefined;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = PAGE_MARGIN;
  const contentWidth = pageWidth - margin * 2;

  const primaryGreen: [number, number, number] = [22, 101, 52];
  const darkText: [number, number, number] = [17, 24, 39];
  const mutedText: [number, number, number] = [71, 85, 105];

  const patientName = resolvePatientName(report);
  const patientReference = resolvePatientReference(report);
  const doctorName = resolveDoctorName(report, options.generatedByName);
  const approvedBy = [report.approver?.first_name, report.approver?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const reportTypeLabel = getReportTypeLabel(report.report_type);

  let y = 0;
  // Top green border
  doc.setFillColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.rect(0, 0, pageWidth, 5, 'F');

  y = PAGE_TOP;

  // Header and Logo
  let textMarginLeft = margin;
  if (options.logoBase64) {
    doc.addImage(options.logoBase64, 'PNG', margin, y, 16, 16);
    textMarginLeft = margin + 20;
  }

  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(getFacilityName().toUpperCase(), textMarginLeft, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  const facilityAddress = getFacilityAddress();
  if (facilityAddress) {
    doc.text(facilityAddress, textMarginLeft, y + 11);
  }
  doc.setFontSize(10);
  doc.text('Official Clinical Report', textMarginLeft, y + 16);

  // Document metadata right aligned
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.setFontSize(9);
  doc.text(
    `Document: ${sanitizePdfText(report.document_number || 'Draft')}`,
    pageWidth - margin,
    PAGE_TOP,
    {
      align: 'right',
    },
  );
  doc.text(
    `Status: ${sanitizePdfText(report.status)}`,
    pageWidth - margin,
    PAGE_TOP + 5,
    { align: 'right' },
  );
  doc.text(
    `Date: ${formatDate(report.issued_at || report.created_at)}`,
    pageWidth - margin,
    PAGE_TOP + 10,
    {
      align: 'right',
    },
  );

  y = PAGE_TOP + 18;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const reportTitle = sanitizePdfText(report.report_title || reportTypeLabel);
  const titleLines = doc.splitTextToSize(reportTitle, contentWidth);
  doc.text(titleLines, margin, y);

  y += Math.max(1, titleLines.length) * 6;

  const metaBoxY = y + 2;
  const metaBoxHeight = 42;

  // Draw top border for metadata section
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, metaBoxY, pageWidth - margin, metaBoxY);

  const metaTop = metaBoxY + 6;
  const col2 = margin + contentWidth / 1.8;
  const rowStep = 8;
  const leftLabelWidth = 28;
  const rightLabelWidth = 28;

  // Patient Info section
  doc.setTextColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PATIENT IDENTIFICATION', margin + 2, metaTop - 1);

  // Report Info section
  doc.text('REPORT DETAILS', col2 + 2, metaTop - 1);

  drawLabelValuePair(
    doc,
    'Patient Name:',
    patientName,
    margin + 2,
    margin + leftLabelWidth,
    metaTop + 6,
    col2 - margin - leftLabelWidth - 4,
  );
  drawLabelValuePair(
    doc,
    'EMR / Ref Nr:',
    patientReference,
    margin + 2,
    margin + leftLabelWidth,
    metaTop + 6 + rowStep,
    col2 - margin - leftLabelWidth - 4,
  );
  drawLabelValuePair(
    doc,
    'Valid From:',
    formatDate(report.valid_from),
    margin + 2,
    margin + leftLabelWidth,
    metaTop + 6 + rowStep * 2,
    col2 - margin - leftLabelWidth - 4,
  );
  drawLabelValuePair(
    doc,
    'Valid To:',
    formatDate(report.valid_to),
    margin + 2,
    margin + leftLabelWidth,
    metaTop + 6 + rowStep * 3,
    col2 - margin - leftLabelWidth - 4,
  );

  drawLabelValuePair(
    doc,
    'Report Type:',
    reportTypeLabel,
    col2 + 2,
    col2 + rightLabelWidth,
    metaTop + 6,
    pageWidth - margin - col2 - rightLabelWidth - 2,
  );
  drawLabelValuePair(
    doc,
    'Prepared By:',
    doctorName,
    col2 + 2,
    col2 + rightLabelWidth,
    metaTop + 6 + rowStep,
    pageWidth - margin - col2 - rightLabelWidth - 2,
  );
  drawLabelValuePair(
    doc,
    'Approved By:',
    approvedBy || 'Pending approval',
    col2 + 2,
    col2 + rightLabelWidth,
    metaTop + 6 + rowStep * 2,
    pageWidth - margin - col2 - rightLabelWidth - 2,
  );
  drawLabelValuePair(
    doc,
    'Created On:',
    formatDate(report.created_at),
    col2 + 2,
    col2 + rightLabelWidth,
    metaTop + 6 + rowStep * 3,
    pageWidth - margin - col2 - rightLabelWidth - 2,
  );

  y = metaBoxY + metaBoxHeight;

  // Draw bottom border for metadata section
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;

  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('REPORT CONTENT', margin, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  const processedContent = sanitizePdfText(
    replacePlaceholders(report.report_content || '', report, doctorName),
  );
  const paragraphs = processedContent
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  if (paragraphs.length === 0) {
    paragraphs.push('No report content available.');
  }

  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(paragraph, contentWidth);
    const estimatedHeight = Math.max(lines.length, 1) * 5.3 + 2;
    y = ensureSpaceOrAddPage(doc, y, estimatedHeight, PAGE_TOP, PAGE_BOTTOM);

    doc.text(lines, margin, y);
    y += Math.max(lines.length, 1) * 5.3 + 2;
  }

  y += 8;
  y = ensureSpaceOrAddPage(doc, y, 24, PAGE_TOP, PAGE_BOTTOM);

  doc.setDrawColor(203, 213, 225);
  const signatureWidth = 72;
  doc.line(margin, y, margin + signatureWidth, y);
  doc.line(pageWidth - margin - signatureWidth, y, pageWidth - margin, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(sanitizePdfText(doctorName), margin, y, {
    maxWidth: signatureWidth,
  });
  doc.text(
    sanitizePdfText(approvedBy || 'Pending approval'),
    pageWidth - margin - signatureWidth,
    y,
    { maxWidth: signatureWidth },
  );

  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Attending Clinician', margin, y);
  doc.text('Approving Officer', pageWidth - margin - signatureWidth, y);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);

    // Apply Draft Watermark
    if (report.status === 'Draft' || report.status === 'Pending Approval') {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(60);
      // Center and rotate text
      doc.text(
        'DRAFT - NOT FOR CLINICAL USE',
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() / 2,
        {
          align: 'center',
          angle: 45,
        },
      );
      doc.restoreGraphicsState();
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Generated from ${getFacilityName()} on ${new Date().toLocaleString()}`,
      margin,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    );
  }

  return doc;
}

export async function openMedicalReportPdf(
  report: MedicalReportDTO,
  options: PdfOptions = {},
): Promise<void> {
  const doc = await buildMedicalReportPdf(report, options);
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');

  if (!newWindow) {
    URL.revokeObjectURL(blobUrl);
    throw new Error(
      'Unable to open PDF preview. Please allow pop-ups and retry.',
    );
  }

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}

export async function downloadMedicalReportPdf(
  report: MedicalReportDTO,
  options: PdfOptions = {},
): Promise<void> {
  const doc = await buildMedicalReportPdf(report, options);
  const preferredName =
    report.document_number || report.report_title || 'medical-report';
  const fileName = `${sanitizeFileName(preferredName)}.pdf`;
  doc.save(fileName);
}

// =============================================================================
// XenoCare Receipt & Invoice Print Utility
// Professional branded documents with QR verification for audit compliance
// =============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { InvoiceDTO, PaymentDTO } from '../dtos/billing.dto';
import { getBrand } from './billingExport';
import { createScopedLogger } from '../../../utils/logger';
import { APP_POWERED_BY } from '../../../shared/constants/branding';
import { getFacilityInfo } from '../../../lib/facility';

const log = createScopedLogger('ReceiptPrint');

// =============================================================================
// PDF-Safe Currency Formatting
// =============================================================================

/**
 * Format currency for PDF output (uses NGN instead of ₦ symbol which isn't supported by default PDF fonts)
 */
function formatCurrencyPDF(amount: number): string {
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `NGN ${formatted}`;
}

// =============================================================================
// Verification Code Generation (Anti-Fraud)
// =============================================================================

/**
 * Generate a unique verification code for receipts/invoices
 * Format: NDC-YYYYMMDD-XXXX-CHECKSUM
 * This code can be used to verify authenticity
 */
export function generateVerificationCode(
  documentId: string,
  documentNumber: string,
  amount: number,
  date: Date = new Date(),
): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

  // Create a hash-like string from document details
  const dataToHash = `${documentId}${documentNumber}${amount}${dateStr}`;
  let hash = 0;
  for (let i = 0; i < dataToHash.length; i++) {
    const char = dataToHash.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Convert to 32-bit integer
  }

  // Convert to alphanumeric (uppercase)
  const hashStr = Math.abs(hash)
    .toString(36)
    .toUpperCase()
    .padStart(6, '0')
    .slice(0, 6);

  // Calculate checksum (simple mod 97 check digit like IBAN)
  const numericValue =
    parseInt(
      hashStr
        .split('')
        .map((c) => c.charCodeAt(0))
        .join('')
        .slice(0, 10),
    ) % 97;
  const checksum = (98 - numericValue).toString().padStart(2, '0');

  return `NDC-${dateStr}-${hashStr}-${checksum}`;
}

/**
 * Verify a verification code is valid format
 */
export function isValidVerificationCode(code: string): boolean {
  const pattern = /^NDC-\d{8}-[A-Z0-9]{6}-\d{2}$/;
  return pattern.test(code);
}

// =============================================================================
// QR Code Generation
// =============================================================================

/**
 * Generate QR code data URL for document verification
 */
export async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 150,
      margin: 1,
      color: {
        dark: '#166534', // XenoCare green
        light: '#ffffff',
      },
    });
  } catch (error) {
    log.error('QR Code generation failed:', error);
    return '';
  }
}

/**
 * Create verification URL for QR code
 */
export function createVerificationURL(
  documentType: 'receipt' | 'invoice',
  documentNumber: string,
  verificationCode: string,
): string {
  // Verification lives on the facility's own site; without one the document
  // still carries a unique code but no public lookup link.
  const site = getFacilityInfo().website?.trim();
  if (!site) return '';
  const baseURL = `${site.replace(/\/+$/, '')}/verify`;
  return `${baseURL}?type=${documentType}&num=${encodeURIComponent(documentNumber)}&code=${encodeURIComponent(verificationCode)}`;
}

// =============================================================================
// Receipt Configuration (Best Practices)
// =============================================================================

/**
 * Best Practice: Single consolidated receipt per payment transaction
 * - Multiple services paid at once = ONE receipt
 * - Each service line item listed separately
 * - Total clearly shown
 * - Prevents fraud by having traceable, unique receipts
 */

export interface ReceiptData {
  receiptNumber: string;
  receiptId: string;
  date: Date;
  patient: {
    id: string;
    name: string;
    emrNumber?: string;
    phone?: string;
    // NHIS-specific fields for receipt display
    insuranceType?: string; // Private, DHML, Civilian_NHIS
    nhisNumber?: string; // NHIS enrollment number
    hmoName?: string; // HMO name (DHML for Military, payer_info.scheme for Civilian)
    patientType?: string; // Principal, Dependent, Private
    // Referral patient info
    isReferralPatient?: boolean;
    referralCode?: string;
    referringFacility?: string;
  };
  encounter?: {
    id: string;
    number: string;
    type?: string;
  };
  items: Array<{
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
    total: number;
    // Per-item NHIS breakdown
    nhis_covered?: boolean;
    nhis_percentage?: number;
    nhis_payable?: number;
    patient_payable?: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethod: string;
  referenceNumber?: string;
  balance: number;
  cashier: {
    name: string;
    id?: string;
  };
  verificationCode: string;
  invoiceNumbers?: string[]; // If payment covers multiple invoices
  // NHIS billing info (summary totals)
  nhisInfo?: {
    nhisPercentage: number; // Average/default % covered by NHIS
    nhisPayable: number; // Total amount NHIS pays
    patientPayable: number; // Total amount patient pays
  };
}

export interface InvoicePrintData {
  invoiceNumber: string;
  invoiceId: string;
  date: Date;
  dueDate?: Date;
  patient: {
    id: string;
    name: string;
    emrNumber?: string;
    phone?: string;
    address?: string;
  };
  encounter?: {
    id: string;
    number: string;
    type?: string;
    chiefComplaint?: string;
  };
  items: Array<{
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>;
  subtotal: number;
  discountTotal: number;
  tax: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: string;
  createdBy?: string;
  verificationCode: string;
  notes?: string;
}

// =============================================================================
// PDF Generation Utilities
// =============================================================================

/**
 * Add XenoCare receipt header to PDF document
 */
async function addReceiptHeader(doc: jsPDF, yOffset: number = 10): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  // Hospital name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // XenoCare green
  doc.text(getBrand().name.toUpperCase(), centerX, yOffset, { align: 'center' });
  yOffset += 5;

  // Full name
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(getBrand().fullName, centerX, yOffset, { align: 'center' });
  yOffset += 4;

  // Tagline
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(getBrand().tagline, centerX, yOffset, { align: 'center' });
  yOffset += 4;

  // Contact info
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const contactLine = `Tel: ${getBrand().phone} | Email: ${getBrand().email}`;
  doc.text(contactLine, centerX, yOffset, { align: 'center' });
  yOffset += 3;

  // Address
  doc.setFontSize(6);
  const addressLines = doc.splitTextToSize(getBrand().address, 150);
  addressLines.forEach((line: string) => {
    doc.text(line, centerX, yOffset, { align: 'center' });
    yOffset += 2.5;
  });
  yOffset += 2;

  // Divider line
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(15, yOffset, pageWidth - 15, yOffset);
  yOffset += 4;

  return yOffset;
}

/**
 * Add footer with verification info
 */
function addFooter(
  doc: jsPDF,
  verificationCode: string,
  qrDataURL: string,
  pageNumber: number = 1,
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let footerY = pageHeight - 45;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(15, footerY, pageWidth - 15, footerY);
  footerY += 5;

  // QR Code on the left
  if (qrDataURL) {
    doc.addImage(qrDataURL, 'PNG', 15, footerY, 30, 30);
  }

  // Verification info in center
  const centerX = pageWidth / 2;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('VERIFICATION CODE', centerX, footerY + 3, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('courier', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(verificationCode, centerX, footerY + 9, { align: 'center' });

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(
    qrDataURL
      ? 'Scan the QR code to verify this document'
      : 'Quote the code above to verify this document',
    centerX,
    footerY + 14,
    { align: 'center' },
  );

  // Legal text
  doc.setFontSize(6);
  doc.text(
    'This is an electronically generated document.',
    centerX,
    footerY + 23,
    { align: 'center' },
  );
  doc.text(
    'For queries, contact the Billing Department.',
    centerX,
    footerY + 26,
    { align: 'center' },
  );
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text(APP_POWERED_BY, centerX, footerY + 29, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);

  // Page number on right
  doc.setFontSize(8);
  doc.text(`Page ${pageNumber}`, pageWidth - 20, footerY + 15, {
    align: 'right',
  });

  // Print timestamp
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  const timestamp = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Printed: ${timestamp}`, pageWidth - 20, footerY + 28, {
    align: 'right',
  });
}

// =============================================================================
// Thermal Receipt PDF Generation (80mm width - Standard POS Receipt)
// =============================================================================

/**
 * Generate a thermal receipt PDF (80mm width)
 * Standard format for POS thermal printers
 * Best Practice: Single receipt for all services paid in one transaction
 */
export async function generateReceiptPDF(data: ReceiptData): Promise<jsPDF> {
  // 80mm thermal receipt width = approximately 72mm printable area
  // Height is calculated dynamically based on content
  const receiptWidth = 80; // 80mm standard thermal paper width
  const margin = 3;
  const contentWidth = receiptWidth - margin * 2;
  const centerX = receiptWidth / 2;

  // Calculate estimated height based on content
  const baseHeight = 120; // Minimum height for header, patient info, totals
  const itemHeight = data.items.length * 12; // ~12mm per item
  const nhisInsTypes = [
    'dhml',
    'civilian_nhis',
    'military_nhis',
    'security_services_nhis',
    'gifship',
    'retainership',
    'corporate',
  ];
  const nhisHeight =
    data.patient.insuranceType &&
    nhisInsTypes.includes(data.patient.insuranceType.toLowerCase())
      ? 15
      : 0;
  const estimatedHeight = baseHeight + itemHeight + nhisHeight + 40; // +40 for footer/QR

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [receiptWidth, Math.max(estimatedHeight, 150)], // Dynamic height
  });

  let yOffset = 2;

  // ============ HEADER ============
  // Hospital name
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text(getBrand().name.toUpperCase(), centerX, yOffset, { align: 'center' });
  yOffset += 2.5;

  // Tagline
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Excellence in Healthcare', centerX, yOffset, { align: 'center' });
  yOffset += 2.5;

  // Contact
  doc.setFontSize(5);
  doc.text(`Tel: ${getBrand().phone}`, centerX, yOffset, { align: 'center' });
  yOffset += 2.5;

  // Dashed divider
  doc.setDrawColor(150, 150, 150);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, yOffset, receiptWidth - margin, yOffset);
  doc.setLineDashPattern([], 0);
  yOffset += 3;

  // ============ RECEIPT TITLE ============
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PAYMENT RECEIPT', centerX, yOffset, { align: 'center' });
  yOffset += 5;

  // ============ RECEIPT INFO ============
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');

  // Receipt number and date on same line
  doc.text(`Receipt: ${data.receiptNumber}`, margin, yOffset);
  yOffset += 3;

  // Date and time
  const dateStr = data.date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = data.date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  doc.text(`Date: ${dateStr}  ${timeStr}`, margin, yOffset);
  yOffset += 3;

  // Payment method
  doc.text(`Payment: ${data.paymentMethod.replace('_', ' ')}`, margin, yOffset);
  if (data.referenceNumber) {
    doc.text(`Ref: ${data.referenceNumber}`, margin + 35, yOffset);
  }
  yOffset += 3;

  // Dashed divider
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, yOffset, receiptWidth - margin, yOffset);
  doc.setLineDashPattern([], 0);
  yOffset += 3;

  // ============ PATIENT INFO ============
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('PATIENT:', margin, yOffset);
  doc.setFont('helvetica', 'normal');
  yOffset += 3;

  // Patient name (may need to wrap)
  const patientName = data.patient.name || 'N/A';
  const nameLines = doc.splitTextToSize(patientName, contentWidth);
  nameLines.forEach((line: string) => {
    doc.text(line, margin, yOffset);
    yOffset += 3;
  });

  // EMR and Phone on same line
  doc.text(`EMR: ${data.patient.emrNumber || 'N/A'}`, margin, yOffset);
  doc.text(`Phone: ${data.patient.phone || 'N/A'}`, margin + 30, yOffset);
  yOffset += 3;

  // Encounter if exists
  if (data.encounter) {
    doc.text(`Encounter: ${data.encounter.number}`, margin, yOffset);
    yOffset += 3;
  }

  // NHIS info if applicable
  const isNhisPatient =
    data.patient.insuranceType &&
    nhisInsTypes.includes(data.patient.insuranceType.toLowerCase());

  if (isNhisPatient) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    const insLabel = (data.patient.insuranceType || 'NHIS')
      .toUpperCase()
      .replace(/_/g, ' ');
    doc.text(`${insLabel} PATIENT`, margin, yOffset);
    yOffset += 3;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`HMO: ${data.patient.hmoName || 'N/A'}`, margin, yOffset);
    yOffset += 3;
    doc.text(`NHIS No: ${data.patient.nhisNumber || 'N/A'}`, margin, yOffset);
    yOffset += 3;

    if (data.patient.isReferralPatient) {
      doc.text(
        `Ref Code: ${data.patient.referralCode || 'N/A'}`,
        margin,
        yOffset,
      );
      yOffset += 3;
    }
  }

  // Dashed divider
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, yOffset, receiptWidth - margin, yOffset);
  doc.setLineDashPattern([], 0);
  yOffset += 3;

  // ============ SERVICE NAME ============
  const thermalServiceName =
    data.items
      .map((i) => i.description)
      .filter((d) => d && d !== 'Service')[0] || '';
  if (thermalServiceName) {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    const serviceLines = doc.splitTextToSize(
      `Service: ${thermalServiceName}`,
      contentWidth,
    );
    serviceLines.forEach((line: string) => {
      doc.text(line, margin, yOffset);
      yOffset += 3;
    });
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, yOffset, receiptWidth - margin, yOffset);
    doc.setLineDashPattern([], 0);
    yOffset += 3;
  }

  // ============ ITEMS ============
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEMS', margin, yOffset);
  doc.text('AMT', receiptWidth - margin, yOffset, { align: 'right' });
  yOffset += 3;

  doc.setFont('helvetica', 'normal');

  // Items list
  data.items.forEach((item, index) => {
    // Check if we need a new page
    if (yOffset > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage([receiptWidth, 150]);
      yOffset = 5;
      doc.setFontSize(6);
    }

    // Item description (wrap if needed)
    const descLines = doc.splitTextToSize(
      `${index + 1}. ${item.description}`,
      contentWidth - 20,
    );
    descLines.forEach((line: string, lineIndex: number) => {
      doc.text(line, margin, yOffset);
      if (lineIndex === 0) {
        doc.text(
          formatCurrencyPDF(item.total).replace('NGN ', ''),
          receiptWidth - margin,
          yOffset,
          { align: 'right' },
        );
      }
      yOffset += 3;
    });

    // Qty x Price (smaller text)
    doc.setFontSize(5);
    doc.text(
      `  ${item.quantity} x ${formatCurrencyPDF(item.unitPrice).replace('NGN ', '')}`,
      margin,
      yOffset,
    );
    yOffset += 2.5;

    // Per-item NHIS breakdown (if applicable)
    if (item.nhis_covered && item.nhis_percentage && item.nhis_percentage > 0) {
      doc.setTextColor(22, 101, 52); // Green for NHIS
      const nhisAmt =
        item.nhis_payable || (item.total * item.nhis_percentage) / 100;
      const patientAmt = item.patient_payable || item.total - nhisAmt;
      doc.text(
        `  NHIS ${item.nhis_percentage}%: -${formatCurrencyPDF(nhisAmt).replace('NGN ', '')}`,
        margin,
        yOffset,
      );
      doc.text(
        `Pt: ${formatCurrencyPDF(patientAmt).replace('NGN ', '')}`,
        receiptWidth - margin,
        yOffset,
        { align: 'right' },
      );
      doc.setTextColor(0, 0, 0);
      yOffset += 2.5;
    }

    doc.setFontSize(6);
    yOffset += 0.5;
  });

  // Dashed divider
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, yOffset, receiptWidth - margin, yOffset);
  doc.setLineDashPattern([], 0);
  yOffset += 3;

  // ============ TOTALS ============
  doc.setFontSize(6);

  // Subtotal
  doc.text('Subtotal:', margin, yOffset);
  doc.text(
    formatCurrencyPDF(data.subtotal).replace('NGN ', 'N'),
    receiptWidth - margin,
    yOffset,
    { align: 'right' },
  );
  yOffset += 3;

  // Discount if any
  if (data.discount > 0) {
    doc.text('Discount:', margin, yOffset);
    doc.setTextColor(220, 38, 38);
    doc.text(
      `-${formatCurrencyPDF(data.discount).replace('NGN ', 'N')}`,
      receiptWidth - margin,
      yOffset,
      { align: 'right' },
    );
    doc.setTextColor(0, 0, 0);
    yOffset += 3;
  }

  // NHIS breakdown if applicable
  if (data.nhisInfo) {
    doc.text(`NHIS (${data.nhisInfo.nhisPercentage}%):`, margin, yOffset);
    doc.text(
      formatCurrencyPDF(data.nhisInfo.nhisPayable).replace('NGN ', 'N'),
      receiptWidth - margin,
      yOffset,
      { align: 'right' },
    );
    yOffset += 3;
    doc.text('Patient Pays:', margin, yOffset);
    doc.text(
      formatCurrencyPDF(data.nhisInfo.patientPayable).replace('NGN ', 'N'),
      receiptWidth - margin,
      yOffset,
      { align: 'right' },
    );
    yOffset += 3;
  }

  // Total line (bold, larger)
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, yOffset, receiptWidth - margin, yOffset);
  doc.setLineDashPattern([], 0);
  yOffset += 3;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', margin, yOffset);
  doc.text(
    formatCurrencyPDF(data.totalAmount).replace('NGN ', 'N'),
    receiptWidth - margin,
    yOffset,
    { align: 'right' },
  );
  yOffset += 4;

  // Amount paid
  doc.setFontSize(7);
  doc.setTextColor(22, 101, 52);
  doc.text('PAID:', margin, yOffset);
  doc.text(
    formatCurrencyPDF(data.amountPaid).replace('NGN ', 'N'),
    receiptWidth - margin,
    yOffset,
    { align: 'right' },
  );
  yOffset += 4;

  // Balance or PAID IN FULL
  if (data.balance > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text('BALANCE:', margin, yOffset);
    doc.text(
      formatCurrencyPDF(data.balance).replace('NGN ', 'N'),
      receiptWidth - margin,
      yOffset,
      { align: 'right' },
    );
  } else {
    doc.setFontSize(8);
    doc.text('*** PAID IN FULL ***', centerX, yOffset, { align: 'center' });
  }
  doc.setTextColor(0, 0, 0);
  yOffset += 4;

  // Dashed divider
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, yOffset, receiptWidth - margin, yOffset);
  doc.setLineDashPattern([], 0);
  yOffset += 3;

  // ============ ISSUED BY (VERIFIER) ============
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Issued By: ${data.cashier.name}`, margin, yOffset);
  yOffset += 3;

  // Invoice references if multiple
  if (data.invoiceNumbers && data.invoiceNumbers.length > 0) {
    doc.text(`Invoice(s): ${data.invoiceNumbers.join(', ')}`, margin, yOffset);
    yOffset += 3;
  }

  // ============ VERIFICATION ============
  yOffset += 2;
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('VERIFICATION CODE', centerX, yOffset, { align: 'center' });
  yOffset += 3;

  doc.setFontSize(6);
  doc.setFont('courier', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.verificationCode, centerX, yOffset, { align: 'center' });
  yOffset += 4;

  // QR Code (smaller for thermal)
  try {
    const verificationURL = createVerificationURL(
      'receipt',
      data.receiptNumber,
      data.verificationCode,
    );
    const qrDataURL = verificationURL
      ? await generateQRCodeDataURL(verificationURL)
      : '';
    if (qrDataURL) {
      doc.addImage(qrDataURL, 'PNG', centerX - 10, yOffset, 20, 20);
      yOffset += 22;
    }
  } catch (error) {
    log.warn('QR code generation failed');
    yOffset += 2;
  }

  // ============ FOOTER ============
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Thank you for choosing ${getBrand().name}`, centerX, yOffset, {
    align: 'center',
  });
  yOffset += 3;
  doc.text('This is a computer generated receipt', centerX, yOffset, {
    align: 'center',
  });
  yOffset += 3;
  doc.text('Powered by XenoCare', centerX, yOffset, {
    align: 'center',
  });
  yOffset += 3;

  // Print timestamp
  const timestamp = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Printed: ${timestamp}`, centerX, yOffset, { align: 'center' });

  return doc;
}

// Keep the old A4 format as an alternative
/**
 * Generate A4 receipt PDF (for regular printing)
 */
export async function generateReceiptPDFA4(data: ReceiptData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Add header
  let yOffset = await addReceiptHeader(doc);

  // Receipt title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PAYMENT RECEIPT', pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 8;

  // Receipt metadata
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Two-column layout for receipt info
  const leftCol = 20;
  const rightCol = pageWidth / 2 + 10;

  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('Receipt No:', leftCol, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(data.receiptNumber, leftCol + 25, yOffset);

  // Right column
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', rightCol, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(
    data.date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    rightCol + 15,
    yOffset,
  );
  yOffset += 5;

  // Add timestamp row
  doc.setFont('helvetica', 'bold');
  doc.text('Time:', leftCol, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(
    data.date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }),
    leftCol + 15,
    yOffset,
  );

  // Payment method
  doc.setFont('helvetica', 'bold');
  doc.text('Payment Method:', rightCol, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(data.paymentMethod.replace('_', ' '), rightCol + 35, yOffset);
  yOffset += 5;

  if (data.referenceNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text('Ref #:', rightCol, yOffset);
    doc.setFont('helvetica', 'normal');
    doc.text(data.referenceNumber, rightCol + 15, yOffset);
  }
  yOffset += 8;

  // Patient info box - Calculate height based on NHIS fields
  const normalizedInsType = (data.patient.insuranceType || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
  const isNhisPatient =
    data.patient.insuranceType &&
    (normalizedInsType.includes('nhis') ||
      normalizedInsType === 'dhml' ||
      normalizedInsType === 'gifship');
  const { isReferralPatient } = data.patient;

  // Base height + NHIS row (if applicable) + Referral row (if applicable)
  let patientBoxHeight = 18;
  if (isNhisPatient) patientBoxHeight += 8; // Extra row for HMO and NHIS Number
  if (isReferralPatient) patientBoxHeight += 4; // Extra row for referral info

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(15, yOffset, pageWidth - 30, patientBoxHeight, 2, 2, 'F');
  yOffset += 5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('PATIENT INFORMATION', leftCol, yOffset);
  yOffset += 5;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${data.patient.name}`, leftCol, yOffset);
  doc.text(`EMR #: ${data.patient.emrNumber || 'N/A'}`, rightCol, yOffset);
  yOffset += 4;
  doc.text(`Phone: ${data.patient.phone || 'N/A'}`, leftCol, yOffset);
  if (data.encounter) {
    doc.text(`Encounter: ${data.encounter.number}`, rightCol, yOffset);
  }

  // NHIS-specific info (HMO and NHIS Number)
  if (isNhisPatient) {
    yOffset += 4;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('HMO:', leftCol, yOffset);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(data.patient.hmoName || 'N/A', leftCol + 15, yOffset);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('NHIS No:', rightCol, yOffset);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(data.patient.nhisNumber || 'N/A', rightCol + 20, yOffset);

    // Add referral info if referral patient
    if (isReferralPatient) {
      yOffset += 4;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52);
      doc.text('Referral Code:', leftCol, yOffset);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(data.patient.referralCode || 'N/A', leftCol + 30, yOffset);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52);
      doc.text('From:', rightCol, yOffset);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      // Truncate facility name if too long
      const facilityName = data.patient.referringFacility || 'N/A';
      const maxFacilityLength = 30;
      const displayFacility =
        facilityName.length > maxFacilityLength
          ? `${facilityName.substring(0, maxFacilityLength - 3)}...`
          : facilityName;
      doc.text(displayFacility, rightCol + 15, yOffset);
    }
  }
  yOffset += 4;

  // Service / Consultation Name — prominent row above items table
  const primaryServiceName =
    data.items
      .map((i) => i.description)
      .filter((d) => d && d !== 'Service')[0] || '';
  if (primaryServiceName) {
    doc.setFillColor(239, 246, 255); // light blue bg
    doc.roundedRect(15, yOffset, pageWidth - 30, 8, 2, 2, 'F');
    yOffset += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175); // blue-800
    doc.text(`Service: ${primaryServiceName}`, leftCol, yOffset);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    yOffset += 6;
  }

  // Check if any items have NHIS coverage (also consider nhis_covered=true even if percentage not stored)
  const hasNhisItems = data.items.some(
    (item) =>
      item.nhis_covered &&
      (item.nhis_percentage ? item.nhis_percentage > 0 : true),
  );

  // Items table - include NHIS columns if any items have NHIS coverage
  const tableHead = hasNhisItems
    ? [
        [
          'Description',
          'Category',
          'Qty',
          'Unit Price',
          'Amount',
          'NHIS %',
          'NHIS Covers',
          'Patient Pays',
        ],
      ]
    : [['Description', 'Category', 'Qty', 'Unit Price', 'Amount']];

  const tableData = data.items.map((item) => {
    const nhisAmt =
      item.nhis_payable ||
      (item.nhis_covered && item.nhis_percentage
        ? (item.total * item.nhis_percentage) / 100
        : 0);
    const patientAmt = item.patient_payable || item.total - nhisAmt;

    if (hasNhisItems) {
      return [
        item.description,
        item.category,
        item.quantity.toString(),
        formatCurrencyPDF(item.unitPrice),
        formatCurrencyPDF(item.total),
        item.nhis_covered && item.nhis_percentage
          ? `${item.nhis_percentage}%`
          : '-',
        item.nhis_covered && nhisAmt > 0 ? formatCurrencyPDF(nhisAmt) : '-',
        formatCurrencyPDF(patientAmt),
      ];
    }
    return [
      item.description,
      item.category,
      item.quantity.toString(),
      formatCurrencyPDF(item.unitPrice),
      formatCurrencyPDF(item.total),
    ];
  });

  autoTable(doc, {
    startY: yOffset,
    head: tableHead,
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: hasNhisItems
      ? {
          0: { cellWidth: 45 },
          1: { cellWidth: 25 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 22, halign: 'right' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 15, halign: 'center' },
          6: { cellWidth: 22, halign: 'right' },
          7: { cellWidth: 22, halign: 'right' },
        }
      : {
          0: { cellWidth: 60 },
          1: { cellWidth: 35 },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' },
        },
    margin: { left: 15, right: 15 },
  });

  yOffset = (doc as any).lastAutoTable.finalY + 5;

  // Totals section
  const totalsX = pageWidth - 80;

  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX, yOffset);
  doc.text(formatCurrencyPDF(data.subtotal), pageWidth - 20, yOffset, {
    align: 'right',
  });
  yOffset += 5;

  if (data.discount > 0) {
    doc.text('Discount:', totalsX, yOffset);
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatCurrencyPDF(data.discount)}`, pageWidth - 20, yOffset, {
      align: 'right',
    });
    doc.setTextColor(0, 0, 0);
    yOffset += 5;
  }

  if (data.tax > 0) {
    doc.text('Tax:', totalsX, yOffset);
    doc.text(formatCurrencyPDF(data.tax), pageWidth - 20, yOffset, {
      align: 'right',
    });
    yOffset += 5;
  }

  // Total line
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 5, yOffset, pageWidth - 15, yOffset);
  yOffset += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL:', totalsX, yOffset);
  doc.text(formatCurrencyPDF(data.totalAmount), pageWidth - 20, yOffset, {
    align: 'right',
  });
  yOffset += 6;

  // Amount paid
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.text('Amount Paid:', totalsX, yOffset);
  doc.text(formatCurrencyPDF(data.amountPaid), pageWidth - 20, yOffset, {
    align: 'right',
  });
  yOffset += 5;

  // Balance (if any)
  if (data.balance > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text('Balance Due:', totalsX, yOffset);
    doc.text(formatCurrencyPDF(data.balance), pageWidth - 20, yOffset, {
      align: 'right',
    });
    yOffset += 5;
  } else {
    doc.setTextColor(22, 101, 52);
    doc.text('PAID IN FULL', pageWidth / 2, yOffset, { align: 'center' });
    yOffset += 5;
  }

  doc.setTextColor(0, 0, 0);
  yOffset += 5;

  // Cashier info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Issued by: ${data.cashier.name}`, 15, yOffset);

  // Invoice references if multiple
  if (data.invoiceNumbers && data.invoiceNumbers.length > 0) {
    yOffset += 5;
    doc.text(`Invoice(s): ${data.invoiceNumbers.join(', ')}`, 15, yOffset);
  }

  // Generate QR code
  const verificationURL = createVerificationURL(
    'receipt',
    data.receiptNumber,
    data.verificationCode,
  );
  const qrDataURL = verificationURL
    ? await generateQRCodeDataURL(verificationURL)
    : '';

  // Add footer with verification
  addFooter(doc, data.verificationCode, qrDataURL);

  return doc;
}

// =============================================================================
// Invoice PDF Generation
// =============================================================================

/**
 * Generate a professional invoice PDF
 */
export async function generateInvoicePDF(
  data: InvoicePrintData,
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Add header
  let yOffset = await addReceiptHeader(doc);

  // Invoice title with status
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('INVOICE', pageWidth / 2, yOffset, { align: 'center' });
  yOffset += 6;

  // Status badge
  const statusColors: Record<string, [number, number, number]> = {
    Paid: [22, 163, 74], // Green
    Pending: [234, 179, 8], // Yellow
    Partial: [249, 115, 22], // Orange
    Cancelled: [220, 38, 38], // Red
    Draft: [107, 114, 128], // Gray
  };

  const statusColor = statusColors[data.status] || [107, 114, 128];
  doc.setFillColor(...statusColor);
  const statusWidth = doc.getTextWidth(data.status.toUpperCase()) + 10;
  doc.roundedRect(
    (pageWidth - statusWidth) / 2,
    yOffset - 3,
    statusWidth,
    6,
    1,
    1,
    'F',
  );
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(data.status.toUpperCase(), pageWidth / 2, yOffset + 1, {
    align: 'center',
  });
  yOffset += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Two-column layout
  const leftCol = 20;
  const rightCol = pageWidth / 2 + 10;

  // Invoice details
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice No:', leftCol, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(data.invoiceNumber, leftCol + 25, yOffset);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', rightCol, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(
    data.date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    rightCol + 15,
    yOffset,
  );
  yOffset += 5;

  // Add timestamp row for invoice
  doc.setFont('helvetica', 'bold');
  doc.text('Time:', leftCol, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(
    data.date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }),
    leftCol + 15,
    yOffset,
  );

  if (data.dueDate) {
    doc.setFont('helvetica', 'bold');
    doc.text('Due Date:', rightCol, yOffset);
    doc.setFont('helvetica', 'normal');
    doc.text(
      data.dueDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      rightCol + 25,
      yOffset,
    );
  }
  yOffset += 8;

  // Patient info box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(15, yOffset, pageWidth - 30, 22, 2, 2, 'F');
  yOffset += 5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52);
  doc.text('BILL TO', leftCol, yOffset);
  yOffset += 5;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(data.patient.name, leftCol, yOffset);
  doc.setFont('helvetica', 'normal');
  doc.text(`EMR #: ${data.patient.emrNumber || 'N/A'}`, rightCol, yOffset);
  yOffset += 4;
  doc.text(`Phone: ${data.patient.phone || 'N/A'}`, leftCol, yOffset);
  if (data.encounter) {
    doc.text(`Encounter: ${data.encounter.number}`, rightCol, yOffset);
  }
  yOffset += 4;
  if (data.encounter?.chiefComplaint) {
    doc.setFontSize(8);
    doc.text(
      `Reason: ${data.encounter.chiefComplaint.substring(0, 50)}...`,
      leftCol,
      yOffset,
    );
  }
  yOffset += 6;

  // Consultation / Service Name — prominent row
  const invoiceServiceName =
    data.items
      .map((i) => i.description)
      .filter((d) => d && d !== 'Service')[0] || '';
  if (invoiceServiceName) {
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(15, yOffset, pageWidth - 30, 8, 2, 2, 'F');
    yOffset += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text(`Service: ${invoiceServiceName}`, leftCol, yOffset);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    yOffset += 6;
  }

  // Items table
  const tableData = data.items.map((item) => [
    item.description,
    item.category,
    item.quantity.toString(),
    formatCurrencyPDF(item.unitPrice),
    item.discount > 0 ? formatCurrencyPDF(item.discount) : '-',
    formatCurrencyPDF(item.total),
  ]);

  autoTable(doc, {
    startY: yOffset,
    head: [
      ['Description', 'Category', 'Qty', 'Unit Price', 'Discount', 'Amount'],
    ],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 30 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
  });

  yOffset = (doc as any).lastAutoTable.finalY + 5;

  // Totals section
  const totalsX = pageWidth - 80;

  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX, yOffset);
  doc.text(formatCurrencyPDF(data.subtotal), pageWidth - 20, yOffset, {
    align: 'right',
  });
  yOffset += 5;

  if (data.discountTotal > 0) {
    doc.text('Total Discount:', totalsX, yOffset);
    doc.setTextColor(220, 38, 38);
    doc.text(
      `-${formatCurrencyPDF(data.discountTotal)}`,
      pageWidth - 20,
      yOffset,
      { align: 'right' },
    );
    doc.setTextColor(0, 0, 0);
    yOffset += 5;
  }

  if (data.tax > 0) {
    doc.text('Tax:', totalsX, yOffset);
    doc.text(formatCurrencyPDF(data.tax), pageWidth - 20, yOffset, {
      align: 'right',
    });
    yOffset += 5;
  }

  // Total line
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 5, yOffset, pageWidth - 15, yOffset);
  yOffset += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL DUE:', totalsX, yOffset);
  doc.text(formatCurrencyPDF(data.totalAmount), pageWidth - 20, yOffset, {
    align: 'right',
  });
  yOffset += 6;

  // Payment summary
  doc.setFontSize(9);
  if (data.amountPaid > 0) {
    doc.setTextColor(22, 101, 52);
    doc.text('Amount Paid:', totalsX, yOffset);
    doc.text(formatCurrencyPDF(data.amountPaid), pageWidth - 20, yOffset, {
      align: 'right',
    });
    yOffset += 5;
  }

  if (data.balance > 0) {
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.text('BALANCE DUE:', totalsX, yOffset);
    doc.text(formatCurrencyPDF(data.balance), pageWidth - 20, yOffset, {
      align: 'right',
    });
  } else if (data.status === 'Paid') {
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID IN FULL', pageWidth / 2, yOffset + 5, { align: 'center' });
  }

  doc.setTextColor(0, 0, 0);
  yOffset += 10;

  // Notes
  if (data.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Notes:', 15, yOffset);
    yOffset += 4;
    const noteLines = doc.splitTextToSize(data.notes, pageWidth - 30);
    noteLines.forEach((line: string) => {
      doc.text(line, 15, yOffset);
      yOffset += 4;
    });
  }

  // Payment instructions for unpaid invoices
  if (data.balance > 0) {
    yOffset += 5;
    doc.setFillColor(254, 243, 199); // Yellow background
    doc.roundedRect(15, yOffset, pageWidth - 30, 15, 2, 2, 'F');
    yOffset += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(146, 64, 14);
    doc.text('PAYMENT INSTRUCTIONS', 20, yOffset);
    yOffset += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Please proceed to the Billing Counter with this invoice to make payment.',
      20,
      yOffset,
    );
    yOffset += 4;
    doc.text('Payment methods accepted: Cash, POS, Bank Transfer', 20, yOffset);
  }

  // Generate QR code
  const verificationURL = createVerificationURL(
    'invoice',
    data.invoiceNumber,
    data.verificationCode,
  );
  const qrDataURL = verificationURL
    ? await generateQRCodeDataURL(verificationURL)
    : '';

  // Add footer with verification
  addFooter(doc, data.verificationCode, qrDataURL);

  return doc;
}

// =============================================================================
// Helper Functions to Convert DTOs to Print Data
// =============================================================================

/**
 * Convert PaymentDTO to ReceiptData
 */
export function paymentToReceiptData(
  payment: PaymentDTO,
  cashierName: string = 'Cashier',
): ReceiptData {
  const verificationCode = generateVerificationCode(
    payment.payment_id,
    payment.receipt_number,
    payment.amount,
    new Date(payment.created_at),
  );

  // Extract items from the linked invoice
  const items = (payment.invoice?.items || []).map((item: any) => {
    const qty = item.quantity || 1;
    const itemTotal =
      Number(item.total) ||
      Number(item.total_amount) ||
      Number(item.total_price) ||
      Number(item.gross_amount) ||
      0;
    // Always derive unit price: prefer stored value, fall back to total/qty
    const unitPrice =
      Number(item.unit_price) ||
      Number(item.unit_cost) ||
      (itemTotal / qty) ||
      0;
    return {
      description: item.description || item.item_name || 'Service',
      category: item.category || item.item_type || 'Other',
      quantity: qty,
      unitPrice,
      total: itemTotal,
    };
  });

  // If no items, create a single line item
  if (items.length === 0) {
    items.push({
      description: 'Payment received',
      category: 'Payment',
      quantity: 1,
      unitPrice: payment.amount,
      total: payment.amount,
    });
  }

  // Extract patient data including NHIS fields
  const patient = payment.invoice?.patient;
  const insuranceType = (patient?.insurance_type || '') as string;
  // All NHIS types: Military NHIS (DHML is its HMO), Civilian NHIS, GIFSHIP, Security Services NHIS
  const normalizedIns = insuranceType.toLowerCase().replace(/_/g, ' ').trim();
  const isNhisPatient =
    normalizedIns.includes('nhis') ||
    normalizedIns === 'dhml' ||
    normalizedIns === 'gifship';
  const isReferralPatient = patient?.nhis_patient_source === 'Referral';

  // Determine HMO name:
  // - For Military NHIS (DHML is the default HMO): HMO is always "DHML" (Defence Health Maintenance Limited)
  // - For Security Services NHIS: also DHML
  // - For Civilian NHIS / GIFSHIP: HMO is the patient's payer scheme
  let hmoName: string | undefined;
  if (
    normalizedIns === 'dhml' ||
    normalizedIns === 'military nhis' ||
    normalizedIns === 'security services nhis'
  ) {
    hmoName = 'DHML';
  } else if (normalizedIns === 'civilian nhis' || normalizedIns === 'gifship') {
    hmoName = patient?.payer_info?.scheme || undefined;
  }

  return {
    receiptNumber: payment.receipt_number,
    receiptId: payment.payment_id,
    date: new Date(payment.created_at),
    patient: {
      id: patient?.patient_id || '',
      name:
        `${patient?.first_name || ''} ${patient?.surname || ''}`.trim() ||
        'Patient',
      emrNumber: patient?.emr_number || undefined,
      phone: patient?.contact_phone || undefined,
      // NHIS-specific fields
      insuranceType: insuranceType || undefined,
      nhisNumber: isNhisPatient ? patient?.nhis_number || undefined : undefined,
      hmoName,
      patientType: patient?.patient_type || undefined,
      // Referral patient info
      isReferralPatient,
      referralCode: isReferralPatient
        ? patient?.referral_code || undefined
        : undefined,
      referringFacility: isReferralPatient
        ? patient?.referring_facility_name || undefined
        : undefined,
    },
    encounter: payment.invoice?.encounter
      ? {
          id: payment.invoice.encounter.visit_id,
          number:
            payment.invoice.encounter.encounter_number ||
            payment.invoice.encounter.visit_id,
          type: payment.invoice.encounter.visit_type,
        }
      : undefined,
    items,
    subtotal: Number(payment.invoice?.total_amount) || payment.amount,
    discount: 0,
    tax: 0,
    totalAmount: Number(payment.invoice?.total_amount) || payment.amount,
    amountPaid: payment.amount,
    paymentMethod: payment.payment_method || 'Cash',
    referenceNumber: payment.reference_number,
    balance: Math.max(
      0,
      (Number(payment.invoice?.total_amount) || 0) - payment.amount,
    ),
    cashier: {
      name: payment.received_by_staff
        ? `${payment.received_by_staff.first_name} ${payment.received_by_staff.last_name}`
        : cashierName,
    },
    verificationCode,
    invoiceNumbers: payment.invoice?.invoice_number
      ? [payment.invoice.invoice_number]
      : undefined,
  };
}

/**
 * Convert InvoiceDTO to InvoicePrintData
 */
export function invoiceToInvoicePrintData(
  invoice: InvoiceDTO,
): InvoicePrintData {
  const verificationCode = generateVerificationCode(
    invoice.invoice_id,
    invoice.invoice_number,
    invoice.total_amount,
    new Date(invoice.created_at),
  );

  const items = (invoice.items || []).map((item: any) => {
    const qty = item.quantity || 1;
    const itemTotal =
      Number(item.total) ||
      Number(item.total_amount) ||
      Number(item.total_price) ||
      Number(item.gross_amount) ||
      0;
    const unitPrice =
      Number(item.unit_price) ||
      Number(item.unit_cost) ||
      (itemTotal / qty) ||
      0;
    return {
      description: item.description || item.item_name || 'Service',
      category: item.category || item.item_type || 'Other',
      quantity: qty,
      unitPrice,
      discount: Number(item.discount_amount) || 0,
      total: itemTotal,
    };
  });

  return {
    invoiceNumber: invoice.invoice_number,
    invoiceId: invoice.invoice_id,
    date: new Date(invoice.created_at),
    dueDate: invoice.due_date ? new Date(invoice.due_date) : undefined,
    patient: {
      id: invoice.patient?.patient_id || '',
      name:
        `${invoice.patient?.first_name || ''} ${invoice.patient?.surname || ''}`.trim() ||
        'Patient',
      emrNumber: invoice.patient?.emr_number || undefined,
      phone: invoice.patient?.contact_phone || undefined,
    },
    encounter: invoice.encounter
      ? {
          id: invoice.encounter.visit_id,
          number:
            invoice.encounter.encounter_number || invoice.encounter.visit_id,
          type: invoice.encounter.visit_type,
          chiefComplaint: invoice.encounter.chief_complaint,
        }
      : undefined,
    items,
    subtotal: invoice.subtotal || invoice.total_amount,
    discountTotal: invoice.discount_total || 0,
    tax: invoice.tax_amount || 0,
    totalAmount: invoice.total_amount,
    amountPaid: invoice.amount_paid || 0,
    balance: invoice.balance || 0,
    status: invoice.status,
    verificationCode,
    notes: invoice.notes || undefined,
  };
}

// =============================================================================
// Print Functions
// =============================================================================

/**
 * Print receipt for a payment
 */
export async function printReceipt(
  payment: PaymentDTO,
  cashierName?: string,
): Promise<void> {
  try {
    const receiptData = paymentToReceiptData(payment, cashierName);
    const doc = await generateReceiptPDF(receiptData);

    // Open in new window for printing
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } catch (error) {
    log.error('Failed to generate receipt:', error);
    throw error;
  }
}

/**
 * Print invoice
 */
export async function printInvoice(invoice: InvoiceDTO): Promise<void> {
  try {
    const invoiceData = invoiceToInvoicePrintData(invoice);
    const doc = await generateInvoicePDF(invoiceData);

    // Open in new window for printing
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } catch (error) {
    log.error('Failed to generate invoice:', error);
    throw error;
  }
}

/**
 * Download receipt as PDF
 */
export async function downloadReceipt(
  payment: PaymentDTO,
  cashierName?: string,
): Promise<void> {
  try {
    const receiptData = paymentToReceiptData(payment, cashierName);
    const doc = await generateReceiptPDF(receiptData);
    doc.save(`Receipt_${receiptData.receiptNumber}.pdf`);
  } catch (error) {
    log.error('Failed to download receipt:', error);
    throw error;
  }
}

/**
 * Download invoice as PDF
 */
export async function downloadInvoice(invoice: InvoiceDTO): Promise<void> {
  try {
    const invoiceData = invoiceToInvoicePrintData(invoice);
    const doc = await generateInvoicePDF(invoiceData);
    doc.save(`Invoice_${invoiceData.invoiceNumber}.pdf`);
  } catch (error) {
    log.error('Failed to download invoice:', error);
    throw error;
  }
}

/**
 * Open receipt PDF in system default browser/PDF viewer
 * Saves to temp location and opens with system default app
 */
export async function openReceiptInSystemBrowser(
  payment: PaymentDTO,
  cashierName?: string,
): Promise<void> {
  try {
    const receiptData = paymentToReceiptData(payment, cashierName);
    const doc = await generateReceiptPDF(receiptData);

    // Use Electron's IPC to save and open in system default PDF viewer
    if (window.electron?.pdf?.saveAndOpen) {
      const pdfBlob = doc.output('blob');
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfData = Array.from(new Uint8Array(pdfArrayBuffer));
      const filename = `Receipt_${receiptData.receiptNumber}_${Date.now()}.pdf`;

      await window.electron.pdf.saveAndOpen(filename, pdfData);
    } else {
      // Fallback: Open in new window (browser mode)
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    }
  } catch (error) {
    log.error('Failed to open receipt in browser:', error);
    throw error;
  }
}

/**
 * Open invoice PDF in system default browser/PDF viewer
 */
export async function openInvoiceInSystemBrowser(
  invoice: InvoiceDTO,
): Promise<void> {
  try {
    const invoiceData = invoiceToInvoicePrintData(invoice);
    const doc = await generateInvoicePDF(invoiceData);

    if (window.electron?.pdf?.saveAndOpen) {
      const pdfBlob = doc.output('blob');
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfData = Array.from(new Uint8Array(pdfArrayBuffer));
      const filename = `Invoice_${invoiceData.invoiceNumber}_${Date.now()}.pdf`;

      await window.electron.pdf.saveAndOpen(filename, pdfData);
    } else {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    }
  } catch (error) {
    log.error('Failed to open invoice in browser:', error);
    throw error;
  }
}

/**
 * Get receipt data for display in modal (without generating PDF)
 */
export function getReceiptDisplayData(
  payment: PaymentDTO,
  cashierName?: string,
): ReceiptData {
  return paymentToReceiptData(payment, cashierName);
}

/**
 * Get invoice data for display in modal (without generating PDF)
 */
export function getInvoiceDisplayData(invoice: InvoiceDTO): InvoicePrintData {
  return invoiceToInvoicePrintData(invoice);
}

/**
 * Convert BillingOrderDTO to ReceiptData for printing
 * Used after payment verification to generate receipt
 */
export function billingOrderToReceiptData(
  order: {
    id?: string;
    billing_id?: string;
    order_number?: string;
    receipt_number?: string;
    net_amount?: number;
    gross_amount?: number;
    amount_due?: number;
    amount_paid?: number;
    patient_payable?: number;
    nhis_covered?: boolean;
    nhis_percentage?: number;
    nhis_payable?: number;
    payment_method?: string;
    source_module?: string;
    service_description?: string;
    service_type?: string;
    quantity?: number;
    unit_price?: number;
    created_at?: string;
    verified_at?: string;
    patient?: {
      patient_id?: string;
      first_name?: string;
      surname?: string;
      contact_phone?: string;
      emr_number?: string;
      insurance_type?: string;
      nhis_number?: string;
    } | null;
    visit?: {
      visit_id?: string;
      visit_type?: string;
      payment_category?: string;
      insurance_type?: string;
    } | null;
    items?: Array<{
      service_name?: string;
      item_name?: string;
      item_type?: string | null;
      quantity?: number;
      unit_price?: number;
      unit_cost?: number;
      gross_amount?: number;
      total_price?: number;
      nhis_covered?: boolean;
      nhis_percentage?: number;
      nhis_payable?: number;
      patient_payable?: number;
    }>;
  },
  cashierName: string = 'Cashier',
): ReceiptData {
  const receiptNumber =
    order.receipt_number || order.order_number || `RCP-${Date.now()}`;
  const verificationCode = generateVerificationCode(
    order.id || order.billing_id || '',
    receiptNumber,
    order.patient_payable || order.amount_paid || order.net_amount || 0,
    new Date(order.verified_at || order.created_at || new Date().toISOString()),
  );

  // Build items from order items or create single line item
  const items: Array<{
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
    total: number;
    nhis_covered?: boolean;
    nhis_percentage?: number;
    nhis_payable?: number;
    patient_payable?: number;
  }> = [];

  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const qty = item.quantity || 1;
      const itemTotal =
        item.gross_amount ||
        item.total_price ||
        qty * (item.unit_price || item.unit_cost || 0);
      // Always derive unit price: prefer stored value, fall back to total/qty
      const unitPrice =
        item.unit_price || item.unit_cost || (itemTotal / qty) || 0;
      items.push({
        description: item.service_name || item.item_name || 'Service',
        category: item.item_type || order.service_type || 'Other',
        quantity: qty,
        unitPrice,
        total: itemTotal,
        // Per-item NHIS breakdown
        nhis_covered: item.nhis_covered,
        nhis_percentage: item.nhis_percentage,
        nhis_payable: item.nhis_payable,
        patient_payable:
          item.patient_payable ?? itemTotal - (item.nhis_payable || 0),
      });
    }
  } else {
    // Single line item from order
    const qty = order.quantity || 1;
    const itemTotal =
      order.gross_amount || order.net_amount || order.amount_due || 0;
    // Always derive unit price: prefer stored value, fall back to total/qty
    const unitPrice = order.unit_price || (itemTotal / qty) || 0;
    items.push({
      description: order.service_description || order.service_type || 'Service',
      category: order.service_type || order.source_module || 'Other',
      quantity: qty,
      unitPrice,
      total: itemTotal,
      // Per-item NHIS breakdown
      nhis_covered: order.nhis_covered,
      nhis_percentage: order.nhis_percentage,
      nhis_payable: order.nhis_payable,
      patient_payable:
        order.patient_payable ?? itemTotal - (order.nhis_payable || 0),
    });
  }

  const grossAmount =
    order.gross_amount || order.net_amount || order.amount_due || 0;
  const patientPayable = order.patient_payable ?? grossAmount;
  const insuranceType =
    order.visit?.insurance_type || order.patient?.insurance_type || '';
  const normalizedIns = insuranceType.toLowerCase().replace(/_/g, ' ').trim();
  const isNhisPatient =
    normalizedIns !== '' &&
    normalizedIns !== 'private' &&
    normalizedIns !== 'cash' &&
    [
      'dhml',
      'civilian nhis',
      'military nhis',
      'security services nhis',
      'gifship',
      'retainership',
      'corporate',
    ].some((t) => normalizedIns.includes(t));

  return {
    receiptNumber,
    receiptId: order.id || order.billing_id || '',
    date: new Date(
      order.verified_at || order.created_at || new Date().toISOString(),
    ),
    patient: {
      id: order.patient?.patient_id || '',
      name:
        `${order.patient?.first_name || ''} ${order.patient?.surname || ''}`.trim() ||
        'Patient',
      emrNumber: order.patient?.emr_number,
      phone: order.patient?.contact_phone,
      insuranceType: insuranceType || undefined,
      nhisNumber: isNhisPatient ? order.patient?.nhis_number : undefined,
    },
    encounter: order.visit
      ? {
          id: order.visit.visit_id || '',
          number: order.visit.visit_id || '',
          type: order.visit.visit_type,
        }
      : undefined,
    items,
    subtotal: grossAmount,
    discount: 0,
    tax: 0,
    totalAmount: grossAmount,
    amountPaid: patientPayable,
    paymentMethod:
      order.payment_method || (order.nhis_covered ? 'NHIS' : 'Cash'),
    balance: 0,
    cashier: {
      name: cashierName,
    },
    verificationCode,
    // NHIS billing info
    nhisInfo: order.nhis_covered
      ? {
          nhisPercentage: order.nhis_percentage || 0,
          nhisPayable: order.nhis_payable || 0,
          patientPayable: order.patient_payable || 0,
        }
      : undefined,
  };
}

/**
 * Open receipt PDF in browser for a billing order
 * Used after payment verification
 */
export async function openBillingOrderReceiptInBrowser(
  order: Parameters<typeof billingOrderToReceiptData>[0],
  cashierName?: string,
): Promise<void> {
  try {
    const receiptData = billingOrderToReceiptData(order, cashierName);
    const doc = await generateReceiptPDF(receiptData);

    // Use Electron's IPC to save and open in system default PDF viewer
    if (window.electron?.pdf?.saveAndOpen) {
      const pdfBlob = doc.output('blob');
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfData = Array.from(new Uint8Array(pdfArrayBuffer));
      const filename = `Receipt_${receiptData.receiptNumber}_${Date.now()}.pdf`;

      await window.electron.pdf.saveAndOpen(filename, pdfData);
    } else {
      // Fallback: Open in new window (browser mode)
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    }
  } catch (error) {
    log.error('Failed to open billing order receipt in browser:', error);
    throw error;
  }
}
// =============================================================================
// XenoCare Billing Export Utility
// Branded export templates for Excel, CSV, and PDF
// =============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InvoiceDTO, PaymentDTO, formatCurrency } from '../dtos/billing.dto';
import { BillingFilters } from '../components/BillingFilterPanel';
import { ExportType } from '../components/FilteredDataPreview';
import { getFacilityBrand } from '../../../lib/facility';
import {
  APP_POWERED_BY,
  FacilityBrand,
} from '../../../shared/constants/branding';

// App logo stays on the login screen; printed documents carry the facility
// name and colours only.
const ndcLogoSrc = '';
// =============================================================================
// Facility Brand (configurable via Configurations → Facility Settings)
// =============================================================================

export function getBrand(): FacilityBrand {
  return getFacilityBrand(ndcLogoSrc);
}

// =============================================================================
// Export Configuration by Type
// =============================================================================

interface ExportConfig {
  title: string;
  subtitle: string;
  filename: string;
  columns: { key: string; header: string; width?: number }[];
}

/**
 * Generate a filter description string for report headings
 */
function getFilterDescription(filters: BillingFilters): string {
  const parts: string[] = [];

  // Date range
  if (filters.dateFrom && filters.dateTo) {
    parts.push(`${filters.dateFrom} to ${filters.dateTo}`);
  } else if (filters.dateFrom) {
    parts.push(`From ${filters.dateFrom}`);
  } else if (filters.dateTo) {
    parts.push(`Up to ${filters.dateTo}`);
  }

  // Payment method
  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    const methodLabels: Record<string, string> = {
      Cash: 'Cash Payments',
      POS: 'POS/Card Payments',
      Bank_Transfer: 'Bank Transfers',
      Cheque: 'Cheque Payments',
    };
    parts.push(methodLabels[filters.paymentMethod] || filters.paymentMethod);
  }

  // Payment category
  if (filters.paymentCategory && filters.paymentCategory !== 'all') {
    const categoryLabels: Record<string, string> = {
      Cash: 'Cash Category',
      NHIS: 'NHIS',
      DHML: 'DHML',
      Retainership: 'Retainership',
      Private: 'Private/Insurance',
    };
    parts.push(
      categoryLabels[filters.paymentCategory] || filters.paymentCategory,
    );
  }

  // Payment status (outstanding filter)
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    const statusLabels: Record<string, string> = {
      outstanding: 'Outstanding Payments',
      fully_paid: 'Fully Paid',
      overdue: 'Overdue Payments',
    };
    parts.push(statusLabels[filters.paymentStatus] || filters.paymentStatus);
  }

  // Invoice status
  if (filters.invoiceStatus && filters.invoiceStatus !== 'all') {
    const invoiceLabels: Record<string, string> = {
      Draft: 'Draft Invoices',
      Pending: 'Pending Invoices',
      Partial: 'Partially Paid',
      Paid: 'Paid Invoices',
      Overdue: 'Overdue Invoices',
      outstanding: 'Outstanding Invoices',
      Cancelled: 'Cancelled Invoices',
      Refunded: 'Refunded Invoices',
    };
    parts.push(invoiceLabels[filters.invoiceStatus] || filters.invoiceStatus);
  }

  // Department
  if (filters.department && filters.department !== 'all') {
    parts.push(`${filters.department} Department`);
  }

  // Service category
  if (filters.serviceCategory && filters.serviceCategory !== 'all') {
    const serviceLabels: Record<string, string> = {
      Consultation: 'Consultation Services',
      Laboratory: 'Laboratory Tests',
      Radiology: 'Radiology/Imaging',
      Pharmacy: 'Pharmacy/Medications',
      Procedure: 'Procedures',
      Admission: 'Admission/Ward',
      Supplies: 'Medical Supplies',
      Other: 'Other Services',
    };
    parts.push(
      serviceLabels[filters.serviceCategory] || filters.serviceCategory,
    );
  }

  // Patient category
  if (filters.patientCategory && filters.patientCategory !== 'all') {
    const patientLabels: Record<string, string> = {
      OPD: 'Out-Patient (OPD)',
      IPD: 'In-Patient (IPD)',
      Emergency: 'Emergency',
      VIP: 'VIP',
      Staff: 'Staff',
    };
    parts.push(
      patientLabels[filters.patientCategory] || filters.patientCategory,
    );
  }

  // Insurance provider
  if (filters.insuranceProvider && filters.insuranceProvider !== 'all') {
    parts.push(`${filters.insuranceProvider} Provider`);
  }

  // Amount range
  if (filters.amountMin || filters.amountMax) {
    const min = filters.amountMin || '0';
    const max = filters.amountMax || '∞';
    parts.push(`Amount: ₦${min} - ₦${max}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'All Records';
}

/**
 * Generate filename suffix from filters
 */
function getFilterFileSuffix(filters: BillingFilters): string {
  const parts: string[] = [];

  if (filters.department && filters.department !== 'all') {
    parts.push(filters.department.replace(/\s+/g, '_'));
  }
  if (filters.serviceCategory && filters.serviceCategory !== 'all') {
    parts.push(filters.serviceCategory);
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    parts.push(filters.paymentStatus);
  }
  if (filters.paymentCategory && filters.paymentCategory !== 'all') {
    parts.push(filters.paymentCategory);
  }

  return parts.length > 0 ? `_${parts.join('_')}` : '';
}

export const getExportConfig = (
  type: ExportType,
  filters: BillingFilters,
): ExportConfig => {
  const dateStr = new Date().toISOString().split('T')[0];
  const filterDesc = getFilterDescription(filters);
  const fileSuffix = getFilterFileSuffix(filters);
  const dateRange =
    filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom} to ${filters.dateTo}`
      : 'All Time';

  // Expanded column configs for A4 Landscape PDF - wider columns for legibility
  const configs: Record<ExportType, ExportConfig> = {
    payments: {
      title: 'Payment Records Report',
      subtitle: `Payment transactions - ${filterDesc}`,
      filename: `XenoCare_Payments${fileSuffix}_${dateStr}`,
      columns: [
        { key: 'sn', header: 'S/N', width: 25 },
        { key: 'receipt_number', header: 'Receipt No.', width: 75 },
        { key: 'patient_name', header: 'Payer Name', width: 100 },
        { key: 'department', header: 'Department', width: 70 },
        { key: 'services_paid_for', header: 'Services Paid For', width: 120 },
        { key: 'amount', header: 'Amount (₦)', width: 70 },
        { key: 'payment_method', header: 'Pay Method', width: 55 },
        { key: 'received_by', header: 'Received By', width: 80 },
        { key: 'verified_by', header: 'Verified By', width: 80 },
        { key: 'date', header: 'Date', width: 55 },
      ],
    },
    invoices: {
      title: 'Invoice Records Report',
      subtitle: `Invoice records - ${filterDesc}`,
      filename: `XenoCare_Invoices${fileSuffix}_${dateStr}`,
      columns: [
        { key: 'sn', header: 'S/N', width: 25 },
        { key: 'invoice_number', header: 'Invoice No.', width: 75 },
        { key: 'patient_name', header: 'Patient Name', width: 95 },
        { key: 'department', header: 'Department', width: 70 },
        { key: 'services', header: 'Services', width: 110 },
        { key: 'total_amount', header: 'Total (₦)', width: 65 },
        { key: 'amount_paid', header: 'Paid (₦)', width: 65 },
        { key: 'balance', header: 'Balance (₦)', width: 65 },
        { key: 'payment_method', header: 'Pay Method', width: 55 },
        { key: 'requested_by', header: 'Requested By', width: 75 },
        { key: 'status', header: 'Status', width: 50 },
        { key: 'date', header: 'Date', width: 55 },
      ],
    },
    revenue: {
      title: 'Revenue Report',
      subtitle: `Revenue breakdown - ${filterDesc}`,
      filename: `XenoCare_Revenue${fileSuffix}_${dateStr}`,
      columns: [
        { key: 'sn', header: 'S/N', width: 40 },
        { key: 'category', header: 'Category', width: 150 },
        { key: 'count', header: 'Transactions', width: 100 },
        { key: 'total', header: 'Total Revenue (₦)', width: 130 },
        { key: 'percentage', header: '% of Total', width: 90 },
      ],
    },
    outstanding: {
      title: 'Outstanding Payments Report (Debtors List)',
      subtitle: `Unpaid invoices as of ${new Date().toLocaleDateString()} - ${filterDesc}`,
      filename: `XenoCare_Outstanding${fileSuffix}_${dateStr}`,
      columns: [
        { key: 'sn', header: 'S/N', width: 25 },
        { key: 'invoice_number', header: 'Invoice No.', width: 70 },
        { key: 'patient_name', header: 'Debtor Name', width: 90 },
        { key: 'phone', header: 'Phone', width: 70 },
        { key: 'department', header: 'Department', width: 65 },
        { key: 'services', header: 'Services Owed', width: 100 },
        { key: 'total_amount', header: 'Total (₦)', width: 60 },
        { key: 'balance', header: 'Outstanding (₦)', width: 70 },
        { key: 'requested_by', header: 'Requested By', width: 70 },
        { key: 'days_outstanding', header: 'Days', width: 35 },
      ],
    },
    cashier: {
      title: 'Cashier Performance Report',
      subtitle: `Staff transaction summary - ${filterDesc}`,
      filename: `XenoCare_Cashier_Report${fileSuffix}_${dateStr}`,
      columns: [
        { key: 'sn', header: 'S/N', width: 35 },
        { key: 'cashier_name', header: 'Cashier Name', width: 130 },
        { key: 'transaction_count', header: 'Transactions', width: 80 },
        { key: 'total_collected', header: 'Total Collected (₦)', width: 110 },
        { key: 'cash', header: 'Cash (₦)', width: 90 },
        { key: 'pos', header: 'POS (₦)', width: 90 },
        { key: 'transfer', header: 'Transfer (₦)', width: 90 },
      ],
    },
    department: {
      title: 'Department Revenue Report',
      subtitle: `Revenue by department - ${filterDesc}`,
      filename: `XenoCare_Department_Revenue${fileSuffix}_${dateStr}`,
      columns: [
        { key: 'sn', header: 'S/N', width: 35 },
        { key: 'department', header: 'Department', width: 130 },
        { key: 'service_count', header: 'Services', width: 70 },
        { key: 'total_billed', header: 'Total Billed (₦)', width: 100 },
        { key: 'total_collected', header: 'Collected (₦)', width: 100 },
        { key: 'outstanding', header: 'Outstanding (₦)', width: 100 },
        { key: 'percentage', header: '% Revenue', width: 70 },
      ],
    },
    audit: {
      title: 'Audit Trail Report',
      subtitle: `Audit log - ${filterDesc}`,
      filename: `XenoCare_Audit_Report${fileSuffix}_${dateStr}`,
      columns: [
        { key: 'sn', header: 'S/N', width: 35 },
        { key: 'timestamp', header: 'Timestamp', width: 110 },
        { key: 'action', header: 'Action', width: 80 },
        { key: 'reference', header: 'Reference', width: 100 },
        { key: 'patient', header: 'Patient', width: 110 },
        { key: 'amount', header: 'Amount (₦)', width: 85 },
        { key: 'performed_by', header: 'Performed By', width: 100 },
      ],
    },
    summary: {
      title: 'Comprehensive Billing Summary Report',
      subtitle: `All invoices, receipts & NHIS records - ${filterDesc}`,
      filename: `XenoCare_Billing_Summary${fileSuffix}_${dateStr}`,
      columns: [
        { key: 'sn', header: 'S/N', width: 20 },
        { key: 'type', header: 'Type', width: 40 },
        { key: 'reference', header: 'Reference #', width: 70 },
        { key: 'patient_name', header: 'Patient Name', width: 85 },
        { key: 'category', header: 'Category', width: 50 },
        { key: 'services', header: 'Services', width: 95 },
        { key: 'total_amount', header: 'Total (₦)', width: 60 },
        { key: 'amount_paid', header: 'Paid (₦)', width: 60 },
        { key: 'balance', header: 'Balance (₦)', width: 60 },
        { key: 'payment_method', header: 'Pay Method', width: 50 },
        { key: 'status', header: 'Status', width: 45 },
        { key: 'date', header: 'Date', width: 50 },
      ],
    },
  };

  return configs[type];
};

// =============================================================================
// Data Transformation Functions
// =============================================================================

/**
 * Helper function to check if a string looks like a UUID
 */
const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

/**
 * Transform payment data for export
 * MANDATORY FIELDS: verified_by, payment_method, received_by
 * Payments without these fields are excluded from export for audit integrity
 */
export function transformPaymentData(
  payments: PaymentDTO[],
): Record<string, any>[] {
  return payments
    .map((payment, index) => {
      // Extract services/categories from invoice items
      const { invoice } = payment as any;
      const patient = invoice?.patient;
      let servicesPaidFor = 'General Payment';
      let department = 'General';

      if (
        invoice?.items &&
        Array.isArray(invoice.items) &&
        invoice.items.length > 0
      ) {
        // Group items by category - just list categories
        const categories = new Set<string>();
        const departments = new Set<string>();
        invoice.items.forEach((item: any) => {
          const category = item.category || 'Other';
          categories.add(category);
          if (item.department) {
            departments.add(item.department);
          }
        });

        // Format as "Category, Category2" - simple list
        servicesPaidFor =
          Array.from(categories).join(', ') || 'General Payment';
        department =
          Array.from(departments).join(', ') ||
          invoice?.department ||
          'General';
      } else {
        department = invoice?.department || 'General';
      }

      // Extract patient category info
      const patientCategory = patient?.patient_category || 'Private';
      const patientType =
        patient?.patient_type === 'Dependent'
          ? `Dependent${patient?.relationship_to_principal ? ` (${patient.relationship_to_principal})` : ''}`
          : patient?.patient_type || 'Principal';

      // Extract HMO/Insurance info
      const insuranceType = patient?.insurance_type || '';
      const hmoName = patient?.payer_info?.hmo_name || '';
      const hmo = hmoName || insuranceType || 'Self-Pay';

      // =============================================================================
      // MANDATORY FIELD: Verified By (Admin who approved the payment)
      // Must be a valid staff name - UUIDs are not acceptable
      // =============================================================================
      let verifiedBy: string | null = null;
      if ((payment as any).verified_by_staff?.first_name) {
        verifiedBy =
          `${(payment as any).verified_by_staff.first_name} ${(payment as any).verified_by_staff.last_name || ''}`.trim();
      } else if (
        (payment as any).verified_by &&
        !isUUID((payment as any).verified_by)
      ) {
        // Only accept if it's already a name (not a UUID)
        verifiedBy = (payment as any).verified_by;
      }

      // =============================================================================
      // MANDATORY FIELD: Payment Method
      // Must be explicitly captured during payment verification
      // =============================================================================
      const paymentMethod: string | null =
        payment.payment_method || (invoice as any)?.payment_method || null;

      // =============================================================================
      // MANDATORY FIELD: Received By (Staff who processed the payment)
      // Must be a valid staff name
      // =============================================================================
      let receivedBy: string | null = null;
      if (payment.received_by_staff?.first_name) {
        receivedBy =
          `${payment.received_by_staff.first_name} ${payment.received_by_staff.last_name || ''}`.trim();
      }

      // =============================================================================
      // AUDIT INTEGRITY CHECK: Skip records missing mandatory financial fields
      // A payment record is only valid for export if ALL mandatory fields are present
      // =============================================================================
      if (!verifiedBy || !paymentMethod || !receivedBy) {
        console.warn(
          `[BillingExport] Payment ${payment.receipt_number} excluded - missing mandatory fields:`,
          {
            verified_by: verifiedBy || 'MISSING',
            payment_method: paymentMethod || 'MISSING',
            received_by: receivedBy || 'MISSING',
          },
        );
        return null; // Exclude from export
      }

      return {
        sn: index + 1,
        receipt_number: payment.receipt_number,
        patient_name: patient
          ? `${patient.first_name} ${patient.surname}`
          : 'Unknown Patient',
        patient_category: patientCategory,
        patient_type: patientType,
        hmo,
        department,
        invoice_number: invoice?.invoice_number || 'Direct Payment',
        services_paid_for: servicesPaidFor,
        amount: payment.amount,
        payment_method: paymentMethod,
        received_by: receivedBy,
        verified_by: verifiedBy,
        date: new Date(payment.created_at).toLocaleDateString(),
        time: new Date(payment.created_at).toLocaleTimeString(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null) // Remove excluded records
    .map((item, index) => ({ ...item, sn: index + 1 })); // Re-index serial numbers
}

/**
 * Transform invoice data for export
 * For PAID invoices: payment_method and verified_by are MANDATORY
 * For UNPAID/PENDING invoices: requested_by is required
 */
export function transformInvoiceData(
  invoices: InvoiceDTO[],
): Record<string, any>[] {
  return invoices.map((invoice, index) => {
    const { patient } = invoice;

    // Extract services from invoice items
    let services = 'Service';
    let department = 'General';
    if (
      invoice.items &&
      Array.isArray(invoice.items) &&
      invoice.items.length > 0
    ) {
      // List all service names/descriptions
      const serviceList = invoice.items.map((item: any) => {
        const name =
          item.description || item.item_name || item.service_name || 'Service';
        const qty = item.quantity || 1;
        return qty > 1 ? `${name} (x${qty})` : name;
      });
      services = serviceList.join(', ');
      // Truncate if too long for display
      if (services.length > 100) {
        services = `${services.substring(0, 97)}...`;
      }

      // Extract department from items
      const departments = new Set<string>();
      invoice.items.forEach((item: any) => {
        if (item.department) {
          departments.add(item.department);
        }
      });
      department =
        Array.from(departments).join(', ') ||
        (invoice as any).department ||
        'General';
    } else if ((invoice as any)._sourceModule) {
      // For billing orders, use source module as category
      services =
        (invoice as any)._sourceModule
          ?.replace(/_/g, ' ')
          ?.replace(/^\w/, (c: string) => c.toUpperCase()) || 'Service';
      department = (invoice as any).department || 'General';
    }

    // Extract patient category info
    const patientCategory = patient?.patient_category || 'Private';
    const patientType =
      patient?.patient_type === 'Dependent'
        ? `Dependent${patient?.relationship_to_principal ? ` (${patient.relationship_to_principal})` : ''}`
        : patient?.patient_type || 'Principal';

    // Extract HMO/Insurance info
    const insuranceType = patient?.insurance_type || '';
    const hmoName = (patient as any)?.payer_info?.hmo_name || '';
    const hmo = hmoName || insuranceType || 'Self-Pay';

    // =============================================================================
    // MANDATORY FIELD: Requested By (Staff who created the invoice)
    // Must be a valid staff name - UUIDs are not acceptable
    // =============================================================================
    let requestedBy: string | null = null;
    if ((invoice as any).created_by_staff?.first_name) {
      requestedBy =
        `${(invoice as any).created_by_staff.first_name} ${(invoice as any).created_by_staff.last_name || ''}`.trim();
    } else if ((invoice as any).requesting_staff?.first_name) {
      requestedBy =
        `${(invoice as any).requesting_staff.first_name} ${(invoice as any).requesting_staff.last_name || ''}`.trim();
    } else if (
      (invoice as any).created_by &&
      !isUUID((invoice as any).created_by)
    ) {
      // Only accept if it's already a name (not a UUID)
      requestedBy = (invoice as any).created_by;
    }

    // =============================================================================
    // MANDATORY FIELD (for paid invoices): Payment Method
    // Extract from payments array or invoice directly
    // =============================================================================
    const { payments } = invoice as any;
    let paymentMethod: string | null = null;
    let verifiedBy: string | null = null;

    if (payments && Array.isArray(payments) && payments.length > 0) {
      const methods = new Set(
        payments.map((p: any) => p.payment_method).filter(Boolean),
      );
      paymentMethod = methods.size > 0 ? Array.from(methods).join(', ') : null;

      // Extract verified_by from payments
      for (const p of payments) {
        if (p.verified_by_staff?.first_name) {
          verifiedBy =
            `${p.verified_by_staff.first_name} ${p.verified_by_staff.last_name || ''}`.trim();
          break;
        } else if (p.verified_by && !isUUID(p.verified_by)) {
          verifiedBy = p.verified_by;
          break;
        }
      }
    } else if ((invoice as any).payment_method) {
      paymentMethod = (invoice as any).payment_method;
    }

    // For PAID invoices, enforce mandatory payment fields
    const isPaid =
      invoice.status === 'Paid' ||
      invoice.status === 'Paid_NHIS' ||
      invoice.status === 'Paid_Retainership' ||
      (invoice.amount_paid || 0) > 0;

    if (isPaid && (!paymentMethod || !verifiedBy)) {
      console.warn(
        `[BillingExport] Invoice ${invoice.invoice_number} (Paid) excluded - missing mandatory fields:`,
        {
          payment_method: paymentMethod || 'MISSING',
          verified_by: verifiedBy || 'MISSING',
        },
      );
      // For paid invoices, still include but mark fields clearly
      paymentMethod = paymentMethod || 'UNVERIFIED';
      verifiedBy = verifiedBy || 'UNVERIFIED';
    }

    return {
      sn: index + 1,
      invoice_number: invoice.invoice_number,
      patient_name: patient
        ? `${patient.first_name} ${patient.surname}`
        : 'Unknown Patient',
      patient_id: patient?.emr_number || patient?.patient_id || 'Unknown',
      patient_category: patientCategory,
      patient_type: patientType,
      hmo,
      department,
      services,
      total_amount: invoice.total_amount,
      amount_paid: invoice.amount_paid,
      balance: invoice.balance,
      payment_method: paymentMethod || 'Pending',
      requested_by: requestedBy || 'System',
      verified_by: verifiedBy || 'Pending',
      status: invoice.status,
      date: new Date(invoice.created_at).toLocaleDateString(),
    };
  });
}

/**
 * Transform outstanding invoices data with debtor information
 * Excludes NHIS consultations that are fully covered (patient_payable = 0)
 */
export function transformOutstandingData(
  invoices: InvoiceDTO[],
): Record<string, any>[] {
  const today = new Date();

  return invoices
    .filter((invoice) => {
      // Cast to any to access additional fields that may be on the invoice
      const inv = invoice as any;

      // Check if this is a fully covered NHIS consultation
      const isFullyCoveredNhis =
        inv.nhis_covered &&
        (inv.source_module === 'consultation' ||
          inv.service_type === 'Consultation') &&
        (Number(inv.patient_payable) || 0) === 0;

      if (isFullyCoveredNhis) {
        return false; // Don't include in outstanding
      }

      // For NHIS invoices, use patient_payable; for others, use balance
      if (inv.nhis_covered) {
        return (Number(inv.patient_payable) || 0) > 0;
      }

      // Use nullish coalescing to properly handle balance = 0
      const balance =
        invoice.balance ?? invoice.total_amount - (invoice.amount_paid || 0);
      return balance > 0;
    }) // Only invoices with actual outstanding balance
    .map((invoice, index) => {
      const invoiceDate = new Date(invoice.created_at);
      const daysOutstanding = Math.floor(
        (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      // For NHIS, use patient_payable as the balance; otherwise use calculated balance
      const inv = invoice as any;
      const balance = inv.nhis_covered
        ? Number(inv.patient_payable) || 0
        : (invoice.balance ??
          invoice.total_amount - (invoice.amount_paid || 0));

      // Skip if balance is 0 (double-check)
      if (balance <= 0) return null;

      // Extract services from invoice items
      let services = 'Service';
      let department = 'General';
      if (
        invoice.items &&
        Array.isArray(invoice.items) &&
        invoice.items.length > 0
      ) {
        const serviceList = invoice.items.map((item: any) => {
          const name =
            item.description ||
            item.item_name ||
            item.service_name ||
            'Service';
          const qty = item.quantity || 1;
          return qty > 1 ? `${name} (x${qty})` : name;
        });
        services = serviceList.join(', ');
        if (services.length > 80) {
          services = `${services.substring(0, 77)}...`;
        }

        // Extract department from items
        const departments = new Set<string>();
        invoice.items.forEach((item: any) => {
          if (item.department) {
            departments.add(item.department);
          }
        });
        department =
          Array.from(departments).join(', ') || inv.department || 'General';
      } else if ((invoice as any)._sourceModule) {
        services =
          (invoice as any)._sourceModule
            ?.replace(/_/g, ' ')
            ?.replace(/^\w/, (c: string) => c.toUpperCase()) || 'Service';
        department = inv.department || 'General';
      }

      // Extract patient category info
      const { patient } = invoice;
      const patientCategory = patient?.patient_category || 'Private';
      const patientType =
        patient?.patient_type === 'Dependent'
          ? `Dependent${patient?.relationship_to_principal ? ` (${patient.relationship_to_principal})` : ''}`
          : patient?.patient_type || 'Principal';

      // Extract HMO/Insurance info
      const insuranceType = patient?.insurance_type || '';
      const hmoName = (patient as any)?.payer_info?.hmo_name || '';
      const hmo = hmoName || insuranceType || 'Self-Pay';

      // =============================================================================
      // MANDATORY FIELD: Requested By (Staff who created the invoice)
      // Must be a valid staff name - UUIDs are not acceptable
      // =============================================================================
      let requestedBy: string | null = null;
      if (inv.created_by_staff?.first_name) {
        requestedBy =
          `${inv.created_by_staff.first_name} ${inv.created_by_staff.last_name || ''}`.trim();
      } else if (inv.requesting_staff?.first_name) {
        requestedBy =
          `${inv.requesting_staff.first_name} ${inv.requesting_staff.last_name || ''}`.trim();
      } else if (inv.created_by && !isUUID(inv.created_by)) {
        // Only accept if it's already a name (not a UUID)
        requestedBy = inv.created_by;
      }

      return {
        sn: index + 1,
        invoice_number: invoice.invoice_number,
        patient_name: patient
          ? `${patient.first_name} ${patient.surname}`
          : 'Unknown Patient',
        emr_number: patient?.emr_number || 'Unknown',
        phone: patient?.contact_phone || (patient as any)?.phone || 'No Phone',
        patient_category: patientCategory,
        patient_type: patientType,
        hmo,
        department,
        services,
        total_amount: invoice.total_amount,
        amount_paid: invoice.amount_paid || 0,
        balance,
        requested_by: requestedBy || 'System',
        invoice_date: new Date(invoice.created_at).toLocaleDateString(),
        days_outstanding: daysOutstanding,
        status:
          invoice.status || (daysOutstanding > 30 ? 'Overdue' : 'Pending'),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null) // Remove null entries
    .sort((a, b) => b.balance - a.balance) // Sort by highest balance first
    .map((item, index) => ({ ...item, sn: index + 1 })); // Re-index serial numbers
}

/**
 * Transform combined invoices + payments into a comprehensive summary view.
 * Deduplicates by tracking invoice_number ↔ receipt_number pairs so a paid
 * invoice is not listed twice (once as invoice, once as receipt).
 */
export function transformSummaryData(
  combinedData: any[],
): Record<string, any>[] {
  // Track receipt invoice_ids to avoid duplicating fully-paid invoices
  const receiptInvoiceIds = new Set<string>();
  const payments: any[] = [];
  const invoices: any[] = [];

  // Split into invoices and payments
  combinedData.forEach((item) => {
    if ('receipt_number' in item) {
      payments.push(item);
      if (item.invoice_id) receiptInvoiceIds.add(item.invoice_id);
    } else {
      invoices.push(item);
    }
  });

  const rows: Record<string, any>[] = [];

  // Process invoices (skip fully-paid ones that already have receipts)
  invoices.forEach((invoice) => {
    const isPaidWithReceipt =
      receiptInvoiceIds.has(invoice.invoice_id) &&
      (invoice.status === 'Paid' || (invoice as any).status === 'Paid_NHIS' || (invoice as any).status === 'Paid_Retainership');

    if (isPaidWithReceipt) return; // Will be covered by the receipt row

    const patient = invoice.patient;
    const patientCategory = patient?.patient_category || 'Private';

    // Extract services from items
    let services = 'Service';
    if (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
      const serviceList = invoice.items.map((item: any) => {
        const name = item.description || item.item_name || item.service_name || 'Service';
        const qty = item.quantity || 1;
        return qty > 1 ? `${name} (x${qty})` : name;
      });
      services = serviceList.join(', ');
      if (services.length > 80) services = `${services.substring(0, 77)}...`;
    }

    // Get payment method from payments array if available
    let paymentMethod = 'Pending';
    if (invoice.payments && Array.isArray(invoice.payments) && invoice.payments.length > 0) {
      const methods = new Set(invoice.payments.map((p: any) => p.payment_method).filter(Boolean));
      paymentMethod = methods.size > 0 ? Array.from(methods).join(', ') : 'Pending';
    } else if (invoice.payment_method) {
      paymentMethod = invoice.payment_method;
    }

    rows.push({
      type: 'Invoice',
      reference: invoice.invoice_number,
      patient_name: patient ? `${patient.first_name} ${patient.surname}` : 'Unknown',
      category: patientCategory,
      services,
      total_amount: invoice.total_amount || 0,
      amount_paid: invoice.amount_paid || 0,
      balance: invoice.balance ?? (invoice.total_amount - (invoice.amount_paid || 0)),
      payment_method: paymentMethod,
      status: invoice.status || 'Pending',
      date: new Date(invoice.created_at).toLocaleDateString(),
      _sortDate: new Date(invoice.created_at).getTime(),
    });
  });

  // Process payments/receipts
  payments.forEach((payment) => {
    const invoice = payment.invoice;
    const patient = invoice?.patient || payment.patient;
    const patientCategory = patient?.patient_category || 'Private';

    let services = 'General Payment';
    if (invoice?.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
      const categories = new Set<string>();
      invoice.items.forEach((item: any) => categories.add(item.category || 'Other'));
      services = Array.from(categories).join(', ') || 'General Payment';
    }

    rows.push({
      type: 'Receipt',
      reference: payment.receipt_number,
      patient_name: patient ? `${patient.first_name} ${patient.surname}` : 'Unknown',
      category: patientCategory,
      services,
      total_amount: payment.amount || 0,
      amount_paid: payment.amount || 0,
      balance: 0,
      payment_method: payment.payment_method || 'N/A',
      status: 'Paid',
      date: new Date(payment.created_at).toLocaleDateString(),
      _sortDate: new Date(payment.created_at).getTime(),
    });
  });

  // Sort by date descending (newest first) and assign serial numbers
  return rows
    .sort((a, b) => b._sortDate - a._sortDate)
    .map((row, index) => ({ sn: index + 1, ...row }));
}

/**
 * Calculate daily revenue summary for PDF export
 */
export function calculateDailyRevenueSummary(
  data: Record<string, any>[],
  exportType?: string,
): {
  totalRevenue: number;
  totalOutstanding: number;
  totalCollected: number;
  recordCount: number;
} {
  let totalRevenue = 0;
  let totalOutstanding = 0;
  let totalCollected = 0;

  data.forEach((item) => {
    // For summary export - type field distinguishes Invoice vs Receipt
    if (exportType === 'summary') {
      if (item.type === 'Invoice') {
        totalRevenue += parseFloat(item.total_amount) || 0;
        totalCollected += parseFloat(item.amount_paid) || 0;
        totalOutstanding += parseFloat(item.balance) || 0;
      } else if (item.type === 'Receipt') {
        totalCollected += parseFloat(item.amount_paid) || 0;
      }
    }
    // For payments export - only use amount field (this is the actual payment)
    else if (exportType === 'payments') {
      totalCollected += parseFloat(item.amount) || 0;
    }
    // For invoices or outstanding - use invoice fields
    else if (item.total_amount !== undefined) {
      totalRevenue += parseFloat(item.total_amount) || 0;
      totalCollected += parseFloat(item.amount_paid) || 0;
      totalOutstanding += parseFloat(item.balance) || 0;
    }
    // Fallback for other types with amount field
    else if (item.amount !== undefined) {
      totalCollected += parseFloat(item.amount) || 0;
    }
  });

  return {
    totalRevenue,
    totalOutstanding,
    totalCollected,
    recordCount: data.length,
  };
}

/**
 * Calculate category breakdown from invoices/payments data
 * Returns totals by service category (Consultation, Laboratory, Radiology, Pharmacy, etc.)
 */
export interface CategoryBreakdown {
  category: string;
  count: number;
  totalAmount: number;
  amountPaid: number;
  outstanding: number;
}

export function calculateCategoryBreakdown(
  originalData: InvoiceDTO[] | PaymentDTO[] | any[],
  exportType?: string,
): CategoryBreakdown[] {
  const categoryMap = new Map<string, CategoryBreakdown>();

  // Initialize with standard categories
  const defaultCategories = [
    'Consultation',
    'Laboratory',
    'Radiology',
    'Pharmacy',
    'Nursing',
    'Procedure',
    'Admission',
    'Supplies',
    'Other',
  ];

  if (exportType === 'payments') {
    // For payments, we need to look at the linked invoice items
    (originalData as PaymentDTO[]).forEach((payment) => {
      const { invoice } = payment as any;
      if (invoice?.items && Array.isArray(invoice.items)) {
        invoice.items.forEach((item: any) => {
          const category = item.category || 'Other';
          const existing = categoryMap.get(category) || {
            category,
            count: 0,
            totalAmount: 0,
            amountPaid: 0,
            outstanding: 0,
          };
          existing.count += 1;
          existing.totalAmount += Number(item.total) || 0;
          // Proportionally allocate payment to items
          const invoiceTotal = invoice.total_amount || 1;
          const itemProportion = (Number(item.total) || 0) / invoiceTotal;
          existing.amountPaid += (Number(payment.amount) || 0) * itemProportion;
          categoryMap.set(category, existing);
        });
      } else {
        // If no items, use 'Other' category
        const category = 'Other';
        const existing = categoryMap.get(category) || {
          category,
          count: 0,
          totalAmount: 0,
          amountPaid: 0,
          outstanding: 0,
        };
        existing.count += 1;
        existing.amountPaid += Number(payment.amount) || 0;
        categoryMap.set(category, existing);
      }
    });
  } else {
    // For invoices/outstanding, aggregate from invoice items
    (originalData as InvoiceDTO[]).forEach((invoice) => {
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach((item: any) => {
          const category = item.category || 'Other';
          const existing = categoryMap.get(category) || {
            category,
            count: 0,
            totalAmount: 0,
            amountPaid: 0,
            outstanding: 0,
          };
          existing.count += 1;
          existing.totalAmount += Number(item.total) || 0;
          // Proportionally allocate paid amount to items
          const invoiceTotal = invoice.total_amount || 1;
          const itemProportion = (Number(item.total) || 0) / invoiceTotal;
          existing.amountPaid +=
            (Number(invoice.amount_paid) || 0) * itemProportion;
          existing.outstanding +=
            (Number(item.total) || 0) *
            (1 - (Number(invoice.amount_paid) || 0) / invoiceTotal);
          categoryMap.set(category, existing);
        });
      } else {
        // If no items, use invoice total as 'Other'
        const category = 'Other';
        const existing = categoryMap.get(category) || {
          category,
          count: 0,
          totalAmount: 0,
          amountPaid: 0,
          outstanding: 0,
        };
        existing.count += 1;
        existing.totalAmount += Number(invoice.total_amount) || 0;
        existing.amountPaid += Number(invoice.amount_paid) || 0;
        existing.outstanding += Number(invoice.balance) || 0;
        categoryMap.set(category, existing);
      }
    });
  }

  // Convert to array and sort by total amount descending
  const result = Array.from(categoryMap.values())
    .filter((cat) => cat.totalAmount > 0 || cat.amountPaid > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return result;
}

// =============================================================================
// CSV Export
// =============================================================================

export function exportToCSV(
  data: Record<string, any>[],
  config: ExportConfig,
  filters: BillingFilters,
  generatedBy?: string,
): void {
  // Build CSV header with branding
  const brandingRows = [
    [getBrand().fullName],
    [getBrand().tagline],
    [getBrand().address],
    [''],
    [config.title],
    [config.subtitle],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Generated By: ${generatedBy || 'System'}`],
    [''],
  ];

  // Column headers
  const headers = config.columns.map((col) => col.header);

  // Data rows
  const dataRows = data.map((row) =>
    config.columns.map((col) => {
      const value = row[col.key];
      // Format currency values
      if (typeof value === 'number' && col.header.includes('(₦)')) {
        return value.toLocaleString('en-NG', { minimumFractionDigits: 2 });
      }
      return value ?? '';
    }),
  );

  // Summary row
  const summaryRows = [[''], [`Total Records: ${data.length}`]];

  // Combine all rows
  const allRows = [...brandingRows, headers, ...dataRows, ...summaryRows];

  // Convert to CSV string
  const csvContent = allRows
    .map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell);
          // Escape quotes and wrap in quotes if contains comma or quote
          if (
            cellStr.includes(',') ||
            cellStr.includes('"') ||
            cellStr.includes('\n')
          ) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(','),
    )
    .join('\n');

  // Download file
  downloadFile(csvContent, `${config.filename}.csv`, 'text/csv;charset=utf-8;');
}

// =============================================================================
// Excel Export (using HTML table format for compatibility)
// =============================================================================

export function exportToExcel(
  data: Record<string, any>[],
  config: ExportConfig,
  filters: BillingFilters,
  generatedBy?: string,
): void {
  // Calculate totals for numeric columns
  const totals: Record<string, number> = {};
  config.columns.forEach((col) => {
    if (
      col.header.includes('(₦)') ||
      col.header.includes('Transactions') ||
      col.header.includes('Services')
    ) {
      totals[col.key] = data.reduce(
        (sum, row) => sum + (parseFloat(row[col.key]) || 0),
        0,
      );
    }
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Calibri', 'Arial', sans-serif; }
    .header { background-color: ${getBrand().colors.primary}; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0; font-size: 14px; opacity: 0.9; }
    .report-title { background-color: ${getBrand().colors.accent}; color: white; padding: 15px; margin-top: 10px; }
    .report-title h2 { margin: 0; font-size: 18px; }
    .report-title p { margin: 5px 0 0 0; font-size: 12px; opacity: 0.9; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th { background-color: ${getBrand().colors.secondary}; color: white; padding: 12px 8px; text-align: left; font-size: 12px; font-weight: bold; border: 1px solid ${getBrand().colors.border}; }
    td { padding: 10px 8px; border: 1px solid ${getBrand().colors.border}; font-size: 11px; }
    tr:nth-child(even) { background-color: #f8fafc; }
    tr:hover { background-color: #e2e8f0; }
    .amount { text-align: right; font-family: 'Consolas', monospace; }
    .status-paid { color: ${getBrand().colors.success}; font-weight: bold; }
    .status-pending { color: ${getBrand().colors.warning}; font-weight: bold; }
    .status-overdue { color: ${getBrand().colors.danger}; font-weight: bold; }
    .totals-row { background-color: ${getBrand().colors.primary} !important; color: white; font-weight: bold; }
    .totals-row td { border-color: ${getBrand().colors.secondary}; }
    .footer { margin-top: 20px; padding: 15px; background-color: #f1f5f9; border-top: 2px solid ${getBrand().colors.primary}; font-size: 11px; color: ${getBrand().colors.textLight}; }
    .footer p { margin: 3px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${getBrand().fullName}</h1>
    <p>${getBrand().tagline}</p>
    <p>${getBrand().address}</p>
    <p>Tel: ${getBrand().phone} | Email: ${getBrand().email}</p>
  </div>
  
  <div class="report-title">
    <h2>${config.title}</h2>
    <p>${config.subtitle}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        ${config.columns.map((col) => `<th>${col.header}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (row) => `
        <tr>
          ${config.columns
            .map((col) => {
              let value = row[col.key];
              let className = '';

              // Format currency
              if (typeof value === 'number' && col.header.includes('(₦)')) {
                value = `₦${value.toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                })}`;
                className = 'amount';
              }

              // Style status
              if (col.key === 'status') {
                if (value === 'Paid') className = 'status-paid';
                else if (value === 'Pending' || value === 'Partial')
                  className = 'status-pending';
                else if (value === 'Overdue') className = 'status-overdue';
              }

              return `<td class="${className}">${value ?? ''}</td>`;
            })
            .join('')}
        </tr>
      `,
        )
        .join('')}
      <tr class="totals-row">
        ${config.columns
          .map((col, index) => {
            if (index === 0) return '<td>TOTALS</td>';
            if (totals[col.key] !== undefined) {
              const formatted = col.header.includes('(₦)')
                ? `₦${totals[col.key].toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                  })}`
                : totals[col.key].toLocaleString();
              return `<td class="amount">${formatted}</td>`;
            }
            return '<td></td>';
          })
          .join('')}
      </tr>
    </tbody>
  </table>
  
  <div class="footer">
    <p><strong>Report Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Records:</strong> ${data.length}</p>
    <p><strong>Generated By:</strong> ${generatedBy || 'System'}</p>
    <p style="margin-top: 10px; font-style: italic;">This is a computer-generated report. For queries, please contact the Billing Department.</p>
  </div>
</body>
</html>
  `.trim();

  // For true Excel format, we use the HTML table format which Excel can open
  downloadFile(
    htmlContent,
    `${config.filename}.xls`,
    'application/vnd.ms-excel',
  );
}

// =============================================================================
// PDF Export (using jsPDF for direct file download)
// =============================================================================

// XenoCare logo as base64 - will be loaded dynamically
let ndcLogoBase64: string | null = null;

// Printed documents carry no app logo, so there is none to embed.
async function loadLogoAsBase64(): Promise<string | null> {
  return null;
}

function tryLoadImage(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      resolve(null);
    }, 3000); // 3 second timeout

    img.onload = () => {
      clearTimeout(timeout);
      try {
        // Create a circular/rounded logo
        const size = Math.max(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Create circular clipping path
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          // Fill with white background for transparency
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);

          // Draw the image centered
          const offsetX = (size - img.width) / 2;
          const offsetY = (size - img.height) / 2;
          ctx.drawImage(img, offsetX, offsetY, img.width, img.height);

          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    img.src = src;
  });
}

// Helper function to format currency without special characters
function formatCurrencyForPDF(value: number): string {
  // Format number with commas and 2 decimal places
  const formatted = value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `NGN ${formatted}`;
}

function formatCurrencyShort(value: number): string {
  // Format number with commas, no decimal places
  const formatted = Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `NGN ${formatted}`;
}

export async function exportToPDF(
  data: Record<string, any>[],
  config: ExportConfig,
  filters: BillingFilters,
  generatedBy?: string,
  exportType?: string,
  categoryBreakdown?: CategoryBreakdown[],
): Promise<void> {
  // Load logo if not already loaded
  if (!ndcLogoBase64) {
    ndcLogoBase64 = await loadLogoAsBase64();
  }

  // Create PDF document in landscape orientation for A4
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Calculate totals for numeric columns
  const totals: Record<string, number> = {};
  config.columns.forEach((col) => {
    if (
      col.header.includes('(NGN)') ||
      col.header.includes('Transactions') ||
      col.header.includes('Services')
    ) {
      totals[col.key] = data.reduce(
        (sum, row) => sum + (parseFloat(row[col.key]) || 0),
        0,
      );
    }
  });

  // ===== HEADER SECTION - BOLD AND LEGIBLE =====
  doc.setFillColor(22, 101, 52); // Green-800
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Add logo if available
  if (ndcLogoBase64) {
    try {
      doc.addImage(ndcLogoBase64, 'PNG', margin, 3, 16, 16);
    } catch (e) {
      // Logo failed to load, continue without it
    }
  }

  // Hospital name & info - LARGER AND BOLDER
  const textStartX = ndcLogoBase64 ? margin + 20 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(getBrand().fullName, textStartX, 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${getBrand().tagline}`, textStartX, 14);
  doc.text(
    `Tel: ${getBrand().phone} | Email: ${getBrand().email}`,
    textStartX,
    19,
  );

  // Report title on right side of header - BOLD
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(config.title, pageWidth - margin, 9, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
    pageWidth - margin,
    14,
    { align: 'right' },
  );
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Prepared By: ${generatedBy || 'System Administrator'}`,
    pageWidth - margin,
    19,
    { align: 'right' },
  );

  // ===== SUMMARY STATS ROW - LARGER FONTS =====
  doc.setFillColor(240, 253, 244);
  doc.rect(0, 22, pageWidth, 10, 'F');

  const revenueSummary = calculateDailyRevenueSummary(data, exportType);
  let summaryX = margin;
  doc.setFontSize(9);

  // Total Records
  doc.setTextColor(22, 101, 52);
  doc.setFont('helvetica', 'bold');
  doc.text(`Records: ${data.length}`, summaryX, 28);
  summaryX += 40;

  // Total Revenue/Amount
  const totalRevenueDisplay =
    revenueSummary.totalRevenue > 0
      ? revenueSummary.totalRevenue
      : revenueSummary.totalCollected;
  if (totalRevenueDisplay > 0) {
    doc.text(
      `Total: ${formatCurrencyShort(totalRevenueDisplay)}`,
      summaryX,
      28,
    );
    summaryX += 60;
  }

  // Total Collected
  if (revenueSummary.totalCollected > 0 && revenueSummary.totalRevenue > 0) {
    doc.setTextColor(22, 163, 74);
    doc.text(
      `Collected: ${formatCurrencyShort(revenueSummary.totalCollected)}`,
      summaryX,
      28,
    );
    summaryX += 60;
  }

  // Total Outstanding
  if (revenueSummary.totalOutstanding > 0) {
    doc.setTextColor(234, 88, 12);
    doc.text(
      `Outstanding: ${formatCurrencyShort(revenueSummary.totalOutstanding)}`,
      summaryX,
      28,
    );
  }

  // ===== DATA TABLE - LARGER FONTS, BOLD HEADERS =====
  const tableHeaders = config.columns.map((col) =>
    col.header.replace('(₦)', '(NGN)'),
  );
  const tableData = data.map((row) =>
    config.columns.map((col) => {
      const value = row[col.key];
      if (
        typeof value === 'number' &&
        (col.header.includes('(₦)') || col.header.includes('(NGN)'))
      ) {
        return formatCurrencyForPDF(value);
      }
      // Keep longer text for better readability
      if (
        typeof value === 'string' &&
        value.length > 45 &&
        (col.key === 'services' || col.key === 'services_paid_for')
      ) {
        return `${value.substring(0, 42)}...`;
      }
      return value ?? '';
    }),
  );

  // Add totals row
  const totalsRow = config.columns.map((col, index) => {
    if (index === 0) return 'TOTALS';
    if (totals[col.key] !== undefined) {
      return col.header.includes('(₦)') || col.header.includes('(NGN)')
        ? formatCurrencyForPDF(totals[col.key])
        : totals[col.key].toLocaleString();
    }
    return '';
  });
  tableData.push(totalsRow);

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 34,
    margin: { left: margin, right: margin, bottom: 15 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak',
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      minCellHeight: 6,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [21, 128, 61],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 248],
    },
    columnStyles: config.columns.reduce(
      (styles, col, index) => {
        styles[index] = { cellWidth: col.width ? col.width * 0.28 : 'auto' };
        if (col.header.includes('(₦)') || col.header.includes('(NGN)')) {
          styles[index] = {
            ...styles[index],
            halign: 'right',
            fontStyle: 'bold',
            font: 'courier',
          };
        }
        if (col.key === 'sn') {
          styles[index] = {
            ...styles[index],
            halign: 'center',
            fontStyle: 'bold',
          };
        }
        if (col.key === 'patient_name' || col.key === 'received_by') {
          styles[index] = { ...styles[index], fontStyle: 'bold' };
        }
        return styles;
      },
      {} as Record<number, any>,
    ),
    didParseCell: (cellData) => {
      if (
        cellData.section === 'body' &&
        cellData.row.index < tableData.length - 1
      ) {
        const statusColIndex = config.columns.findIndex(
          (c) => c.key === 'status',
        );
        if (cellData.column.index === statusColIndex) {
          const value = String(cellData.cell.raw);
          if (value === 'Paid') {
            cellData.cell.styles.textColor = [22, 163, 74];
            cellData.cell.styles.fontStyle = 'bold';
          } else if (value === 'Pending' || value === 'Partial') {
            cellData.cell.styles.textColor = [234, 88, 12];
            cellData.cell.styles.fontStyle = 'bold';
          } else if (value === 'Overdue') {
            cellData.cell.styles.textColor = [220, 38, 38];
            cellData.cell.styles.fontStyle = 'bold';
          }
        }
      }
      if (
        cellData.section === 'body' &&
        cellData.row.index === tableData.length - 1
      ) {
        cellData.cell.styles.fillColor = [22, 101, 52];
        cellData.cell.styles.textColor = [255, 255, 255];
        cellData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ===== ADDITIONAL TABLES - FILL THE PAGE =====
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  const finalY = (doc as any).lastAutoTable.finalY + 5;

  // Calculate space available
  const availableSpace = pageHeight - finalY - 20;

  // If enough space, add summary tables side by side
  if (
    categoryBreakdown &&
    categoryBreakdown.length > 0 &&
    availableSpace > 25
  ) {
    const thirdWidth = (pageWidth - margin * 4) / 3;

    // === TABLE 1: CATEGORY BREAKDOWN ===
    doc.setFillColor(22, 101, 52);
    doc.rect(margin, finalY, thirdWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('REVENUE BY CATEGORY', margin + 3, finalY + 5);

    const categoryHeaders =
      exportType === 'payments'
        ? ['Category', 'Count', 'Amount (NGN)']
        : ['Category', 'Total (NGN)', 'Paid (NGN)'];

    const categoryData = categoryBreakdown.slice(0, 10).map((cat) => {
      if (exportType === 'payments') {
        return [
          cat.category,
          cat.count.toString(),
          formatCurrencyForPDF(cat.amountPaid),
        ];
      }
      return [
        cat.category,
        formatCurrencyForPDF(cat.totalAmount),
        formatCurrencyForPDF(cat.amountPaid),
      ];
    });

    // Add category totals row
    const categoryTotals = categoryBreakdown.reduce(
      (acc, cat) => ({
        count: acc.count + cat.count,
        totalAmount: acc.totalAmount + cat.totalAmount,
        amountPaid: acc.amountPaid + cat.amountPaid,
        outstanding: acc.outstanding + cat.outstanding,
      }),
      { count: 0, totalAmount: 0, amountPaid: 0, outstanding: 0 },
    );

    const categoryTotalsRow =
      exportType === 'payments'
        ? [
            'TOTAL',
            categoryTotals.count.toString(),
            formatCurrencyForPDF(categoryTotals.amountPaid),
          ]
        : [
            'TOTAL',
            formatCurrencyForPDF(categoryTotals.totalAmount),
            formatCurrencyForPDF(categoryTotals.amountPaid),
          ];
    categoryData.push(categoryTotalsRow);

    autoTable(doc, {
      head: [categoryHeaders],
      body: categoryData,
      startY: finalY + 8,
      margin: { left: margin, right: pageWidth - margin - thirdWidth },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        fontStyle: 'bold',
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { halign: 'right', font: 'courier' },
        2: { halign: 'right', font: 'courier' },
      },
      didParseCell: (cellData) => {
        if (
          cellData.section === 'body' &&
          cellData.row.index === categoryData.length - 1
        ) {
          cellData.cell.styles.fillColor = [59, 130, 246];
          cellData.cell.styles.textColor = [255, 255, 255];
          cellData.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // === TABLE 2: PAYMENT METHOD BREAKDOWN ===
    const methodBreakdown = data.reduce(
      (acc: Record<string, { count: number; amount: number }>, row) => {
        const method = row.payment_method || 'Other';
        if (!acc[method]) acc[method] = { count: 0, amount: 0 };
        acc[method].count++;
        acc[method].amount += parseFloat(row.amount) || 0;
        return acc;
      },
      {},
    );

    const table2X = margin + thirdWidth + margin;
    doc.setFillColor(168, 85, 247);
    doc.rect(table2X, finalY, thirdWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT METHODS', table2X + 3, finalY + 5);

    const methodData = Object.entries(methodBreakdown).map(([method, d]) => [
      method,
      d.count.toString(),
      formatCurrencyForPDF(d.amount),
    ]);
    const methodTotal = Object.values(methodBreakdown).reduce(
      (acc, d) => ({
        count: acc.count + d.count,
        amount: acc.amount + d.amount,
      }),
      { count: 0, amount: 0 },
    );
    methodData.push([
      'TOTAL',
      methodTotal.count.toString(),
      formatCurrencyForPDF(methodTotal.amount),
    ]);

    autoTable(doc, {
      head: [['Method', 'Count', 'Amount (NGN)']],
      body: methodData,
      startY: finalY + 8,
      margin: { left: table2X, right: pageWidth - table2X - thirdWidth },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        fontStyle: 'bold',
      },
      headStyles: {
        fillColor: [168, 85, 247],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [250, 245, 255] },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right', font: 'courier' },
      },
      didParseCell: (cellData) => {
        if (
          cellData.section === 'body' &&
          cellData.row.index === methodData.length - 1
        ) {
          cellData.cell.styles.fillColor = [168, 85, 247];
          cellData.cell.styles.textColor = [255, 255, 255];
          cellData.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // === TABLE 3: DAILY SUMMARY / VERIFICATION ===
    const table3X = margin + (thirdWidth + margin) * 2;
    doc.setFillColor(234, 88, 12);
    doc.rect(table3X, finalY, thirdWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT SUMMARY', table3X + 3, finalY + 5);

    const summaryData = [
      ['Report Type', config.title],
      ['Total Records', data.length.toString()],
      ['Total Amount', formatCurrencyShort(totalRevenueDisplay)],
      ['Report Date', new Date().toLocaleDateString()],
      ['Report Time', new Date().toLocaleTimeString()],
      ['Prepared By', generatedBy || 'System Administrator'],
      ['Status', 'Generated Successfully'],
    ];

    autoTable(doc, {
      body: summaryData,
      startY: finalY + 8,
      margin: { left: table3X, right: margin },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold', textColor: [107, 114, 128] },
        1: { fontStyle: 'bold', textColor: [17, 24, 39] },
      },
    });
  }

  // ===== SIGNATURE SECTION - IF SPACE AVAILABLE =====
  const currentY = (doc as any).lastAutoTable?.finalY || finalY;
  if (currentY < pageHeight - 25) {
    const sigY = Math.max(currentY + 8, pageHeight - 25);
    const sigWidth = (pageWidth - margin * 4) / 3;

    doc.setDrawColor(22, 101, 52);
    doc.setLineWidth(0.3);

    // Signature lines
    doc.line(margin, sigY, margin + sigWidth, sigY);
    doc.line(
      margin + sigWidth + margin,
      sigY,
      margin + sigWidth * 2 + margin,
      sigY,
    );
    doc.line(margin + (sigWidth + margin) * 2, sigY, pageWidth - margin, sigY);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Prepared By: ${generatedBy || '________________'}`,
      margin,
      sigY + 5,
    );
    doc.text(
      'Verified By: ________________',
      margin + sigWidth + margin,
      sigY + 5,
    );
    doc.text(
      'Approved By: ________________',
      margin + (sigWidth + margin) * 2,
      sigY + 5,
    );
  }

  // ===== PAGE NUMBERS & FOOTER =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Footer line
    doc.setDrawColor(22, 101, 52);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`Reference: ${config.filename}`, margin, pageHeight - 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 6, {
      align: 'center',
    });
    doc.setFont('helvetica', 'normal');
    doc.text(
      `© ${new Date().getFullYear()} ${getBrand().name} - Confidential`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' },
    );
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text(APP_POWERED_BY, margin, pageHeight - 3);
  }

  // Save the PDF
  doc.save(`${config.filename}.pdf`);
}

// =============================================================================
// Print Function
// =============================================================================

export async function printReport(
  data: Record<string, any>[],
  config: ExportConfig,
  filters: BillingFilters,
  generatedBy?: string,
): Promise<void> {
  // Uses the same template as PDF
  await exportToPDF(data, config, filters, generatedBy);
}

// =============================================================================
// Helper Functions
// =============================================================================

function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================================================
// Main Export Function
// =============================================================================

export async function handleExport(
  format: 'excel' | 'csv' | 'pdf',
  type: ExportType,
  data: InvoiceDTO[] | PaymentDTO[] | any[],
  filters: BillingFilters,
  generatedBy?: string,
): Promise<void> {
  const config = getExportConfig(type, filters);

  // Transform data based on type
  let transformedData: Record<string, any>[];

  if (type === 'payments') {
    transformedData = transformPaymentData(data as PaymentDTO[]);
  } else if (type === 'outstanding') {
    // Use special transformer for outstanding report
    transformedData = transformOutstandingData(data as InvoiceDTO[]);
  } else if (type === 'invoices') {
    transformedData = transformInvoiceData(data as InvoiceDTO[]);
  } else if (type === 'summary') {
    transformedData = transformSummaryData(data);
  } else {
    // For other types, use data as-is or apply specific transformation
    transformedData = data.map((item, index) => ({ sn: index + 1, ...item }));
  }

  // Calculate category breakdown from original data for PDF export
  const categoryBreakdown = calculateCategoryBreakdown(data, type);

  switch (format) {
    case 'excel':
      exportToExcel(transformedData, config, filters, generatedBy);
      break;
    case 'csv':
      exportToCSV(transformedData, config, filters, generatedBy);
      break;
    case 'pdf':
      await exportToPDF(
        transformedData,
        config,
        filters,
        generatedBy,
        type,
        categoryBreakdown,
      );
      break;
  }
}

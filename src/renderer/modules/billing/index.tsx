/* eslint-disable react/no-unescaped-entities */
import React, { useState, useMemo } from 'react';
import {
  FileText,
  DollarSign,
  AlertTriangle,
  Clock,
  Plus,
  TrendingUp,
  CreditCard,
  Filter,
  Search,
  Trash2,
  X,
  Printer,
  Eye,
  Download,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  CheckCircle,
  Building,
  Receipt,
  History,
  Settings,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { StatsCard, StatusBadge, Tabs } from '../../components/ui/DataDisplay';
import { Button } from '../../components/ui/FormElements';
import { Modal } from '../../components/ui/Modal';
import { InvoiceList } from './components/InvoiceList';
import { CreateInvoiceForm } from './components/CreateInvoiceForm';
import { RecordPaymentForm } from './components/RecordPaymentForm';
import { InvoiceDetail } from './components/InvoiceDetail';
import { BillingOrdersQueuePanel } from './components/BillingOrdersQueuePanel';
import { VerifyPaymentModal } from './components/VerifyPaymentModal';
import {
  BillingFilterPanel,
  BillingFilters,
  defaultFilters,
  FilterSummaryBadge,
} from './components/BillingFilterPanel';
import {
  FilteredDataPreview,
  ExportType,
} from './components/FilteredDataPreview';
import { BillingSearchModal } from './components/BillingSearchModal';
import {
  useBillingStats,
  usePayments,
  useInvoice,
  useInvoices,
  useDeletePayment,
  useDeleteInvoice,
} from './hooks/useBilling';
import {
  usePendingBillingOrders,
  useBillingSubscription,
} from './hooks/useBillingOrders';
import {
  InvoiceDTO,
  PaymentDTO,
  formatCurrency,
  getPaymentMethodColor,
} from './dtos/billing.dto';
import { useToast } from '../../components/ui/Toast';
import {
  BillingQueueItem,
  BillingOrderDTO,
  isNhisPaymentCategory,
  getEffectiveOutstanding,
  getSourceModuleLabel,
} from './dtos/billing-order.dto';
import { getBillingOrderById } from './api/billing-order.api';
import { handleExport } from './utils/billingExport';
import {
  printReceipt,
  printInvoice,
  downloadReceipt,
  openReceiptInSystemBrowser,
  openBillingOrderReceiptInBrowser,
} from './utils/receiptPrint';
import { ServicePriceManagement } from './components/ServicePriceManagement';
import { ReceiptsList } from './components/ReceiptsList';
import { ApprovedRequestsHistory } from './components/ApprovedRequestsHistory';

import { useAuth } from '../../contexts/AuthContext';
import { isNhisFeatureEnabled } from '../../config/features';
import { useTimeTheme } from '../../hooks/useTimeTheme';
import { InlineGuidance } from '../../components/guidance/InlineGuidance';
import { getFacilityName } from '../../lib/facility';

// Helper to get the stats period label based on filter
const getStatsPeriodLabel = (
  dateFrom?: string | null,
  dateTo?: string | null,
): string => {
  if (!dateFrom && !dateTo) return "Today's";

  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(dateTo) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if it's just today
  if (from && to) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(0, 0, 0, 0);

    if (
      fromDate.getTime() === today.getTime() &&
      toDate.getTime() === today.getTime()
    ) {
      return "Today's";
    }

    // Format the date range
    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
  }

  if (from) {
    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `From ${formatDate(from)}`;
  }

  if (to) {
    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `Until ${formatDate(to)}`;
  }

  return "Today's";
};

export default function Billing() {
  // Enable real-time updates
  useBillingSubscription();

  const { hasRole, staff } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('queue');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDTO | null>(
    null,
  );
  const [selectedInvoiceIdForPayment, setSelectedInvoiceIdForPayment] =
    useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
  const [selectedBillingQueueItem, setSelectedBillingQueueItem] =
    useState<BillingQueueItem | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Filter panel state
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<BillingFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<BillingFilters>(defaultFilters);

  // Export preview state
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('invoices');

  // Quick export format selection state
  const [quickExportType, setQuickExportType] = useState<
    'invoices' | 'outstanding' | null
  >(null);

  // Single unified search
  const [searchTerm, setSearchTerm] = useState('');

  // Search modal state
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<'payment' | 'invoice'>(
    'payment',
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItemName, setDeleteItemName] = useState<string>('');

  // Receipt view modal state
  const [showReceiptView, setShowReceiptView] = useState(false);
  const [selectedPaymentForView, setSelectedPaymentForView] =
    useState<PaymentDTO | null>(null);

  // Auto-receipt popup state (for verified billing orders)
  const [showAutoReceiptPopup, setShowAutoReceiptPopup] = useState(false);
  const [verifiedOrdersForReceipt, setVerifiedOrdersForReceipt] = useState<
    BillingOrderDTO[]
  >([]);

  // Direct receipt view modal (shown when clicking "View Receipts" button)
  const [showDirectReceiptModal, setShowDirectReceiptModal] = useState(false);
  const [selectedReceiptForView, setSelectedReceiptForView] =
    useState<BillingOrderDTO | null>(null);

  const { data: stats } = useBillingStats({
    dateFrom: appliedFilters.dateFrom || undefined,
    dateTo: appliedFilters.dateTo || undefined,
  });
  const { data: recentPayments, isLoading: loadingPayments } = usePayments({
    payment_method:
      appliedFilters.paymentMethod !== 'all'
        ? (appliedFilters.paymentMethod as any)
        : undefined,
    from_date: appliedFilters.dateFrom || undefined,
    to_date: appliedFilters.dateTo || undefined,
  });
  const { data: allInvoices } = useInvoices({
    status:
      appliedFilters.invoiceStatus !== 'all'
        ? (appliedFilters.invoiceStatus as any)
        : undefined,
    from_date: appliedFilters.dateFrom || undefined,
    to_date: appliedFilters.dateTo || undefined,
  });
  // Fetch pending billing orders for accurate outstanding count
  const { data: pendingBillingOrders } = usePendingBillingOrders();

  // Fetch full invoice with items when recording payment
  const { data: fullInvoiceForPayment } = useInvoice(
    selectedInvoiceIdForPayment || '',
  );

  // Delete mutations
  const deletePaymentMutation = useDeletePayment();
  const deleteInvoiceMutation = useDeleteInvoice();

  // Filter data based on applied filters and export type
  const filteredData = useMemo(() => {
    // For summary: combine both invoices and payments
    if (exportType === 'summary') {
      const invoices = allInvoices || [];
      const payments = recentPayments || [];
      let combined: any[] = [...invoices, ...payments];

      // Amount range filter
      if (appliedFilters.amountMin || appliedFilters.amountMax) {
        const minAmount = parseFloat(appliedFilters.amountMin) || 0;
        const maxAmount = parseFloat(appliedFilters.amountMax) || Infinity;
        combined = combined.filter((item: any) => {
          const amount = item.amount || item.total_amount || 0;
          return amount >= minAmount && amount <= maxAmount;
        });
      }
      return combined;
    }

    // Use correct data source based on export type
    let data: any[] =
      exportType === 'payments' || exportType === 'revenue'
        ? recentPayments || []
        : allInvoices || [];

    // Additional client-side filtering for amount range
    if (appliedFilters.amountMin || appliedFilters.amountMax) {
      const minAmount = parseFloat(appliedFilters.amountMin) || 0;
      const maxAmount = parseFloat(appliedFilters.amountMax) || Infinity;

      data = data.filter((item: any) => {
        const amount = item.amount || item.total_amount || 0;
        return amount >= minAmount && amount <= maxAmount;
      });
    }

    // Filter for outstanding payments (invoices with balance > 0)
    if (
      appliedFilters.paymentStatus === 'outstanding' ||
      exportType === 'outstanding'
    ) {
      data = data.filter((item: any) => {
        const balance =
          item.balance ?? item.total_amount - (item.amount_paid || 0);
        return balance > 0;
      });
    } else if (appliedFilters.paymentStatus === 'fully_paid') {
      data = data.filter((item: any) => {
        const balance =
          item.balance ?? item.total_amount - (item.amount_paid || 0);
        return balance <= 0 || item.status === 'Paid';
      });
    } else if (appliedFilters.paymentStatus === 'overdue') {
      const today = new Date();
      data = data.filter((item: any) => {
        const balance =
          item.balance ?? item.total_amount - (item.amount_paid || 0);
        const invoiceDate = new Date(item.created_at);
        const daysOutstanding = Math.floor(
          (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return (
          balance > 0 && (daysOutstanding > 30 || item.status === 'Overdue')
        );
      });
    }

    return data;
  }, [exportType, allInvoices, recentPayments, appliedFilters]);

  // Filtered invoices for display and export
  const filteredInvoices = useMemo(() => {
    let data = allInvoices || [];

    // Amount range filter (from filter panel)
    if (appliedFilters.amountMin || appliedFilters.amountMax) {
      const minAmount = parseFloat(appliedFilters.amountMin) || 0;
      const maxAmount = parseFloat(appliedFilters.amountMax) || Infinity;
      data = data.filter(
        (invoice) =>
          invoice.total_amount >= minAmount &&
          invoice.total_amount <= maxAmount,
      );
    }

    // Filter for outstanding payments (invoices with balance > 0)
    if (appliedFilters.paymentStatus === 'outstanding') {
      data = data.filter((invoice) => {
        const balance =
          invoice.balance ?? invoice.total_amount - (invoice.amount_paid || 0);
        return balance > 0;
      });
    } else if (appliedFilters.paymentStatus === 'fully_paid') {
      data = data.filter((invoice) => {
        const balance =
          invoice.balance ?? invoice.total_amount - (invoice.amount_paid || 0);
        return balance <= 0 || invoice.status === 'Paid';
      });
    } else if (appliedFilters.paymentStatus === 'overdue') {
      const today = new Date();
      data = data.filter((invoice) => {
        const balance =
          invoice.balance ?? invoice.total_amount - (invoice.amount_paid || 0);
        const invoiceDate = new Date(invoice.created_at);
        const daysOutstanding = Math.floor(
          (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return (
          balance > 0 && (daysOutstanding > 30 || invoice.status === 'Overdue')
        );
      });
    }

    // Filter by invoice status (including "outstanding" which means Pending or Partial)
    if (appliedFilters.invoiceStatus === 'outstanding') {
      data = data.filter((invoice) => {
        return (
          invoice.status === 'Pending' ||
          invoice.status === 'Partial' ||
          invoice.status === 'Overdue'
        );
      });
    }

    // Single unified search across all fields
    if (searchTerm) {
      const query = searchTerm.toLowerCase().trim();

      // Build EMR search pattern for numeric searches
      let emrSearchNumber = '';
      if (/^\d+$/.test(query)) {
        // Pad number to match EMR format (e.g., 4 -> 0004, 10 -> 0010)
        emrSearchNumber = query.padStart(4, '0');
      }

      data = data.filter((invoice) => {
        const { patient } = invoice;
        const patientName = patient
          ? `${patient.first_name} ${patient.surname}`.toLowerCase()
          : '';
        const emrNumber = (patient?.emr_number || '').toLowerCase();
        const patientId = (patient?.patient_id || '').toLowerCase();
        const contactPhone = (patient?.contact_phone || '').toLowerCase();
        const invoiceNum = (invoice.invoice_number || '').toLowerCase();
        const status = (invoice.status || '').toLowerCase();
        const amount = invoice.total_amount?.toString() || '';

        // patient number search: allow searching by just the number (1, 0001, 10, etc.)
        let emrMatch = emrNumber.includes(query);
        if (emrSearchNumber && !emrMatch) {
          // Check if EMR ends with the padded number (e.g., NDC-0004 for search "4")
          emrMatch = emrNumber.endsWith(`-${emrSearchNumber}`);
        }

        return (
          patientName.includes(query) ||
          emrMatch ||
          patientId.includes(query) ||
          contactPhone.includes(query) ||
          invoiceNum.includes(query) ||
          status.includes(query) ||
          amount.includes(query)
        );
      });
    }

    // Sort by most recent first (already sorted by API, but ensure it here too)
    data = data.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return data;
  }, [allInvoices, appliedFilters, searchTerm]);

  // Outstanding invoices (legacy invoices with balance > 0) for outstanding reports
  // Excludes NHIS consultations that are fully covered (patient_payable = 0)
  const outstandingInvoices = useMemo(() => {
    return (allInvoices || []).filter((invoice) => {
      // Check if this is a consultation invoice (has consultation_id or items with Consultation category)
      const isConsultation =
        !!invoice.consultation_id ||
        invoice.items?.some((item) => item.category === 'Consultation');

      // Check if this is a fully covered NHIS consultation
      const isFullyCoveredNhis =
        invoice.nhis_covered &&
        isConsultation &&
        (Number(invoice.patient_payable) || 0) === 0;

      if (isFullyCoveredNhis) {
        return false; // Don't include in outstanding
      }

      // For NHIS invoices, use patient_payable; for others, use balance
      if (invoice.nhis_covered) {
        return (Number(invoice.patient_payable) || 0) > 0;
      }

      const balance =
        invoice.balance ?? invoice.total_amount - (invoice.amount_paid || 0);
      return balance > 0;
    });
  }, [allInvoices]);

  // Total outstanding count (includes legacy invoices + pending billing orders)
  // This excludes NHIS consultations that are fully covered (patient_payable = 0)
  const totalOutstandingCount = useMemo(() => {
    const legacyOutstandingCount = outstandingInvoices.length;

    // Count pending billing orders, excluding fully covered NHIS consultations
    // Note: getPendingBillingOrders already filters these out, so just count them
    const billingOrdersCount = (pendingBillingOrders || []).filter((order) => {
      // Double-check: exclude NHIS consultations with patient_payable = 0
      // (This should already be filtered by the API, but ensures consistency)
      const effectiveOutstanding = getEffectiveOutstanding(order);
      return effectiveOutstanding > 0;
    }).length;

    return legacyOutstandingCount + billingOrdersCount;
  }, [outstandingInvoices, pendingBillingOrders]);

  // Total outstanding amount (for display - already calculated in stats)
  const totalOutstandingAmount = useMemo(() => {
    // Legacy invoices outstanding
    const legacyOutstanding = outstandingInvoices.reduce((sum, inv) => {
      return sum + (inv.balance ?? inv.total_amount - (inv.amount_paid || 0));
    }, 0);

    // Billing orders outstanding (using effective outstanding which considers NHIS)
    const billingOrdersOutstanding = (pendingBillingOrders || []).reduce(
      (sum, order) => {
        return sum + getEffectiveOutstanding(order);
      },
      0,
    );

    return legacyOutstanding + billingOrdersOutstanding;
  }, [outstandingInvoices, pendingBillingOrders]);

  // Handle filter apply
  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setShowFilterPanel(false);
    showToast({ message: 'Filters applied successfully', type: 'success' });
  };

  // Handle filter clear
  const handleClearFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    showToast({ message: 'Filters cleared', type: 'info' });
  };

  // Get current user name for audit trail
  const currentUserName = staff
    ? `${staff.first_name} ${staff.last_name}`
    : 'System';

  // Handle export with preview
  const handleOpenExportPreview = (type: ExportType) => {
    setExportType(type);
    setShowExportPreview(true);
  };

  // Quick export - directly exports based on current filters
  const handleQuickExport = async (
    type: ExportType,
    format: 'excel' | 'csv' | 'pdf' = 'excel',
  ) => {
    let dataToExport: any[];

    if (type === 'outstanding') {
      dataToExport = outstandingInvoices;
    } else {
      dataToExport = filteredInvoices;
    }

    if (!dataToExport || dataToExport.length === 0) {
      showToast({
        message: 'No records to export. Try adjusting your filters.',
        type: 'warning',
      });
      return;
    }

    await handleExport(
      format,
      type,
      dataToExport,
      appliedFilters,
      currentUserName,
    );
    showToast({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} report exported successfully as ${format.toUpperCase()}!`,
      type: 'success',
    });
  };

  // Handle actual export
  const handleDoExport = async (format: 'excel' | 'csv' | 'pdf') => {
    await handleExport(
      format,
      exportType,
      filteredData,
      appliedFilters,
      currentUserName,
    );
    showToast({
      message: `Exporting ${exportType} report as ${format.toUpperCase()}...`,
      type: 'success',
    });
  };

  // Handle print
  const handlePrint = async () => {
    await handleExport(
      'pdf',
      exportType,
      filteredData,
      appliedFilters,
      currentUserName,
    );
  };

  const handleViewInvoice = (invoice: InvoiceDTO) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetail(true);
  };

  const handleRecordPayment = (invoice: InvoiceDTO) => {
    // Fetch the full invoice with items
    setSelectedInvoiceIdForPayment(invoice.invoice_id);
    setShowPaymentForm(true);
  };

  const handlePrintInvoice = async (invoice: InvoiceDTO) => {
    try {
      await printInvoice(invoice);
      showToast({ message: 'Invoice generated successfully', type: 'success' });
    } catch (error) {
      console.error('Print invoice error:', error);
      showToast({ message: 'Failed to generate invoice', type: 'error' });
    }
  };

  const handlePrintReceipt = async (payment: PaymentDTO) => {
    try {
      const cashierName = staff
        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
        : 'Cashier';
      await printReceipt(payment, cashierName);
      showToast({ message: 'Receipt generated successfully', type: 'success' });
    } catch (error) {
      console.error('Print receipt error:', error);
      showToast({ message: 'Failed to generate receipt', type: 'error' });
    }
  };

  const handleDeleteInvoice = (invoice: InvoiceDTO) => {
    setDeleteType('invoice');
    setDeleteId(invoice.invoice_id);
    setDeleteItemName(`Invoice ${invoice.invoice_number}`);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      if (deleteType === 'payment') {
        await deletePaymentMutation.mutateAsync(deleteId);
        showToast({ message: 'Payment deleted successfully', type: 'success' });
      } else {
        await deleteInvoiceMutation.mutateAsync({
          invoiceId: deleteId,
          forceDelete: true,
        });
        showToast({ message: 'Invoice deleted successfully', type: 'success' });
      }
    } catch (error: any) {
      showToast({
        message: error.message || 'Failed to delete',
        type: 'error',
      });
    } finally {
      setShowDeleteConfirm(false);
      setDeleteId(null);
      setDeleteItemName('');
    }
  };

  // Download receipt from modal
  const handleDownloadReceipt = async () => {
    if (!selectedPaymentForView) return;
    try {
      const cashierName = staff
        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
        : 'Cashier';
      await downloadReceipt(selectedPaymentForView, cashierName);
      showToast({
        message: 'Receipt downloaded successfully',
        type: 'success',
      });
    } catch (error) {
      console.error('Download receipt error:', error);
      showToast({ message: 'Failed to download receipt', type: 'error' });
    }
  };

  // Print receipt in system browser from modal
  const handlePrintReceiptInBrowser = async () => {
    if (!selectedPaymentForView) return;
    try {
      const cashierName = staff
        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
        : 'Cashier';
      await openReceiptInSystemBrowser(selectedPaymentForView, cashierName);
      showToast({
        message: 'Opening receipt in PDF viewer...',
        type: 'success',
      });
    } catch (error) {
      console.error('Print receipt error:', error);
      showToast({ message: 'Failed to open receipt', type: 'error' });
    }
  };

  // Handler for auto-receipt popup after payment verification
  // Consolidates individual billing orders into grouped receipts by category+encounter
  const handleVerificationSuccess = async (
    verifiedOrders: BillingOrderDTO[],
  ) => {
    if (verifiedOrders && verifiedOrders.length > 0) {
      // Group orders by source_module + encounter_id to show consolidated receipts
      const groupedMap = new Map<string, BillingOrderDTO>();

      for (const order of verifiedOrders) {
        const module = order.source_module || 'other';
        const encounterId = order.encounter_id || order.visit_id || 'unknown';
        const groupKey = `${module}::${encounterId}`;

        if (!groupedMap.has(groupKey)) {
          // First order becomes the base for this group
          groupedMap.set(groupKey, {
            ...order,
            items: order.items || [],
          });
        } else {
          // Merge subsequent orders' items and amounts into the group
          const existingGroup = groupedMap.get(groupKey)!;
          const existingItems = existingGroup.items || [];
          const newItems = order.items || [];

          groupedMap.set(groupKey, {
            ...existingGroup,
            items: [...existingItems, ...newItems],
            gross_amount:
              (existingGroup.gross_amount || 0) + (order.gross_amount || 0),
            net_amount:
              (existingGroup.net_amount || 0) + (order.net_amount || 0),
            nhis_payable:
              (existingGroup.nhis_payable || 0) + (order.nhis_payable || 0),
            patient_payable:
              (existingGroup.patient_payable || 0) +
              (order.patient_payable || 0),
            amount_due:
              (existingGroup.amount_due || 0) + (order.amount_due || 0),
          });
        }
      }

      const consolidatedReceipts = Array.from(groupedMap.values());

      // Automatically open all receipts in browser for printing
      try {
        const cashierName = staff
          ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
          : 'Cashier';

        for (const receipt of consolidatedReceipts) {
          await openBillingOrderReceiptInBrowser(receipt, cashierName);
        }

        showToast({
          message: `Payment verified! ${consolidatedReceipts.length} receipt(s) opened for printing.`,
          type: 'success',
        });
      } catch (error) {
        console.error('Failed to open receipt(s):', error);
        // Fallback: show popup if opening in browser fails
        setVerifiedOrdersForReceipt(consolidatedReceipts);
        setShowAutoReceiptPopup(true);
        showToast({
          message: `Payment verified! ${consolidatedReceipts.length} receipt(s) generated.`,
          type: 'success',
        });
      }
    }
  };

  const tabs = [
    { id: 'queue', label: 'Queue' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'history', label: 'History' },
    // Show Services tab only to Super Admin
    ...(hasRole(['super_admin'])
      ? [
          {
            id: 'services',
            label: 'Services',
            disabled: false,
          },
        ]
      : []),
    {
      id: 'reports',
      label: 'Reports',
      disabled: !hasRole(['super_admin', 'admin', 'billing_clerk']),
    },
  ];

  const handleVerifyOrders = (item: BillingQueueItem) => {
    // ALWAYS show verification modal - admin must verify all payments including NHIS
    // Even fully covered NHIS consultations need admin verification for audit trail
    setSelectedBillingQueueItem(item);
    setShowVerifyModal(true);
  };

  // Get time-based theme
  const {
    timeOfDay,
    greeting,
    colors: themeColors,
    isNightMode,
  } = useTimeTheme();

  // Get time icon based on time of day
  const TimeIcon = useMemo(() => {
    switch (timeOfDay) {
      case 'morning':
        return Sunrise;
      case 'afternoon':
        return Sun;
      case 'evening':
        return Sunset;
      case 'night':
        return Moon;
      default:
        return Sun;
    }
  }, [timeOfDay]);

  // Dynamic header gradient based on time
  const headerGradient = useMemo(() => {
    return `bg-gradient-to-r ${themeColors.header.gradient}`;
  }, [themeColors]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-6 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold text-slate-900">
                Billing
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Invoices, payments and receipts
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowSearchModal(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Search billing records"
              >
                <Search className="h-5 w-5" />
              </button>
              <FilterSummaryBadge
                filters={appliedFilters}
                onClick={() => setShowFilterPanel(true)}
              />
              <button
                onClick={() => setShowFilterPanel(true)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg border border-gray-200 flex items-center gap-2 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
              {hasRole(['super_admin', 'admin', 'billing_clerk']) && (
                <button
                  onClick={() => handleOpenExportPreview('summary')}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg border border-gray-200 flex items-center gap-2 transition-colors"
                  title="Export comprehensive billing summary"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              )}
              {hasRole(['super_admin', 'admin', 'billing_clerk']) && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 rounded-lg bg-[#E9783F] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#D96A36]"
                >
                  <Plus className="h-4 w-4" />
                  New Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Statistics Row — hidden when Services tab is active (it has its own stats) */}
        {activeTab !== 'services' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {getStatsPeriodLabel(
                  appliedFilters.dateFrom,
                  appliedFilters.dateTo,
                )}{' '}
                Collection
              </span>
              <div className="p-1.5 bg-emerald-50 rounded-lg">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats ? formatCurrency(stats.payments_today) : 'NGN 0'}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">
                Revenue collected
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {getStatsPeriodLabel(
                  appliedFilters.dateFrom,
                  appliedFilters.dateTo,
                )}{' '}
                Pending
              </span>
              <div className="p-1.5 bg-amber-50 rounded-lg">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats ? formatCurrency(stats.outstanding_today || 0) : 'NGN 0'}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowDownRight className="h-3 w-3 text-amber-500" />
              <span className="text-xs text-amber-600 font-medium">
                Awaiting payment
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {getStatsPeriodLabel(
                  appliedFilters.dateFrom,
                  appliedFilters.dateTo,
                )}{' '}
                Invoices
              </span>
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.invoices_today || 0}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-gray-500">Total generated</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-red-100 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Total Outstanding
              </span>
              <div className="p-1.5 bg-red-50 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {stats ? formatCurrency(stats.outstanding) : 'NGN 0'}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-red-500 font-medium">
                {totalOutstandingCount} unpaid
              </span>
            </div>
          </div>
        </div>
        )}

        {/* Tabs & Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50/50 px-4 pt-2">
            <Tabs
              activeTab={activeTab}
              onChange={setActiveTab}
              variant="underline"
              tabs={[
                {
                  id: 'queue',
                  label: 'Payment Queue',
                  icon: <ClipboardList className="h-4 w-4" />,
                },
                {
                  id: 'invoices',
                  label: 'Invoices',
                  icon: <FileText className="h-4 w-4" />,
                },
                {
                  id: 'receipts',
                  label: 'Receipts',
                  icon: <Receipt className="h-4 w-4" />,
                },
                {
                  id: 'history',
                  label: 'History',
                  icon: <History className="h-4 w-4" />,
                },
                ...(hasRole(['super_admin'])
                  ? [
                      {
                        id: 'services',
                        label: 'Services',
                        icon: <Settings className="h-4 w-4" />,
                      },
                    ]
                  : []),
                {
                  id: 'reports',
                  label: 'Reports',
                  icon: <BarChart3 className="h-4 w-4" />,
                  disabled: !hasRole(['super_admin', 'admin', 'billing_clerk']),
                },
              ]}
            />
          </div>

          <div className="p-5">
            {activeTab === 'queue' && (
              <div className="space-y-4">
                <BillingOrdersQueuePanel
                  onSelectItem={(item) => setSelectedBillingQueueItem(item)}
                  onVerifyPayment={handleVerifyOrders}
                  selectedVisitId={selectedBillingQueueItem?.visit_id}
                />
              </div>
            )}

            {activeTab === 'invoices' && (
              <InvoiceList
                onViewInvoice={handleViewInvoice}
                onRecordPayment={handleRecordPayment}
                onPrintInvoice={handlePrintInvoice}
                onDeleteInvoice={handleDeleteInvoice}
                externalFilters={{
                  status:
                    appliedFilters.invoiceStatus !== 'all'
                      ? (appliedFilters.invoiceStatus as any)
                      : undefined,
                  from_date: appliedFilters.dateFrom || undefined,
                  to_date: appliedFilters.dateTo || undefined,
                }}
              />
            )}

            {activeTab === 'reports' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    onClick={() => handleOpenExportPreview('summary')}
                    className="group p-5 bg-white border border-gray-200 hover:border-emerald-300 rounded-xl text-left transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-emerald-50 group-hover:bg-emerald-100 rounded-lg transition-colors">
                        <BarChart3 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Comprehensive Summary
                    </h3>
                    <p className="text-sm text-gray-500">
                      All invoices, receipts & payments
                    </p>
                  </button>
                  <button
                    onClick={() => handleOpenExportPreview('invoices')}
                    className="group p-5 bg-white border border-gray-200 hover:border-blue-300 rounded-xl text-left transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-50 group-hover:bg-blue-100 rounded-lg transition-colors">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-blue-500 transition-colors" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Invoice Report
                    </h3>
                    <p className="text-sm text-gray-500">
                      All invoices with status and balances
                    </p>
                  </button>
                  <button
                    onClick={() => handleOpenExportPreview('payments')}
                    className="group p-5 bg-white border border-gray-200 hover:border-green-300 rounded-xl text-left transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-50 group-hover:bg-green-100 rounded-lg transition-colors">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-green-500 transition-colors" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Revenue Report
                    </h3>
                    <p className="text-sm text-gray-500">
                      Payment receipts and revenue collected
                    </p>
                  </button>
                  <button
                    onClick={() => handleOpenExportPreview('outstanding')}
                    className="group p-5 bg-white border border-gray-200 hover:border-amber-300 rounded-xl text-left transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-amber-50 group-hover:bg-amber-100 rounded-lg transition-colors">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-gray-300 ml-auto group-hover:text-amber-500 transition-colors" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Outstanding Report
                    </h3>
                    <p className="text-sm text-gray-500">
                      Unpaid and overdue invoices (debtors)
                    </p>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'services' && <ServicePriceManagement />}

            {/* Receipts Tab */}
            {activeTab === 'receipts' && (
              <div>
                <ReceiptsList />
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                <ApprovedRequestsHistory
                  title="All Approved Requests History"
                  showModuleFilter
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Invoice Modal - For manual invoice creation if needed */}
      <CreateInvoiceForm
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false);
        }}
        onSuccess={(invoice) => {
          if (invoice) {
            setSelectedInvoiceIdForPayment(invoice.invoice_id);
            setShowPaymentForm(true);
          }
        }}
      />

      <VerifyPaymentModal
        isOpen={showVerifyModal && !!selectedBillingQueueItem}
        onClose={() => {
          setShowVerifyModal(false);
          setSelectedBillingQueueItem(null);
        }}
        orders={selectedBillingQueueItem?.orders || []}
        patientName={
          selectedBillingQueueItem
            ? `${selectedBillingQueueItem.patient.first_name} ${selectedBillingQueueItem.patient.surname}`
            : ''
        }
        paymentCategory={
          selectedBillingQueueItem?.visit.insurance_type ||
          selectedBillingQueueItem?.patient?.insurance_type ||
          selectedBillingQueueItem?.visit.payment_category ||
          'Cash'
        }
        onVerificationSuccess={handleVerificationSuccess}
      />

      {/* Record Payment Modal */}
      <RecordPaymentForm
        isOpen={showPaymentForm}
        onClose={() => {
          setShowPaymentForm(false);
          setSelectedInvoiceIdForPayment(null);
        }}
        invoice={fullInvoiceForPayment}
      />

      {/* Invoice Detail Slide-over */}
      <InvoiceDetail
        invoice={selectedInvoice}
        isOpen={showInvoiceDetail}
        onClose={() => {
          setShowInvoiceDetail(false);
          setSelectedInvoice(null);
        }}
        onRecordPayment={() => {
          setShowInvoiceDetail(false);
          setShowPaymentForm(true);
        }}
        onPrint={() => handlePrintInvoice(selectedInvoice!)}
      />

      {/* Slide-out Filter Panel */}
      <BillingFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Filtered Data Preview Modal */}
      <FilteredDataPreview
        isOpen={showExportPreview}
        onClose={() => setShowExportPreview(false)}
        exportType={exportType}
        filters={appliedFilters}
        data={filteredData}
        isLoading={loadingPayments}
        onExport={handleDoExport}
        onPrint={handlePrint}
      />

      {/* Billing Search Modal */}
      <BillingSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        payments={recentPayments || []}
        invoices={allInvoices || []}
        isLoading={loadingPayments}
        onViewInvoice={(invoice) => {
          setShowSearchModal(false);
          handleViewInvoice(invoice);
        }}
        onRecordPayment={(invoice) => {
          setShowSearchModal(false);
          handleRecordPayment(invoice);
        }}
        onPrintReceipt={(payment) => {
          handlePrintReceipt(payment);
        }}
        fetchBillingOrder={getBillingOrderById}
        onVerifyPayment={(invoice, billingOrder) => {
          setShowSearchModal(false);
          // Create a BillingQueueItem-like structure for the VerifyPaymentModal
          const queueItem: BillingQueueItem = {
            patient_id: invoice.patient_id || '',
            visit_id:
              invoice.consultation_id || billingOrder.encounter_id || '',
            patient: {
              first_name: invoice.patient?.first_name || '',
              surname: invoice.patient?.surname || '',
              contact_phone: invoice.patient?.contact_phone || undefined,
            },
            visit: {
              visit_type: invoice.encounter?.visit_type || 'Outpatient',
              payment_category: billingOrder.visit?.payment_category || 'Cash',
              insurance_type:
                billingOrder.visit?.insurance_type ||
                billingOrder.patient?.insurance_type,
              priority: billingOrder.visit?.priority || 'Routine',
              start_time: billingOrder.created_at,
            },
            orders: [billingOrder],
            total_gross_amount: billingOrder.total_amount,
            total_nhis_payable: 0,
            total_patient_payable: billingOrder.net_amount,
            total_amount_paid: billingOrder.paid_amount,
            total_balance: billingOrder.balance_amount,
            total_amount_due: billingOrder.net_amount,
            total_paid: billingOrder.paid_amount,
            pending_count:
              billingOrder.status === 'Pending' ||
              billingOrder.status === 'Awaiting_Payment'
                ? 1
                : 0,
            has_pending:
              billingOrder.status === 'Pending' ||
              billingOrder.status === 'Awaiting_Payment',
            is_nhis: isNhisPaymentCategory(
              billingOrder.visit?.insurance_type ||
                billingOrder.patient?.insurance_type ||
                billingOrder.visit?.payment_category,
            ),
            nhis_percentage: 0,
          };
          setSelectedBillingQueueItem(queueItem);
          setShowVerifyModal(true);
        }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={`${isNightMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden`}
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3
                    className={`text-lg font-semibold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                  >
                    Confirm Delete
                  </h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <p
                className={`${isNightMode ? 'text-slate-300' : 'text-gray-700'} mb-6`}
              >
                Are you sure you want to delete{' '}
                <span className="font-semibold">{deleteItemName}</span>?
                {deleteType === 'payment' && (
                  <span className="block mt-2 text-sm text-orange-600">
                    This will also update the associated invoice balance.
                  </span>
                )}
                {deleteType === 'invoice' && (
                  <span className="block mt-2 text-sm text-orange-600">
                    This will also delete all related payments and items.
                  </span>
                )}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteId(null);
                    setDeleteItemName('');
                  }}
                  className={`px-4 py-2 ${isNightMode ? 'text-slate-300 bg-slate-700 hover:bg-slate-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'} rounded-lg transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={
                    deletePaymentMutation.isPending ||
                    deleteInvoiceMutation.isPending
                  }
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deletePaymentMutation.isPending ||
                  deleteInvoiceMutation.isPending ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt View Modal */}
      {showReceiptView && selectedPaymentForView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={`${isNightMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden`}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-600 to-green-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Receipt Details
                  </h3>
                  <p className="text-sm text-green-100">
                    {selectedPaymentForView.receipt_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReceiptView(false);
                  setSelectedPaymentForView(null);
                }}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Patient & Receipt Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Patient Information
                  </h4>
                  <div
                    className={`${isNightMode ? 'bg-slate-700' : 'bg-gray-50'} rounded-lg p-4 space-y-2`}
                  >
                    <p
                      className={`font-semibold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                    >
                      {selectedPaymentForView.invoice?.patient?.first_name ||
                        ''}{' '}
                      {selectedPaymentForView.invoice?.patient?.surname || ''}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">EMR #:</span>{' '}
                      <span className="font-bold text-green-700">
                        {selectedPaymentForView.invoice?.patient?.emr_number ||
                          'N/A'}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Phone:</span>{' '}
                      {selectedPaymentForView.invoice?.patient?.contact_phone ||
                        'N/A'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Receipt Information
                  </h4>
                  <div
                    className={`${isNightMode ? 'bg-slate-700' : 'bg-gray-50'} rounded-lg p-4 space-y-2`}
                  >
                    <p
                      className={`text-sm ${isNightMode ? 'text-slate-400' : 'text-gray-600'}`}
                    >
                      <span className="font-medium">Receipt #:</span>{' '}
                      <span
                        className={`font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                      >
                        {selectedPaymentForView.receipt_number}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Invoice #:</span>{' '}
                      {selectedPaymentForView.invoice?.invoice_number || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Date:</span>{' '}
                      {new Date(
                        selectedPaymentForView.created_at,
                      ).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Payment Details
                </h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
                      <p className="text-3xl font-bold text-green-700">
                        {formatCurrency(selectedPaymentForView.amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 mb-1">
                        Payment Method
                      </p>
                      <StatusBadge
                        status={selectedPaymentForView.payment_method}
                        color={getPaymentMethodColor(
                          selectedPaymentForView.payment_method,
                        )}
                      />
                    </div>
                  </div>
                  {selectedPaymentForView.reference_number && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Reference:</span>{' '}
                        {selectedPaymentForView.reference_number}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items if available */}
              {selectedPaymentForView.invoice?.items &&
                selectedPaymentForView.invoice.items.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                      Services Paid For
                    </h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Item
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                              Qty
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                              Unit Price
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedPaymentForView.invoice.items.map(
                            (item: any, index: number) => {
                              const itemTotal =
                                item.total ||
                                item.total_price ||
                                item.gross_amount ||
                                0;
                              const unitPrice =
                                item.unit_price ||
                                item.unit_cost ||
                                item.amount ||
                                (itemTotal / (item.quantity || 1)) ||
                                0;

                              return (
                              <tr
                                key={index}
                                className={
                                  isNightMode
                                    ? 'hover:bg-slate-700'
                                    : 'hover:bg-gray-50'
                                }
                              >
                                <td
                                  className={`px-4 py-2 text-sm ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                                >
                                  {item.description ||
                                    item.item_name ||
                                    'Service'}
                                </td>
                                <td
                                  className={`px-4 py-2 text-sm ${isNightMode ? 'text-slate-400' : 'text-gray-600'} text-right`}
                                >
                                  {item.quantity || 1}
                                </td>
                                <td
                                  className={`px-4 py-2 text-sm ${isNightMode ? 'text-slate-400' : 'text-gray-600'} text-right`}
                                >
                                  {formatCurrency(unitPrice)}
                                </td>
                                <td
                                  className={`px-4 py-2 text-sm font-medium ${isNightMode ? 'text-slate-100' : 'text-gray-900'} text-right`}
                                >
                                  {formatCurrency(
                                    itemTotal ||
                                      (item.quantity || 1) * unitPrice,
                                  )}
                                </td>
                              </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Notes */}
              {selectedPaymentForView.notes && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Notes
                  </h4>
                  <p
                    className={`text-sm ${isNightMode ? 'text-slate-300 bg-slate-700' : 'text-gray-700 bg-gray-50'} rounded-lg p-3`}
                  >
                    {selectedPaymentForView.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className={`px-6 py-4 border-t ${isNightMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}
            >
              <button
                onClick={() => {
                  setShowReceiptView(false);
                  setSelectedPaymentForView(null);
                }}
                className={`px-4 py-2 ${isNightMode ? 'text-slate-300 bg-slate-700 border-slate-600 hover:bg-slate-600' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'} border rounded-lg transition-colors`}
              >
                Close
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadReceipt}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
                <button
                  onClick={handlePrintReceiptInBrowser}
                  className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Receipt Popup after Payment Verification */}
      {showAutoReceiptPopup && verifiedOrdersForReceipt.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className={`${isNightMode ? 'bg-slate-800' : 'bg-white'} rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200`}
          >
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold mb-1">Payment Verified!</h3>
              <p className="text-green-100">
                {verifiedOrdersForReceipt.length} receipt
                {verifiedOrdersForReceipt.length > 1 ? 's' : ''} generated
              </p>
            </div>

            {/* Receipt Details */}
            <div className="p-6">
              <div className="space-y-3 mb-6">
                {verifiedOrdersForReceipt.slice(0, 3).map((order, idx) => (
                  <div
                    key={order.billing_id || idx}
                    className={`flex items-center justify-between p-3 rounded-lg ${isNightMode ? 'bg-slate-700' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${isNightMode ? 'bg-emerald-900' : 'bg-emerald-100'}`}
                      >
                        <FileText
                          className={`h-5 w-5 ${isNightMode ? 'text-emerald-400' : 'text-emerald-600'}`}
                        />
                      </div>
                      <div>
                        <p
                          className={`font-medium text-sm ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                        >
                          {order.receipt_number || `Receipt #${idx + 1}`}
                        </p>
                        <p
                          className={`text-xs ${isNightMode ? 'text-slate-400' : 'text-gray-500'}`}
                        >
                          {order.source_module
                            ?.replace(/_/g, ' ')
                            ?.replace(/^\w/, (c: string) => c.toUpperCase()) ||
                            'Service'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`font-bold ${isNightMode ? 'text-emerald-400' : 'text-emerald-600'}`}
                    >
                      {formatCurrency(
                        order.net_amount || order.amount_due || 0,
                      )}
                    </span>
                  </div>
                ))}
                {verifiedOrdersForReceipt.length > 3 && (
                  <p
                    className={`text-sm text-center ${isNightMode ? 'text-slate-400' : 'text-gray-500'}`}
                  >
                    + {verifiedOrdersForReceipt.length - 3} more receipt(s)
                  </p>
                )}
              </div>

              {/* Patient routed notice */}
              <div
                className={`rounded-lg p-3 mb-6 ${isNightMode ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}
              >
                <p
                  className={`text-sm ${isNightMode ? 'text-blue-300' : 'text-blue-700'} flex items-center gap-2`}
                >
                  <TrendingUp className="h-4 w-4" />
                  Patient has been routed to Nursing
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {/* Print Receipt Button - Opens in browser for printing */}
                <button
                  onClick={async () => {
                    try {
                      const cashierName = staff
                        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
                        : 'Cashier';
                      // Print each verified order's receipt
                      for (const order of verifiedOrdersForReceipt) {
                        await openBillingOrderReceiptInBrowser(
                          order,
                          cashierName,
                        );
                      }
                      showToast({
                        message: 'Opening receipt(s) for printing...',
                        type: 'success',
                      });
                    } catch (error) {
                      console.error('Failed to print receipt:', error);
                      showToast({
                        message: 'Failed to open receipt for printing',
                        type: 'error',
                      });
                    }
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="h-5 w-5" />
                  Print Receipt
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowAutoReceiptPopup(false);
                      setVerifiedOrdersForReceipt([]);
                    }}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                      isNightMode
                        ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <X className="h-4 w-4 inline-block mr-2" />
                    Close
                  </button>
                  <button
                    onClick={() => {
                      // Show the receipt directly in a modal
                      if (verifiedOrdersForReceipt.length > 0) {
                        setSelectedReceiptForView(verifiedOrdersForReceipt[0]);
                        setShowDirectReceiptModal(true);
                      }
                      setShowAutoReceiptPopup(false);
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-colors"
                  >
                    <Eye className="h-4 w-4 inline-block mr-2" />
                    View Receipts
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Receipt View Modal */}
      {showDirectReceiptModal && selectedReceiptForView && (
        <Modal
          isOpen={showDirectReceiptModal}
          onClose={() => {
            setShowDirectReceiptModal(false);
            setSelectedReceiptForView(null);
            setVerifiedOrdersForReceipt([]);
          }}
          title="Payment Receipt"
          size="md"
        >
          <div className="space-y-4">
            {/* Receipt Content */}
            <div className="bg-white border-4 border-green-700 rounded-xl overflow-hidden relative">
              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <span className="text-green-100 text-6xl font-bold transform -rotate-45 whitespace-nowrap tracking-widest opacity-40">
                  XENOCARE VERIFIED
                </span>
              </div>

              {/* Header with Logo */}
              <div className="relative z-10 bg-gradient-to-r from-green-700 to-green-600 text-white p-5">
                <div className="text-center">
                  <h1 className="text-xl font-bold tracking-wide">
                    {getFacilityName().toUpperCase()}
                  </h1>
                  <p className="text-green-200 text-xs tracking-widest uppercase">
                    Excellence in Healthcare
                  </p>
                </div>
                <div className="mt-3 flex justify-center">
                  <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full tracking-wider uppercase">
                    Official Payment Receipt
                  </span>
                </div>
              </div>

              {/* Security Pattern */}
              <div className="h-2 bg-gradient-to-r from-green-700 via-green-500 to-green-700 opacity-50" />

              <div className="relative z-10 p-5">
                {/* Receipt Number */}
                <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-600 rounded-lg p-3 text-center mb-5">
                  <p className="text-xs text-green-700 uppercase tracking-widest font-semibold">
                    Receipt Number
                  </p>
                  <p className="text-xl font-bold font-mono text-green-700 mt-1">
                    {selectedReceiptForView.receipt_number}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-5">
                  <div className="flex justify-between py-2 border-b border-dashed border-gray-300">
                    <span className="text-gray-500 text-sm">Patient Name</span>
                    <span className="font-semibold text-gray-900">
                      {selectedReceiptForView.patient?.first_name}{' '}
                      {selectedReceiptForView.patient?.surname}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-dashed border-gray-300">
                    <span className="text-gray-500 text-sm">Category</span>
                    <span className="font-semibold text-gray-900">
                      {getSourceModuleLabel(
                        selectedReceiptForView.source_module || 'consultation',
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-dashed border-gray-300">
                    <span className="text-gray-500 text-sm">
                      Payment Method
                    </span>
                    <span className="font-semibold text-gray-900">
                      {selectedReceiptForView.payment_method}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-dashed border-gray-300">
                    <span className="text-gray-500 text-sm">Date & Time</span>
                    <span className="font-semibold text-gray-900">
                      {selectedReceiptForView.verified_at
                        ? new Date(
                            selectedReceiptForView.verified_at,
                          ).toLocaleString()
                        : new Date().toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Items List - Shows ALL items in this receipt */}
                {selectedReceiptForView.items &&
                  selectedReceiptForView.items.length > 0 && (
                    <div className="border rounded-lg overflow-hidden mb-5">
                      <div className="bg-gray-50 px-3 py-2 border-b">
                        <h4 className="font-semibold text-gray-900 text-sm">
                          Items ({selectedReceiptForView.items.length})
                        </h4>
                      </div>
                      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                        {selectedReceiptForView.items.map(
                          (item: any, idx: number) => (
                            <div
                              key={item.id || idx}
                              className="px-4 py-3 flex justify-between items-center"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {item.item_name || item.service_name}
                                </p>
                                {(item.quantity || 1) > 1 && (
                                  <p className="text-xs text-gray-500">
                                    Qty: {item.quantity} ×{' '}
                                    {formatCurrency(
                                      item.unit_price || item.unit_cost || 0,
                                    )}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900">
                                  {formatCurrency(
                                    item.total_price || item.gross_amount || 0,
                                  )}
                                </p>
                                {isNhisFeatureEnabled() && (item.nhis_payable || 0) > 0 && (
                                  <p className="text-xs text-green-600">
                                    NHIS: -{formatCurrency(item.nhis_payable)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                {/* NHIS Breakdown (if applicable) */}
                {isNhisFeatureEnabled() && selectedReceiptForView.nhis_covered && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-5">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
                      <Building className="h-4 w-4 text-emerald-600" />
                      <span className="font-semibold text-emerald-800">
                        NHIS Coverage Applied
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Service Cost:</span>
                      <span className="font-medium">
                        {formatCurrency(
                          selectedReceiptForView.gross_amount ||
                            selectedReceiptForView.amount_due ||
                            0,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>
                        NHIS Covers (
                        {selectedReceiptForView.nhis_percentage || 0}%):
                      </span>
                      <span className="font-medium">
                        -
                        {formatCurrency(
                          selectedReceiptForView.nhis_payable || 0,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2 pt-2 border-t border-emerald-200">
                      <span className="font-semibold text-gray-900">
                        Patient Payable:
                      </span>
                      <span
                        className={`font-bold ${selectedReceiptForView.patient_payable === 0 ? 'text-emerald-600' : 'text-gray-900'}`}
                      >
                        {selectedReceiptForView.patient_payable === 0
                          ? '₦0 (Fully Covered)'
                          : formatCurrency(
                              selectedReceiptForView.patient_payable ||
                                selectedReceiptForView.amount_due ||
                                0,
                            )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div
                  className={`rounded-lg p-4 text-center text-white ${
                    selectedReceiptForView.nhis_covered &&
                    selectedReceiptForView.patient_payable === 0
                      ? 'bg-gradient-to-r from-emerald-600 to-green-600'
                      : 'bg-gradient-to-r from-green-600 to-green-700'
                  }`}
                >
                  <p className="text-xs uppercase tracking-widest opacity-80 mb-1">
                    {selectedReceiptForView.nhis_covered
                      ? selectedReceiptForView.patient_payable === 0
                        ? 'NHIS Covered - No Payment Required'
                        : 'Patient Paid'
                      : 'Amount Paid'}
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      selectedReceiptForView.patient_payable ||
                        selectedReceiptForView.amount_due ||
                        selectedReceiptForView.net_amount ||
                        0,
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation for multiple receipts */}
            {verifiedOrdersForReceipt.length > 1 && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <span className="text-sm text-gray-600">
                  Receipt{' '}
                  {verifiedOrdersForReceipt.indexOf(selectedReceiptForView) + 1}{' '}
                  of {verifiedOrdersForReceipt.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const currentIndex = verifiedOrdersForReceipt.indexOf(
                        selectedReceiptForView,
                      );
                      const prevIndex =
                        currentIndex > 0
                          ? currentIndex - 1
                          : verifiedOrdersForReceipt.length - 1;
                      setSelectedReceiptForView(
                        verifiedOrdersForReceipt[prevIndex],
                      );
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => {
                      const currentIndex = verifiedOrdersForReceipt.indexOf(
                        selectedReceiptForView,
                      );
                      const nextIndex =
                        currentIndex < verifiedOrdersForReceipt.length - 1
                          ? currentIndex + 1
                          : 0;
                      setSelectedReceiptForView(
                        verifiedOrdersForReceipt[nextIndex],
                      );
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  try {
                    const cashierName = staff
                      ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
                      : 'Cashier';
                    await openBillingOrderReceiptInBrowser(
                      selectedReceiptForView,
                      cashierName,
                    );
                    showToast({
                      message: 'Opening receipt for printing...',
                      type: 'success',
                    });
                  } catch (error) {
                    showToast({
                      message: 'Failed to open receipt',
                      type: 'error',
                    });
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button
                onClick={() => {
                  setShowDirectReceiptModal(false);
                  setSelectedReceiptForView(null);
                  setVerifiedOrdersForReceipt([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

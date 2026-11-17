// =============================================================================
// Receipts List Component
// View, search, print, and download verified payment receipts
// Features: NDC branding, anti-forgery watermarks, security patterns
// Default view: Grouped by service category (Laboratory, Pharmacy, Radiology, etc.)
// =============================================================================

import React, { useState, useRef, useMemo } from 'react';
import {
  Receipt,
  Search,
  Download,
  Printer,
  Eye,
  Calendar,
  Filter,
  X,
  FileText,
  CheckCircle,
  Building,
  CreditCard,
  Banknote,
  RefreshCw,
  Shield,
  QrCode,
  Layers,
  List,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Pill,
  Stethoscope,
  Activity,
  Syringe,
  Bed,
  Package,
  HelpCircle,
  Scan,
} from 'lucide-react';
import { Button, Input, Select } from '../../../components/ui/FormElements';
import { StatusBadge, EmptyState } from '../../../components/ui/DataDisplay';
import { Modal } from '../../../components/ui/Modal';
import { SkeletonTable } from '../../../components/ui/SkeletonLoader';
import { useVerifiedReceipts } from '../hooks/useBillingOrders';
import { useAuth } from '../../../contexts/AuthContext';
import {
  BillingOrderDTO,
  formatCurrency,
  getBillingOrderStatusColor,
  getSourceModuleLabel,
  SOURCE_MODULES,
} from '../dtos/billing-order.dto';
import {
  billingOrderToReceiptData,
  generateReceiptPDF,
} from '../utils/receiptPrint';

import { getFacilityName } from '../../../lib/facility';

// XenoCare logo import
// Category colors and icons
const CATEGORY_CONFIG: Record<
  string,
  { color: string; bgColor: string; icon: React.ComponentType<any> }
> = {
  laboratory: {
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    icon: FlaskConical,
  },
  pharmacy: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: Pill,
  },
  consultation: {
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    icon: Stethoscope,
  },
  nursing: {
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 border-pink-200',
    icon: Activity,
  },
  radiology: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    icon: Scan,
  },
  procedure: {
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    icon: Syringe,
  },
  admission: {
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 border-indigo-200',
    icon: Bed,
  },
  supplies: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    icon: Package,
  },
  other: {
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: HelpCircle,
  },
};

const getCategoryConfig = (category: string | null | undefined) => {
  const key = (category || 'other').toLowerCase();
  return CATEGORY_CONFIG[key] || CATEGORY_CONFIG.other;
};

interface ReceiptsListProps {
  onViewReceipt?: (receipt: BillingOrderDTO) => void;
}

interface CategoryGroup {
  category: string;
  categoryLabel: string;
  receipts: BillingOrderDTO[];
  totalAmount: number;
  nhisAmount: number;
  patientAmount: number;
}

export function ReceiptsList({ onViewReceipt }: ReceiptsListProps) {
  const { staff } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReceipt, setSelectedReceipt] =
    useState<BillingOrderDTO | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  // Default to grouped view - category-based display
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  const printRef = useRef<HTMLDivElement>(null);

  const {
    data: receipts,
    isLoading,
    refetch,
  } = useVerifiedReceipts({
    from_date: dateFrom || undefined,
    to_date: dateTo || undefined,
    payment_method: paymentMethodFilter || undefined,
  });

  // Generate a unique verification hash for anti-forgery
  const generateVerificationHash = (receipt: BillingOrderDTO): string => {
    const data = `${receipt.receipt_number}-${receipt.billing_id}-${receipt.amount_due}-${receipt.verified_at}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash &= hash;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  };

  // Generate QR code data URL (simple pattern representation)
  const generateQRPattern = (receipt: BillingOrderDTO): string => {
    const code = `NDC-${receipt.receipt_number}-${generateVerificationHash(receipt)}`;
    return code;
  };

  // Filter receipts by search query and category
  const filteredReceipts = useMemo(() => {
    return receipts?.filter((receipt) => {
      // Category filter
      if (categoryFilter && receipt.source_module !== categoryFilter) {
        return false;
      }

      // Search query filter
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        receipt.receipt_number?.toLowerCase().includes(query) ||
        receipt.patient?.first_name?.toLowerCase().includes(query) ||
        receipt.patient?.surname?.toLowerCase().includes(query) ||
        receipt.service_description?.toLowerCase().includes(query)
      );
    });
  }, [receipts, searchQuery, categoryFilter]);

  // Group receipts by category (source_module)
  const groupedReceipts = useMemo((): CategoryGroup[] => {
    if (!filteredReceipts) return [];

    const groups = new Map<string, CategoryGroup>();

    for (const receipt of filteredReceipts) {
      const category = receipt.source_module || 'consultation';

      if (!groups.has(category)) {
        groups.set(category, {
          category,
          categoryLabel: getSourceModuleLabel(category as any),
          receipts: [],
          totalAmount: 0,
          nhisAmount: 0,
          patientAmount: 0,
        });
      }

      const group = groups.get(category)!;
      group.receipts.push(receipt);
      group.totalAmount += receipt.gross_amount ?? receipt.amount_due ?? 0;
      group.nhisAmount += receipt.nhis_payable ?? 0;
      group.patientAmount += receipt.patient_payable ?? receipt.amount_due ?? 0;
    }

    // Sort by category label
    return Array.from(groups.values()).sort((a, b) =>
      a.categoryLabel.localeCompare(b.categoryLabel),
    );
  }, [filteredReceipts]);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Expand all categories
  const expandAllCategories = () => {
    setExpandedCategories(new Set(groupedReceipts.map((g) => g.category)));
  };

  // Collapse all categories
  const collapseAllCategories = () => {
    setExpandedCategories(new Set());
  };

  const handleViewReceipt = (receipt: BillingOrderDTO) => {
    setSelectedReceipt(receipt);
    setShowReceiptModal(true);
  };

  // Print receipt using thermal PDF format - opens in system default PDF viewer
  const handlePrintReceipt = async () => {
    if (!selectedReceipt) return;

    try {
      // Use logged-in user's name as the issuer
      const issuerName = staff
        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
        : selectedReceipt.verified_by_staff
          ? `${selectedReceipt.verified_by_staff.first_name || ''} ${selectedReceipt.verified_by_staff.last_name || ''}`.trim()
          : 'System';
      const receiptData = billingOrderToReceiptData(
        selectedReceipt,
        issuerName,
      );
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
      console.error('Failed to print receipt:', error);
    }
  };

  // Download receipt as thermal PDF
  const handleDownloadReceipt = async () => {
    if (!selectedReceipt) return;

    try {
      // Use logged-in user's name as the issuer
      const issuerName = staff
        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
        : selectedReceipt.verified_by_staff
          ? `${selectedReceipt.verified_by_staff.first_name || ''} ${selectedReceipt.verified_by_staff.last_name || ''}`.trim()
          : 'System';
      const receiptData = billingOrderToReceiptData(
        selectedReceipt,
        issuerName,
      );
      const doc = await generateReceiptPDF(receiptData);
      doc.save(`Receipt_${receiptData.receiptNumber}.pdf`);
    } catch (error) {
      console.error('Failed to download receipt:', error);
    }
  };

  const getPaymentMethodIcon = (method?: string) => {
    switch (method) {
      case 'Cash':
        return <Banknote className="h-4 w-4 text-green-600" />;
      case 'POS':
        return <CreditCard className="h-4 w-4 text-blue-600" />;
      case 'NHIS':
      case 'Retainership':
        return <Building className="h-4 w-4 text-purple-600" />;
      default:
        return <CreditCard className="h-4 w-4 text-gray-600" />;
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setPaymentMethodFilter('');
    setCategoryFilter('');
  };

  const hasActiveFilters =
    searchQuery || dateFrom || dateTo || paymentMethodFilter || categoryFilter;

  return (
    <div className="space-y-4">
      {/* Header with View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-green-600" />
          Payment Receipts
        </h2>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Group by category"
            >
              <Layers className="h-4 w-4" />
              Grouped
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Show as list"
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
          {viewMode === 'grouped' && groupedReceipts.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={expandAllCategories}
                className="px-2 py-1 text-xs text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                title="Expand all"
              >
                Expand All
              </button>
              <button
                onClick={collapseAllCategories}
                className="px-2 py-1 text-xs text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                title="Collapse all"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by receipt #, patient name, or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-green-50 border-green-300' : ''}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 bg-green-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700">Filter Receipts</h4>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="POS">POS</option>
                <option value="NHIS">NHIS</option>
                <option value="Retainership">Retainership</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Categories</option>
                {SOURCE_MODULES.map((mod) => (
                  <option key={mod} value={mod}>
                    {getSourceModuleLabel(mod)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {viewMode === 'grouped'
            ? `${groupedReceipts.length} categor${groupedReceipts.length === 1 ? 'y' : 'ies'} • ${filteredReceipts?.length || 0} receipt(s)`
            : `${filteredReceipts?.length || 0} receipt(s) found`}
        </span>
        {filteredReceipts && filteredReceipts.length > 0 && (
          <span className="font-medium text-green-600">
            Total:{' '}
            {formatCurrency(
              filteredReceipts.reduce(
                (sum, r) => sum + (r.patient_payable ?? r.amount_due ?? 0),
                0,
              ),
            )}
          </span>
        )}
      </div>

      {/* Receipts Display - Grouped or List View */}
      {isLoading ? (
        <SkeletonTable rows={8} columns={7} />
      ) : viewMode === 'grouped' ? (
        /* Grouped by Category View (Default) */
        groupedReceipts.length > 0 ? (
          <div className="space-y-4">
            {groupedReceipts.map((group) => {
              const config = getCategoryConfig(group.category);
              const CategoryIcon = config.icon;
              const isExpanded = expandedCategories.has(group.category);

              return (
                <div
                  key={group.category}
                  className={`rounded-lg border ${config.bgColor} overflow-hidden`}
                >
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(group.category)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg bg-white shadow-sm ${config.color}`}
                      >
                        <CategoryIcon className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <h3 className={`font-semibold ${config.color}`}>
                          {group.categoryLabel}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {group.receipts.length} receipt
                          {group.receipts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total</p>
                        <p className={`font-semibold ${config.color}`}>
                          {formatCurrency(group.patientAmount)}
                        </p>
                        {group.nhisAmount > 0 && (
                          <p className="text-xs text-green-600">
                            NHIS: {formatCurrency(group.nhisAmount)}
                          </p>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Receipts List */}
                  {isExpanded && (
                    <div className="bg-white border-t">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                              Receipt #
                            </th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                              Patient
                            </th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                              Service
                            </th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                              Method
                            </th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                              Amount
                            </th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                              Date
                            </th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.receipts.map((receipt) => (
                            <tr
                              key={receipt.billing_id}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-4 py-3">
                                <span className="font-mono text-sm text-gray-900">
                                  {receipt.receipt_number}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-gray-900">
                                  {receipt.patient?.first_name}{' '}
                                  {receipt.patient?.surname}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm text-gray-700 truncate max-w-[200px]">
                                  {receipt.service_description}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  {getPaymentMethodIcon(receipt.payment_method)}
                                  <span className="text-sm text-gray-600">
                                    {receipt.payment_method}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {receipt.nhis_covered ? (
                                  <div>
                                    <span className="text-xs text-gray-400 line-through">
                                      {formatCurrency(
                                        receipt.gross_amount ??
                                          receipt.amount_due ??
                                          0,
                                      )}
                                    </span>
                                    <span className="block font-semibold text-green-600">
                                      {formatCurrency(
                                        receipt.patient_payable ?? 0,
                                      )}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-semibold text-gray-900">
                                    {formatCurrency(receipt.amount_due)}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm text-gray-700">
                                  {receipt.verified_at
                                    ? new Date(
                                        receipt.verified_at,
                                      ).toLocaleDateString()
                                    : 'N/A'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {receipt.verified_at
                                    ? new Date(
                                        receipt.verified_at,
                                      ).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : ''}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleViewReceipt(receipt)}
                                    className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="View Receipt"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Receipt}
            title="No receipts found"
            description={
              hasActiveFilters
                ? 'No receipts match your filters. Try adjusting your search criteria.'
                : 'Verified payment receipts will appear here.'
            }
          />
        )
      ) : filteredReceipts && filteredReceipts.length > 0 ? (
        /* List View */
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Receipt #
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Verified
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReceipts.map((receipt) => (
                  <tr
                    key={receipt.billing_id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-green-600" />
                        <span className="font-mono font-medium text-gray-900">
                          {receipt.receipt_number}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {receipt.patient?.first_name}{' '}
                          {receipt.patient?.surname}
                        </p>
                        <p className="text-xs text-gray-500">
                          {receipt.patient?.contact_phone || 'No phone'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-900">
                          {receipt.service_description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getSourceModuleLabel(
                            receipt.source_module || 'consultation',
                          )}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getPaymentMethodIcon(receipt.payment_method)}
                        <span className="text-sm text-gray-700">
                          {receipt.payment_method}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {receipt.nhis_covered ? (
                        <div>
                          <span className="text-xs text-gray-400 line-through">
                            {formatCurrency(
                              receipt.gross_amount ?? receipt.amount_due ?? 0,
                            )}
                          </span>
                          <span className="font-semibold text-green-600 block">
                            {formatCurrency(
                              receipt.patient_payable ?? 0,
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="font-semibold text-green-600">
                          {formatCurrency(receipt.amount_due)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-900">
                          {receipt.verified_at
                            ? new Date(receipt.verified_at).toLocaleDateString()
                            : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {receipt.verified_at
                            ? new Date(receipt.verified_at).toLocaleTimeString(
                                [],
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              )
                            : ''}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewReceipt(receipt)}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="View Receipt"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Receipt}
          title="No receipts found"
          description={
            hasActiveFilters
              ? 'No receipts match your filters. Try adjusting your search criteria.'
              : 'Verified payment receipts will appear here.'
          }
        />
      )}

      {/* Receipt View Modal */}
      {showReceiptModal && selectedReceipt && (
        <Modal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedReceipt(null);
          }}
          title="Payment Receipt"
          size="md"
        >
          <div className="space-y-4">
            {/* Print Content */}
            <div
              ref={printRef}
              className="bg-white border-4 border-green-700 rounded-xl overflow-hidden relative"
            >
              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <span className="text-green-100 text-7xl font-bold transform -rotate-45 whitespace-nowrap tracking-widest opacity-40">
                  XENOCARE VERIFIED
                </span>
              </div>

              {/* Security border pattern */}
              <div className="absolute top-3 left-3 right-3 bottom-3 border border-green-200 rounded-lg pointer-events-none z-0" />

              {/* Header with Logo */}
              <div className="relative z-10 bg-gradient-to-r from-green-700 to-green-600 text-white p-6">
                <div className="flex items-center justify-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg p-1">
                    
                  </div>
                  <div className="text-center">
                    <h1 className="text-2xl font-bold tracking-wide">
                      {getFacilityName().toUpperCase()}
                    </h1>
                    <p className="text-green-200 text-sm tracking-widest uppercase">
                      Excellence in Healthcare
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-center">
                  <span className="bg-white/20 text-white text-xs font-semibold px-4 py-1 rounded-full tracking-wider uppercase">
                    Official Payment Receipt
                  </span>
                </div>
              </div>

              {/* Security Pattern */}
              <div className="h-2 bg-gradient-to-r from-green-700 via-green-500 to-green-700 opacity-50" />

              <div className="relative z-10 p-6">
                {/* Receipt Number */}
                <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-600 rounded-lg p-4 text-center mb-6">
                  <p className="text-xs text-green-700 uppercase tracking-widest font-semibold">
                    Receipt Number
                  </p>
                  <p className="text-2xl font-bold font-mono text-green-700 mt-1">
                    {selectedReceipt.receipt_number}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between py-3 border-b border-dashed border-gray-300">
                    <span className="text-gray-500 text-sm">Patient Name</span>
                    <span className="font-semibold text-gray-900">
                      {selectedReceipt.patient?.first_name}{' '}
                      {selectedReceipt.patient?.surname}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-dashed border-gray-300">
                    <span className="text-gray-500 text-sm">Category</span>
                    <span className="font-semibold text-gray-900">
                      {getSourceModuleLabel(
                        selectedReceipt.source_module || 'consultation',
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-dashed border-gray-300">
                    <span className="text-gray-500 text-sm">
                      Payment Method
                    </span>
                    <span className="font-semibold text-gray-900">
                      {selectedReceipt.payment_method}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-dashed border-gray-300">
                    <span className="text-gray-500 text-sm">Date & Time</span>
                    <span className="font-semibold text-gray-900">
                      {selectedReceipt.verified_at
                        ? new Date(selectedReceipt.verified_at).toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Items List - Shows ALL items in this receipt */}
                {selectedReceipt.items && selectedReceipt.items.length > 0 && (
                  <div className="border rounded-lg overflow-hidden mb-6">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        Items ({selectedReceipt.items.length})
                      </h4>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {selectedReceipt.items.map((item, idx) => {
                        const itemTotal =
                          item.total_price || item.gross_amount || 0;
                        const nhisPercentage = item.nhis_percentage || 0;
                        const nhisPayable = item.nhis_payable || 0;
                        const patientPayable =
                          item.patient_payable ?? itemTotal - nhisPayable;
                        const hasNhis = item.nhis_covered && nhisPercentage > 0;

                        const unitPrice =
                          item.unit_price ||
                          item.unit_cost ||
                          (itemTotal / (item.quantity || 1)) ||
                          0;

                        return (
                          <div key={item.id || idx} className="px-4 py-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {item.item_name || item.service_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {item.quantity > 1
                                    ? `Qty: ${item.quantity} × ${formatCurrency(unitPrice)}`
                                    : `Unit Price: ${formatCurrency(unitPrice)}`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900">
                                  {formatCurrency(itemTotal)}
                                </p>
                              </div>
                            </div>

                            {/* Per-item NHIS breakdown */}
                            {hasNhis && (
                              <div className="mt-2 ml-2 p-2 bg-emerald-50 rounded border border-emerald-100 text-xs">
                                <div className="flex justify-between text-gray-600">
                                  <span>Item Cost:</span>
                                  <span>{formatCurrency(itemTotal)}</span>
                                </div>
                                <div className="flex justify-between text-emerald-600 font-medium">
                                  <span>NHIS {nhisPercentage}% covers:</span>
                                  <span>-{formatCurrency(nhisPayable)}</span>
                                </div>
                                <div className="flex justify-between text-gray-900 font-semibold border-t border-emerald-200 pt-1 mt-1">
                                  <span>Patient Pays:</span>
                                  <span>{formatCurrency(patientPayable)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* NHIS Breakdown (if applicable) */}
                {selectedReceipt.nhis_covered && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
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
                          selectedReceipt.gross_amount ||
                            selectedReceipt.amount_due,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>
                        NHIS Covers ({selectedReceipt.nhis_percentage || 0}%):
                      </span>
                      <span className="font-medium">
                        -{formatCurrency(selectedReceipt.nhis_payable || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2 pt-2 border-t border-emerald-200">
                      <span className="font-semibold text-gray-900">
                        Patient Payable:
                      </span>
                      <span
                        className={`font-bold ${selectedReceipt.patient_payable === 0 ? 'text-emerald-600' : 'text-gray-900'}`}
                      >
                        {selectedReceipt.patient_payable === 0
                          ? '₦0 (Fully Covered)'
                          : formatCurrency(
                              selectedReceipt.patient_payable ||
                                selectedReceipt.amount_due,
                            )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Amount */}
                <div
                  className={`rounded-lg p-5 text-center text-white mb-6 ${
                    selectedReceipt.nhis_covered &&
                    selectedReceipt.patient_payable === 0
                      ? 'bg-gradient-to-r from-emerald-600 to-green-600'
                      : 'bg-gradient-to-r from-green-700 to-green-600'
                  }`}
                >
                  <p className="text-green-200 text-xs uppercase tracking-widest">
                    {selectedReceipt.nhis_covered
                      ? selectedReceipt.patient_payable === 0
                        ? 'NHIS Covered - No Payment Required'
                        : 'Patient Paid'
                      : 'Amount Paid'}
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    {selectedReceipt.nhis_covered &&
                    selectedReceipt.patient_payable === 0
                      ? '₦0'
                      : formatCurrency(
                          selectedReceipt.amount_paid ||
                            selectedReceipt.patient_payable ||
                            selectedReceipt.amount_due,
                        )}
                  </p>
                  {selectedReceipt.nhis_covered &&
                    selectedReceipt.patient_payable === 0 && (
                      <p className="text-green-200 text-xs mt-2">
                        Service Cost of{' '}
                        {formatCurrency(
                          selectedReceipt.gross_amount ||
                            selectedReceipt.amount_due,
                        )}{' '}
                        covered by NHIS
                      </p>
                    )}
                </div>

                {/* Verification Badge */}
                <div className="flex justify-center mb-6">
                  <div className="flex items-center gap-2 bg-green-50 border border-green-300 text-green-700 px-6 py-3 rounded-full">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">
                      Payment Verified & Confirmed
                    </span>
                  </div>
                </div>

                {/* Security Pattern */}
                <div className="h-2 bg-gradient-to-r from-transparent via-green-300 to-transparent rounded-full mb-4" />

                {/* Security Footer */}
                <div className="border-t-2 border-green-700 pt-4">
                  <div className="flex items-start justify-between">
                    {/* QR Pattern Left */}
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 border-2 border-green-700 rounded bg-white p-1">
                        <div className="grid grid-cols-5 gap-0.5 w-full h-full">
                          {[...Array(25)].map((_, i) => (
                            <div
                              key={i}
                              className={`${(i + Math.floor(i / 5)) % 2 === 0 ? 'bg-green-700' : 'bg-white'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-[8px] text-green-700 mt-1 uppercase tracking-wider">
                        Scan to Verify
                      </span>
                    </div>

                    {/* Center Info */}
                    <div className="flex-1 text-center px-4">
                      <p className="text-xs text-gray-500">
                        Verified by:{' '}
                        {selectedReceipt.verified_by_staff?.first_name ||
                          (typeof selectedReceipt.verified_by === 'string' &&
                          !selectedReceipt.verified_by.includes('-')
                            ? selectedReceipt.verified_by
                            : 'System')}{' '}
                        {selectedReceipt.verified_by_staff?.last_name || ''}
                      </p>
                      <p className="text-sm font-semibold text-green-700 mt-2">
                        Thank you for your payment!
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        XenoCare System
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1 bg-green-50 px-2 py-1 rounded text-xs font-mono text-green-700">
                        <Shield className="h-3 w-3" />
                        VER: {generateVerificationHash(selectedReceipt)}
                      </div>
                    </div>

                    {/* QR Pattern Right */}
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 border-2 border-green-700 rounded bg-white p-1">
                        <div className="grid grid-cols-5 gap-0.5 w-full h-full">
                          {[...Array(25)].map((_, i) => (
                            <div
                              key={i}
                              className={`${(i * 3) % 4 === 0 ? 'bg-green-700' : 'bg-white'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-[8px] text-green-700 mt-1 uppercase tracking-wider">
                        XenoCare Official
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="primary"
                onClick={handlePrintReceipt}
                className="flex-1 bg-green-700 hover:bg-green-800"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
              <Button
                variant="secondary"
                onClick={handleDownloadReceipt}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* eslint-disable react/no-unescaped-entities */
import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { BillingFilters } from './BillingFilterPanel';
import { InvoiceDTO, PaymentDTO, formatCurrency } from '../dtos/billing.dto';
import { StatusBadge } from '../../../components/ui/DataDisplay';

// =============================================================================
// Types
// =============================================================================

export type ExportType =
  | 'payments'
  | 'invoices'
  | 'revenue'
  | 'outstanding'
  | 'cashier'
  | 'department'
  | 'audit'
  | 'summary';

interface FilteredDataPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  exportType: ExportType;
  filters: BillingFilters;
  data: InvoiceDTO[] | PaymentDTO[] | any[];
  isLoading: boolean;
  onExport: (format: 'excel' | 'csv' | 'pdf') => void;
  onPrint: () => void;
}

// =============================================================================
// Export Type Configuration
// =============================================================================

const exportTypeConfig: Record<
  ExportType,
  { title: string; description: string; color: string }
> = {
  payments: {
    title: 'Payment Records',
    description: 'All payment transactions matching your filters',
    color: 'green',
  },
  invoices: {
    title: 'Invoice Records',
    description: 'All invoices matching your filters',
    color: 'blue',
  },
  revenue: {
    title: 'Revenue Report',
    description: 'Revenue breakdown by category and period',
    color: 'emerald',
  },
  outstanding: {
    title: 'Outstanding Report',
    description: 'Unpaid and overdue invoices report',
    color: 'orange',
  },
  cashier: {
    title: 'Cashier Report',
    description: 'Transactions processed by cashier/staff',
    color: 'purple',
  },
  department: {
    title: 'Department Revenue',
    description: 'Revenue breakdown by department',
    color: 'cyan',
  },
  audit: {
    title: 'Audit Report',
    description: 'Comprehensive audit trail for accountability',
    color: 'red',
  },
  summary: {
    title: 'Comprehensive Billing Summary',
    description: 'All invoices, receipts & NHIS records — paid and unpaid',
    color: 'emerald',
  },
};

// =============================================================================
// Component
// =============================================================================

export function FilteredDataPreview({
  isOpen,
  onClose,
  exportType,
  filters,
  data,
  isLoading,
  onExport,
  onPrint,
}: FilteredDataPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 10;

  const config = exportTypeConfig[exportType];

  // Filter data by search query
  const filteredData = data.filter((item: any) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();

    // Search across common fields
    return (
      item.invoice_number?.toLowerCase().includes(searchLower) ||
      item.receipt_number?.toLowerCase().includes(searchLower) ||
      item.patient?.first_name?.toLowerCase().includes(searchLower) ||
      item.patient?.surname?.toLowerCase().includes(searchLower) ||
      item.invoice?.patient?.first_name?.toLowerCase().includes(searchLower) ||
      item.invoice?.patient?.surname?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Get filter summary
  const getFilterSummary = () => {
    const activeFilters: string[] = [];

    if (filters.dateFrom || filters.dateTo) {
      activeFilters.push(
        `Date: ${filters.dateFrom || 'Start'} to ${filters.dateTo || 'End'}`,
      );
    }
    if (filters.paymentMethod !== 'all') {
      activeFilters.push(`Method: ${filters.paymentMethod}`);
    }
    if (filters.paymentCategory !== 'all') {
      activeFilters.push(`Category: ${filters.paymentCategory}`);
    }
    if (filters.invoiceStatus !== 'all') {
      activeFilters.push(`Status: ${filters.invoiceStatus}`);
    }
    if (filters.paymentStatus !== 'all') {
      const statusLabels: Record<string, string> = {
        outstanding: 'Outstanding Only',
        fully_paid: 'Fully Paid Only',
        overdue: 'Overdue Only',
      };
      activeFilters.push(
        `Payment Status: ${statusLabels[filters.paymentStatus] || filters.paymentStatus}`,
      );
    }
    if (filters.cashierId !== 'all') {
      activeFilters.push(`Cashier: ${filters.cashierId}`);
    }
    if (filters.department !== 'all') {
      activeFilters.push(`Department: ${filters.department}`);
    }
    if (filters.amountMin || filters.amountMax) {
      activeFilters.push(
        `Amount: ₦${filters.amountMin || '0'} - ₦${filters.amountMax || '∞'}`,
      );
    }

    return activeFilters;
  };

  // Calculate summary stats
  const getSummaryStats = () => {
    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;

    // For summary type, separate invoices and payments to avoid double-counting
    if (exportType === 'summary') {
      const invoices = filteredData.filter((item: any) => 'total_amount' in item && !('receipt_number' in item));
      const payments = filteredData.filter((item: any) => 'receipt_number' in item);

      invoices.forEach((item: any) => {
        totalAmount += item.total_amount || 0;
        pendingAmount += item.balance || 0;
      });
      payments.forEach((item: any) => {
        paidAmount += item.amount || 0;
      });
    } else {
      filteredData.forEach((item: any) => {
        if ('total_amount' in item) {
          totalAmount += item.total_amount || 0;
          paidAmount += item.amount_paid || 0;
          pendingAmount += item.balance || 0;
        } else if ('amount' in item) {
          totalAmount += item.amount || 0;
        }
      });
    }

    return { totalAmount, paidAmount, pendingAmount };
  };

  const stats = getSummaryStats();
  const filterSummary = getFilterSummary();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header with NDC Branding */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-bold">{config.title}</h2>
                <p className="text-blue-100 text-sm">{config.description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-500 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Summary */}
        {filterSummary.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-600">
                Active Filters:
              </span>
              {filterSummary.map((filter, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                >
                  {filter}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats Bar */}
        <div className="px-6 py-3 border-b bg-white">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {filteredData.length}
              </p>
              <p className="text-xs text-gray-500">Total Records</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalAmount)}
              </p>
              <p className="text-xs text-gray-500">{exportType === 'summary' ? 'Total Billed' : 'Total Amount'}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(stats.paidAmount)}
              </p>
              <p className="text-xs text-gray-500">{exportType === 'summary' ? 'Total Collected' : 'Paid'}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(stats.pendingAmount)}
              </p>
              <p className="text-xs text-gray-500">{exportType === 'summary' ? 'Outstanding' : 'Pending'}</p>
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="px-6 py-3 border-b flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search records..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport('excel')}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={() => onExport('csv')}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => onExport('pdf')}
              className="flex items-center gap-2 rounded-lg bg-[#E9783F] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#D96A36]"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              onClick={onPrint}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Eye className="h-16 w-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No records found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    #
                  </th>
                  {exportType === 'summary' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Type
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {exportType === 'payments' ? 'Receipt #' : exportType === 'summary' ? 'Reference #' : 'Invoice #'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {exportType === 'payments' ? 'Method' : exportType === 'summary' ? 'Category' : 'Balance'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedData.map((item: any, index: number) => {
                  const isPayment = 'receipt_number' in item;
                  const patient = isPayment
                    ? item.invoice?.patient
                    : item.patient;

                  return (
                    <tr
                      key={item.payment_id || item.invoice_id || index}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {startIndex + index + 1}
                      </td>
                      {exportType === 'summary' && (
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isPayment
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {isPayment ? 'Receipt' : 'Invoice'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {isPayment ? item.receipt_number : item.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {patient
                          ? `${patient.first_name} ${patient.surname}`
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {formatCurrency(
                          isPayment ? item.amount : item.total_amount,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={isPayment ? 'Completed' : item.status}
                          color={
                            isPayment
                              ? 'green'
                              : item.status === 'Paid'
                                ? 'green'
                                : item.status === 'Partial'
                                  ? 'yellow'
                                  : item.status === 'Pending'
                                    ? 'blue'
                                    : item.status === 'Overdue'
                                      ? 'red'
                                      : 'gray'
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {exportType === 'summary'
                          ? (item.patient?.patient_category || item.invoice?.patient?.patient_category || 'Private')
                          : isPayment
                            ? item.payment_method
                            : formatCurrency(item.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {filteredData.length > 0 && (
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {startIndex + 1} to{' '}
              {Math.min(startIndex + itemsPerPage, filteredData.length)} of{' '}
              {filteredData.length} records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

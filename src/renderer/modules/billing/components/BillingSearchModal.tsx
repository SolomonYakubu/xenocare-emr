/* eslint-disable react/no-unescaped-entities */
import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  User,
  FileText,
  CreditCard,
  Eye,
  DollarSign,
  Printer,
  ChevronRight,
  Receipt,
  Calendar,
  Phone,
  Hash,
  Activity,
  Link2,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import {
  formatCurrency,
  getPaymentMethodColor,
  InvoiceDTO,
  PaymentDTO,
} from '../dtos/billing.dto';
import { StatusBadge } from '../../../components/ui/DataDisplay';
import { BillingOrderDTO } from '../dtos/billing-order.dto';

interface BillingSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentDTO[];
  invoices: InvoiceDTO[];
  isLoading?: boolean;
  onViewInvoice: (invoice: InvoiceDTO) => void;
  onRecordPayment: (invoice: InvoiceDTO) => void;
  onPrintReceipt: (payment: PaymentDTO) => void;
  onVerifyPayment?: (
    invoice: InvoiceDTO,
    billingOrder: BillingOrderDTO,
  ) => void;
  fetchBillingOrder?: (billingOrderId: string) => Promise<BillingOrderDTO>;
}

type SearchTab = 'all' | 'payments' | 'invoices';

export function BillingSearchModal({
  isOpen,
  onClose,
  payments,
  invoices,
  isLoading = false,
  onViewInvoice,
  onRecordPayment,
  onPrintReceipt,
  onVerifyPayment,
  fetchBillingOrder,
}: BillingSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [selectedPayment, setSelectedPayment] = useState<PaymentDTO | null>(
    null,
  );
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDTO | null>(
    null,
  );
  const [isVerifying, setIsVerifying] = useState(false);

  // Filter results based on search query - patient number is the primary key
  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();

    return payments.filter((payment) => {
      const patient = payment.invoice?.patient;
      const encounter = payment.invoice?.encounter;
      const patientName = patient
        ? `${patient.first_name} ${patient.surname}`.toLowerCase()
        : '';
      const emrNumber = (patient?.emr_number || '').toLowerCase();
      const phone = (patient?.contact_phone || '').toLowerCase();
      const receiptNum = (payment.receipt_number || '').toLowerCase();
      const invoiceNum = (payment.invoice?.invoice_number || '').toLowerCase();
      const encounterNum = (encounter?.encounter_number || '').toLowerCase();
      const amount = payment.amount?.toString() || '';

      return (
        emrNumber.includes(query) || // patient number is primary search key
        patientName.includes(query) ||
        encounterNum.includes(query) ||
        phone.includes(query) ||
        receiptNum.includes(query) ||
        invoiceNum.includes(query) ||
        amount.includes(query)
      );
    });
  }, [payments, searchQuery]);

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();

    return invoices.filter((invoice) => {
      const { patient } = invoice;
      const { encounter } = invoice;
      const patientName = patient
        ? `${patient.first_name} ${patient.surname}`.toLowerCase()
        : '';
      const emrNumber = (patient?.emr_number || '').toLowerCase();
      const phone = (patient?.contact_phone || '').toLowerCase();
      const invoiceNum = (invoice.invoice_number || '').toLowerCase();
      const encounterNum = (encounter?.encounter_number || '').toLowerCase();
      const amount = invoice.total_amount?.toString() || '';
      const status = (invoice.status || '').toLowerCase();

      return (
        emrNumber.includes(query) || // patient number is primary search key
        patientName.includes(query) ||
        encounterNum.includes(query) ||
        phone.includes(query) ||
        invoiceNum.includes(query) ||
        amount.includes(query) ||
        status.includes(query)
      );
    });
  }, [invoices, searchQuery]);

  const totalResults = filteredPayments.length + filteredInvoices.length;

  if (!isOpen) return null;

  const handleSelectPayment = (payment: PaymentDTO) => {
    setSelectedPayment(payment);
    setSelectedInvoice(null);
  };

  const handleSelectInvoice = (invoice: InvoiceDTO) => {
    setSelectedInvoice(invoice);
    setSelectedPayment(null);
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedPayment(null);
    setSelectedInvoice(null);
    setActiveTab('all');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="absolute inset-4 md:inset-10 lg:inset-20 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Search Billing Records
                </h2>
                <p className="text-sm text-green-100">
                  Search by patient number, patient name, receipt, invoice, phone...
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Search Input */}
          <div className="mt-4 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter patient number, patient name, receipt number, invoice number, phone..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-0 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {searchQuery && (
          <div className="border-b border-gray-200 px-6">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'all'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                All Results ({totalResults})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'payments'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Payments ({filteredPayments.length})
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'invoices'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Invoices ({filteredInvoices.length})
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Results List */}
          <div
            className={`${selectedPayment || selectedInvoice ? 'w-1/2 border-r' : 'w-full'} overflow-y-auto p-4`}
          >
            {!searchQuery ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Search for Records
                </h3>
                <p className="text-sm text-gray-500 max-w-md">
                  Enter an patient number, patient name, receipt number, invoice
                  number, or phone number to find billing records
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-gray-500">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                    <Hash className="h-4 w-4 text-green-600" />
                    <span>MHC-000001</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                    <User className="h-4 w-4 text-green-600" />
                    <span>John Doe</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                    <Receipt className="h-4 w-4 text-green-600" />
                    <span>RCP-001234</span>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                    <Phone className="h-4 w-4 text-green-600" />
                    <span>08012345678</span>
                  </div>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              </div>
            ) : totalResults === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Results Found
                </h3>
                <p className="text-sm text-gray-500">
                  No billing records match "{searchQuery}"
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Payments Section */}
                {(activeTab === 'all' || activeTab === 'payments') &&
                  filteredPayments.length > 0 && (
                    <div>
                      {activeTab === 'all' && (
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Payments ({filteredPayments.length})
                        </h3>
                      )}
                      <div className="space-y-2">
                        {filteredPayments.map((payment) => (
                          <button
                            key={payment.payment_id}
                            onClick={() => handleSelectPayment(payment)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                              selectedPayment?.payment_id === payment.payment_id
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'
                            }`}
                          >
                            {/* EMR → Encounter → Record Hierarchy */}
                            <div className="flex items-center gap-1.5 text-xs mb-2">
                              <span className="font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                {payment.invoice?.patient?.emr_number ||
                                  'No EMR'}
                              </span>
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                              <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                {payment.invoice?.encounter?.encounter_number ||
                                  'No Encounter'}
                              </span>
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                              <span className="text-blue-600">
                                {payment.receipt_number}
                              </span>
                            </div>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                  <CreditCard className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {payment.invoice?.patient?.first_name}{' '}
                                    {payment.invoice?.patient?.surname}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Invoice: {payment.invoice?.invoice_number}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(
                                      payment.created_at,
                                    ).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">
                                  {formatCurrency(payment.amount)}
                                </p>
                                <StatusBadge
                                  status={payment.payment_method}
                                  color={getPaymentMethodColor(
                                    payment.payment_method,
                                  )}
                                />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Invoices Section */}
                {(activeTab === 'all' || activeTab === 'invoices') &&
                  filteredInvoices.length > 0 && (
                    <div
                      className={
                        activeTab === 'all' && filteredPayments.length > 0
                          ? 'mt-6'
                          : ''
                      }
                    >
                      {activeTab === 'all' && (
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Invoices ({filteredInvoices.length})
                        </h3>
                      )}
                      <div className="space-y-2">
                        {filteredInvoices.map((invoice) => (
                          <button
                            key={invoice.invoice_id}
                            onClick={() => handleSelectInvoice(invoice)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                              selectedInvoice?.invoice_id === invoice.invoice_id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                            }`}
                          >
                            {/* EMR → Encounter → Record Hierarchy */}
                            <div className="flex items-center gap-1.5 text-xs mb-2">
                              <span className="font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                {invoice.patient?.emr_number || 'No EMR'}
                              </span>
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                              <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                {invoice.encounter?.encounter_number ||
                                  'No Encounter'}
                              </span>
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                              <span className="text-blue-600">
                                {invoice.invoice_number}
                              </span>
                            </div>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {invoice.patient?.first_name}{' '}
                                    {invoice.patient?.surname}
                                  </p>
                                  {invoice.encounter?.visit_type && (
                                    <p className="text-sm text-gray-500">
                                      {invoice.encounter.visit_type}
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(
                                      invoice.created_at,
                                    ).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-gray-900">
                                  {formatCurrency(invoice.total_amount)}
                                </p>
                                <StatusBadge
                                  status={invoice.status}
                                  color={
                                    invoice.status === 'Paid'
                                      ? 'green'
                                      : invoice.status === 'Partial'
                                        ? 'yellow'
                                        : invoice.status === 'Pending'
                                          ? 'orange'
                                          : 'gray'
                                  }
                                />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {(selectedPayment || selectedInvoice) && (
            <div className="w-1/2 overflow-y-auto bg-gray-50 p-6">
              {selectedPayment && (
                <div className="space-y-6">
                  {/* Record Hierarchy Banner */}
                  <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-xl p-4 text-white">
                    <p className="text-xs uppercase tracking-wider opacity-80 mb-2">
                      Record Hierarchy
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg">
                        <p className="text-xs opacity-80">Patient number</p>
                        <p className="font-bold">
                          {selectedPayment.invoice?.patient?.emr_number ||
                            'N/A'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-60" />
                      <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg">
                        <p className="text-xs opacity-80">Encounter</p>
                        <p className="font-bold">
                          {selectedPayment.invoice?.encounter
                            ?.encounter_number || 'N/A'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-60" />
                      <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg">
                        <p className="text-xs opacity-80">Receipt</p>
                        <p className="font-bold">
                          {selectedPayment.receipt_number}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Header */}
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-green-100 rounded-xl">
                        <CreditCard className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {selectedPayment.receipt_number}
                        </h3>
                        <p className="text-sm text-gray-500">Payment Receipt</p>
                      </div>
                    </div>

                    <div className="text-center py-4 bg-green-50 rounded-xl mb-4">
                      <p className="text-sm text-green-600 mb-1">Amount Paid</p>
                      <p className="text-3xl font-bold text-green-700">
                        {formatCurrency(selectedPayment.amount)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Payment Method</p>
                        <p className="font-medium text-gray-900">
                          {selectedPayment.payment_method}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium text-gray-900">
                          {new Date(
                            selectedPayment.created_at,
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Received By</p>
                        <p className="font-medium text-gray-900">
                          {selectedPayment.received_by_staff?.first_name}{' '}
                          {selectedPayment.received_by_staff?.last_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Invoice</p>
                        <p className="font-medium text-gray-900">
                          {selectedPayment.invoice?.invoice_number}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Patient Information
                    </h4>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-green-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                        {selectedPayment.invoice?.patient?.first_name?.[0]}
                        {selectedPayment.invoice?.patient?.surname?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">
                          {selectedPayment.invoice?.patient?.first_name}{' '}
                          {selectedPayment.invoice?.patient?.surname}
                        </p>
                        <p className="text-sm text-green-600 font-mono font-bold">
                          {selectedPayment.invoice?.patient?.emr_number ||
                            'No EMR'}
                        </p>
                        {selectedPayment.invoice?.patient?.contact_phone && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {selectedPayment.invoice?.patient?.contact_phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => onPrintReceipt(selectedPayment)}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print Receipt
                    </button>
                    {selectedPayment.invoice && (
                      <button
                        onClick={() => {
                          const invoice = invoices.find(
                            (i) =>
                              i.invoice_id ===
                              selectedPayment.invoice?.invoice_id,
                          );
                          if (invoice) onViewInvoice(invoice);
                        }}
                        className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View Invoice
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedInvoice && (
                <div className="space-y-6">
                  {/* Record Hierarchy Banner */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-4 text-white">
                    <p className="text-xs uppercase tracking-wider opacity-80 mb-2">
                      Record Hierarchy
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg">
                        <p className="text-xs opacity-80">Patient number</p>
                        <p className="font-bold">
                          {selectedInvoice.patient?.emr_number || 'N/A'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-60" />
                      <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg">
                        <p className="text-xs opacity-80">Encounter</p>
                        <p className="font-bold">
                          {selectedInvoice.encounter?.encounter_number || 'N/A'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-60" />
                      <div className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg">
                        <p className="text-xs opacity-80">Invoice</p>
                        <p className="font-bold">
                          {selectedInvoice.invoice_number}
                        </p>
                      </div>
                    </div>
                    {selectedInvoice.encounter?.visit_type && (
                      <p className="text-xs mt-2 opacity-80">
                        Visit Type:{' '}
                        <span className="font-medium">
                          {selectedInvoice.encounter.visit_type}
                        </span>
                        {selectedInvoice.encounter.chief_complaint && (
                          <> • {selectedInvoice.encounter.chief_complaint}</>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Invoice Header */}
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {selectedInvoice.invoice_number}
                        </h3>
                        <p className="text-sm text-gray-500">Invoice</p>
                      </div>
                      <div className="ml-auto">
                        <StatusBadge
                          status={selectedInvoice.status}
                          color={
                            selectedInvoice.status === 'Paid'
                              ? 'green'
                              : selectedInvoice.status === 'Partial'
                                ? 'yellow'
                                : selectedInvoice.status === 'Pending'
                                  ? 'orange'
                                  : 'gray'
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center py-4 bg-gray-50 rounded-xl">
                        <p className="text-sm text-gray-500 mb-1">
                          Total Amount
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(selectedInvoice.total_amount)}
                        </p>
                      </div>
                      <div className="text-center py-4 bg-green-50 rounded-xl">
                        <p className="text-sm text-green-600 mb-1">
                          Amount Paid
                        </p>
                        <p className="text-2xl font-bold text-green-700">
                          {formatCurrency(selectedInvoice.amount_paid)}
                        </p>
                      </div>
                    </div>

                    {selectedInvoice.balance > 0 && (
                      <div className="text-center py-3 bg-orange-50 rounded-xl">
                        <p className="text-sm text-orange-600 mb-1">
                          Balance Due
                        </p>
                        <p className="text-xl font-bold text-orange-700">
                          {formatCurrency(selectedInvoice.balance)}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                      <div>
                        <p className="text-gray-500">Created</p>
                        <p className="font-medium text-gray-900">
                          {new Date(
                            selectedInvoice.created_at,
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Items</p>
                        <p className="font-medium text-gray-900">
                          {selectedInvoice.items?.length || 0} items
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Patient Information
                    </h4>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                        {selectedInvoice.patient?.first_name?.[0]}
                        {selectedInvoice.patient?.surname?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">
                          {selectedInvoice.patient?.first_name}{' '}
                          {selectedInvoice.patient?.surname}
                        </p>
                        <p className="text-sm text-green-600 font-mono font-bold">
                          {selectedInvoice.patient?.emr_number || 'No EMR'}
                        </p>
                        {selectedInvoice.patient?.contact_phone && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" />
                            {selectedInvoice.patient?.contact_phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Invoice Items Preview */}
                  {selectedInvoice.items &&
                    selectedInvoice.items.length > 0 && (
                      <div className="bg-white rounded-xl p-6 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                          Invoice Items
                        </h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {selectedInvoice.items
                            .slice(0, 5)
                            .map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                              >
                                <span className="text-sm text-gray-700">
                                  {item.description}
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {formatCurrency(item.total)}
                                </span>
                              </div>
                            ))}
                          {selectedInvoice.items.length > 5 && (
                            <p className="text-xs text-gray-500 text-center pt-2">
                              +{selectedInvoice.items.length - 5} more items
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => onViewInvoice(selectedInvoice)}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </button>
                    {/* Verify Payment button - for billing_order invoices that are unpaid */}
                    {selectedInvoice.status !== 'Paid' &&
                      (selectedInvoice as any)._source === 'billing_order' &&
                      onVerifyPayment &&
                      fetchBillingOrder && (
                        <button
                          onClick={async () => {
                            if (isVerifying) return;
                            setIsVerifying(true);
                            try {
                              const billingOrder = await fetchBillingOrder(
                                selectedInvoice.invoice_id,
                              );
                              onVerifyPayment(selectedInvoice, billingOrder);
                            } catch (error) {
                              console.error(
                                'Failed to fetch billing order:',
                                error,
                              );
                            } finally {
                              setIsVerifying(false);
                            }
                          }}
                          disabled={isVerifying}
                          className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isVerifying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          Verify Payment
                        </button>
                      )}
                    {/* Record Payment button - for legacy invoices that are unpaid */}
                    {selectedInvoice.status !== 'Paid' &&
                      (selectedInvoice as any)._source !== 'billing_order' && (
                        <button
                          onClick={() => onRecordPayment(selectedInvoice)}
                          className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <DollarSign className="h-4 w-4" />
                          Record Payment
                        </button>
                      )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

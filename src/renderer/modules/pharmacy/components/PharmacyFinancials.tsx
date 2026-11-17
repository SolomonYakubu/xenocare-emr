import React, { useState, useMemo, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  DollarSign,
  TrendingUp,
  Package,
  ShoppingCart,
  BarChart3,
  Download,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  FileSpreadsheet,
  FileText,
  FileDown,
  Shield,
  Users,
  Pill,
  Receipt,
} from 'lucide-react';
import { Button, Card, StatusBadge, EmptyState } from '../../../components/ui';
import { getFacilityInfo } from '../../../lib/facility';
import { isNhisFeatureEnabled } from '../../../config/features';
import { useTimeTheme } from '../../../hooks/useTimeTheme';
import { usePharmacyFinancialSummary } from '../hooks/usePharmacy';
import { useToast } from '../../../components/ui/Toast';
import type {
  StockValuationRow,
  MonthlyFinancialRow,
  PharmacySaleRow,
  PharmacyFinancialSummary,
} from '../api/pharmacy.api';

// =============================================================================
// Helpers
// =============================================================================

const fmt = (amount: number) =>
  `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

type FinancialTab = 'stock_value' | 'sales' | 'purchases';

// =============================================================================
// Stat Card
// =============================================================================

function FinStatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  isNightMode,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: { value: number; direction: 'up' | 'down' };
  isNightMode: boolean;
}) {
  return (
    <div
      className={`p-5 rounded-xl border ${isNightMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend.direction === 'up'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {trend.direction === 'up' ? (
              <ArrowUpRight size={12} />
            ) : (
              <ArrowDownRight size={12} />
            )}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </p>
        <p
          className={`text-2xl font-bold mt-1 ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
        >
          {value}
        </p>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// =============================================================================
// Stock Valuation Row
// =============================================================================

function StockRow({
  row,
  isNightMode,
}: {
  row: StockValuationRow;
  isNightMode: boolean;
}) {
  const statusConfig = {
    in_stock: { label: 'In Stock', color: 'success' as const },
    low_stock: { label: 'Low', color: 'warning' as const },
    at_risk: { label: 'At Risk', color: 'danger' as const },
  };
  const s = statusConfig[row.status] || statusConfig.in_stock;

  const expiryWarning = row.earliest_expiry
    ? Math.ceil(
        (new Date(row.earliest_expiry).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <tr
      className={`border-b last:border-0 ${isNightMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-gray-100 hover:bg-gray-50'} transition-colors`}
    >
      <td className="py-3 px-4">
        <div>
          <div
            className={`font-medium text-sm ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
          >
            {row.drug_name}
          </div>
          <div className="text-xs text-gray-500 font-mono">{row.drug_code}</div>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <span
          className={`font-semibold text-sm ${isNightMode ? 'text-slate-200' : 'text-gray-900'}`}
        >
          {row.total_qty.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500 ml-1">
          ({row.batch_count} batch{row.batch_count !== 1 ? 'es' : ''})
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="text-sm text-gray-500">{fmt(row.cost_value)}</div>
      </td>
      <td className="py-3 px-4 text-right">
        <div
          className={`text-sm font-semibold ${isNightMode ? 'text-green-400' : 'text-green-700'}`}
        >
          {fmt(row.selling_value)}
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <div
          className={`text-sm font-medium ${
            row.profit_margin >= 50
              ? 'text-green-600'
              : row.profit_margin >= 20
                ? 'text-blue-600'
                : row.profit_margin > 0
                  ? 'text-yellow-600'
                  : 'text-gray-500'
          }`}
        >
          {row.profit_margin}%
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <StatusBadge status={s.label} color={s.color} />
          {expiryWarning !== null && expiryWarning <= 90 && (
            <span
              className={`text-xs ${expiryWarning <= 30 ? 'text-red-500' : 'text-yellow-500'}`}
            >
              {expiryWarning}d
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// =============================================================================
// XenoCare brand configuration (matches billing export)
// =============================================================================

const BRAND = {
  name: 'XenoCare',
  fullName: 'XenoCare',
  tagline: 'Modern Care. Connected.',
};

// XenoCare Logo loader
let ndcLogoBase64: string | null = null;

function tryLoadImage(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => resolve(null), 3000);
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const size = Math.max(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, (size - img.width) / 2, (size - img.height) / 2);
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

async function loadLogo(): Promise<string | null> {
  // Printed documents intentionally carry no app logo; the facility name and
  // colours identify the header.
  if (ndcLogoBase64) return ndcLogoBase64;
  return null;
}

// =============================================================================
// XenoCare-Branded Comprehensive Export — CSV
// =============================================================================

function generateBrandedReport(data: PharmacyFinancialSummary) {
  const now = new Date();
  const monthName = now.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const generated = now.toLocaleString('en-NG');

  let csv = '';

  // XENOCARE HEADER
  csv += ',,XENOCARE\n';
  csv += ',,EMR — PHARMACY MODULE\n';
  csv += `,,COMPREHENSIVE FINANCIAL REPORT — ${monthName.toUpperCase()}\n`;
  csv += `,,Generated: ${generated}\n`;
  csv += ',,Prepared by: Pharmacy Department\n';
  csv += '\n';

  // EXECUTIVE SUMMARY
  csv += '═══════ EXECUTIVE SUMMARY ═══════\n\n';
  csv += 'Metric,Value\n';
  csv += `Drug Catalogue — Total Drugs,${data.catalogue_total_drugs}\n`;
  csv += `Drug Catalogue — NHIS Covered,${data.catalogue_nhis_covered}\n`;
  csv += `Drug Catalogue — Low Stock Items,${data.catalogue_low_stock}\n`;
  csv += `Drug Catalogue — Out of Stock,${data.catalogue_out_of_stock}\n\n`;
  csv += `Stock Value (Cost Price),${data.total_stock_cost}\n`;
  csv += `Stock Value (Selling Price),${data.total_stock_selling}\n`;
  csv += `Potential Profit (Selling - Cost),${data.potential_profit}\n`;
  csv += `Profit Margin %,${data.profit_margin_pct}%\n\n`;
  csv += `Total Sales Revenue (Billed & Paid),${data.total_sales_amount}\n`;
  csv += `Total Sales Count,${data.total_sales_count}\n`;
  csv += `NHIS Payable (Covered by Insurance),${data.total_nhis_payable}\n`;
  csv += `Patient Out-of-Pocket,${data.total_patient_payable}\n\n`;
  csv += `Total Purchase Cost (Goods Received),${data.total_purchase_cost}\n`;
  csv += `Total Batches Received,${data.total_batches_received}\n`;
  csv += `Total Units Received,${data.total_units_received}\n\n`;

  // PROFIT/LOSS
  const grossProfit = data.total_sales_amount - data.total_purchase_cost;
  csv += '═══════ PROFIT / LOSS SUMMARY ═══════\n\n';
  csv += `Total Revenue from Dispensed Drugs,${data.total_sales_amount}\n`;
  csv += `Total Cost of Goods Purchased,${data.total_purchase_cost}\n`;
  csv += `Gross Profit / (Loss),${grossProfit}\n`;
  csv += `Status,${grossProfit >= 0 ? 'PROFIT' : 'LOSS'}\n\n`;

  // STOCK VALUATION
  csv += '═══════ STOCK VALUATION BY DRUG ═══════\n\n';
  csv +=
    'Drug Name,Drug Code,Quantity In Stock,Active Batches,Cost Value,Selling Value,Profit Margin %,Stock Status,Earliest Expiry\n';
  data.stock_by_drug.forEach((row) => {
    const expiry = row.earliest_expiry
      ? new Date(row.earliest_expiry).toLocaleDateString('en-NG')
      : 'N/A';
    csv += `"${row.drug_name}","${row.drug_code}",${row.total_qty},${row.batch_count},${row.cost_value},${row.selling_value},${row.profit_margin}%,${row.status.replace('_', ' ').toUpperCase()},${expiry}\n`;
  });
  csv += `\nTOTAL,,${data.stock_by_drug.reduce((s, r) => s + r.total_qty, 0)},${data.stock_by_drug.reduce((s, r) => s + r.batch_count, 0)},${data.total_stock_cost},${data.total_stock_selling},${data.profit_margin_pct}%,,\n\n`;

  // DISPENSED DRUGS / SALES
  csv += '═══════ DRUGS DISPENSED — SALES RECORDS ═══════\n\n';
  csv +=
    'Date,Receipt/Order No,Drug/Medication,Qty,Unit Price,Total Price,Patient Name,Patient ID,Insurance Type,NHIS Covered,NHIS %,NHIS Payable,Patient Pays,Payment Method,Status\n';
  data.sales_detail.forEach((sale) => {
    const dt = sale.created_at
      ? new Date(sale.created_at).toLocaleDateString('en-NG')
      : '';
    csv += `${dt},"${sale.order_number}","${sale.item_name}",${sale.quantity},${sale.unit_price},${sale.total_price},"${sale.patient_name}","${sale.patient_id_display}","${sale.insurance_type}",${sale.nhis_covered ? 'Yes' : 'No'},${sale.nhis_percentage}%,${sale.nhis_payable},${sale.patient_payable},${sale.payment_method},${sale.status}\n`;
  });
  if (data.sales_detail.length > 0) {
    csv += `\nTOTAL,,,,,"${data.total_sales_amount}",,,,,,${data.total_nhis_payable},${data.total_patient_payable},,\n`;
  }
  csv += '\n';

  // MONTHLY PURCHASE HISTORY
  csv += '═══════ MONTHLY PURCHASE HISTORY ═══════\n\n';
  csv += 'Month,Purchase Cost,Units Received,Batches Received,Avg Cost/Unit\n';
  data.monthly_purchases.forEach((row) => {
    const avg =
      row.units_received > 0
        ? Math.round(row.purchase_cost / row.units_received)
        : 0;
    csv += `${row.label},${row.purchase_cost},${row.units_received},${row.batches_received},${avg}\n`;
  });
  csv += '\n';

  // EXPIRY RISK ANALYSIS
  csv += '═══════ EXPIRY RISK ANALYSIS ═══════\n\n';
  csv +=
    'Drug Name,Drug Code,Quantity,Selling Value,Earliest Expiry,Days Until Expiry,Risk Level\n';
  data.stock_by_drug
    .filter((d) => d.earliest_expiry)
    .sort((a, b) =>
      (a.earliest_expiry || '').localeCompare(b.earliest_expiry || ''),
    )
    .forEach((row) => {
      const daysUntil = row.earliest_expiry
        ? Math.ceil(
            (new Date(row.earliest_expiry).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          )
        : 999;
      const risk =
        daysUntil <= 0
          ? 'EXPIRED'
          : daysUntil <= 30
            ? 'CRITICAL'
            : daysUntil <= 90
              ? 'WARNING'
              : 'OK';
      csv += `"${row.drug_name}","${row.drug_code}",${row.total_qty},${row.selling_value},${new Date(row.earliest_expiry!).toLocaleDateString('en-NG')},${daysUntil},${risk}\n`;
    });
  csv += '\n';

  // FOOTER
  csv += '═══════════════════════════════════════\n';
  csv += `Report generated by XenoCare System on ${generated}\n`;
  csv += 'XenoCare — Pharmacy Department\n';
  csv += '═══════════════════════════════════════\n';

  return csv;
}

function downloadCSVReport(data: PharmacyFinancialSummary) {
  const csv = generateBrandedReport(data);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `XenoCare_Pharmacy_Financial_Report_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// =============================================================================
// XenoCare-Branded Export — Excel (XLSX) with multiple sheets
// =============================================================================

function downloadExcelReport(data: PharmacyFinancialSummary) {
  const wb = XLSX.utils.book_new();
  const now = new Date();
  const generated = now.toLocaleString('en-NG');
  const grossProfit = data.total_sales_amount - data.total_purchase_cost;

  // ---- Sheet 1: Executive Summary ----
  const summaryRows: (string | number)[][] = [
    ['', 'XENOCARE'],
    ['', 'EMR — PHARMACY MODULE — COMPREHENSIVE FINANCIAL REPORT'],
    ['', `Generated: ${generated}`],
    [],
    ['METRIC', 'VALUE'],
    ['Drug Catalogue — Total Drugs', data.catalogue_total_drugs],
    ['Drug Catalogue — NHIS Covered', data.catalogue_nhis_covered],
    ['Drug Catalogue — Low Stock Items', data.catalogue_low_stock],
    ['Drug Catalogue — Out of Stock', data.catalogue_out_of_stock],
    [],
    ['Stock Value (Cost Price)', data.total_stock_cost],
    ['Stock Value (Selling Price)', data.total_stock_selling],
    ['Potential Profit (Selling - Cost)', data.potential_profit],
    ['Profit Margin %', `${data.profit_margin_pct}%`],
    [],
    ['Total Sales Revenue', data.total_sales_amount],
    ['Total Sales Count', data.total_sales_count],
    ['NHIS Payable', data.total_nhis_payable],
    ['Patient Out-of-Pocket', data.total_patient_payable],
    [],
    ['Total Purchase Cost', data.total_purchase_cost],
    ['Total Batches Received', data.total_batches_received],
    ['Total Units Received', data.total_units_received],
    [],
    ['PROFIT / LOSS SUMMARY', ''],
    ['Total Revenue from Dispensed Drugs', data.total_sales_amount],
    ['Total Cost of Goods Purchased', data.total_purchase_cost],
    ['Gross Profit / (Loss)', grossProfit],
    ['Status', grossProfit >= 0 ? 'PROFIT' : 'LOSS'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // ---- Sheet 2: Stock Valuation ----
  const stockHeader = [
    'Drug Name',
    'Drug Code',
    'Quantity',
    'Batches',
    'Cost Value',
    'Selling Value',
    'Margin %',
    'Status',
    'Earliest Expiry',
  ];
  const stockRows = data.stock_by_drug.map((r) => [
    r.drug_name,
    r.drug_code,
    r.total_qty,
    r.batch_count,
    r.cost_value,
    r.selling_value,
    `${r.profit_margin}%`,
    r.status.replace('_', ' ').toUpperCase(),
    r.earliest_expiry
      ? new Date(r.earliest_expiry).toLocaleDateString('en-NG')
      : 'N/A',
  ]);
  stockRows.push([
    'TOTAL',
    '',
    data.stock_by_drug.reduce((s, r) => s + r.total_qty, 0),
    data.stock_by_drug.reduce((s, r) => s + r.batch_count, 0),
    data.total_stock_cost,
    data.total_stock_selling,
    `${data.profit_margin_pct}%`,
    '',
    '',
  ] as any);
  const wsStock = XLSX.utils.aoa_to_sheet([stockHeader, ...stockRows]);
  wsStock['!cols'] = [
    { wch: 30 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsStock, 'Stock Valuation');

  // ---- Sheet 3: Sales Detail ----
  const salesHeader = [
    'Date',
    'Receipt #',
    'Drug',
    'Qty',
    'Unit Price',
    'Total Price',
    'Patient Name',
    'Patient ID',
    'Insurance',
    'NHIS?',
    'NHIS %',
    'NHIS Payable',
    'Patient Pays',
    'Pay Method',
    'Status',
  ];
  const salesRows = data.sales_detail.map((s) => [
    s.created_at ? new Date(s.created_at).toLocaleDateString('en-NG') : '',
    s.order_number,
    s.item_name,
    s.quantity,
    s.unit_price,
    s.total_price,
    s.patient_name,
    s.patient_id_display,
    s.insurance_type,
    s.nhis_covered ? 'Yes' : 'No',
    `${s.nhis_percentage}%`,
    s.nhis_payable,
    s.patient_payable,
    s.payment_method,
    s.status,
  ]);
  if (data.sales_detail.length > 0) {
    salesRows.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      data.total_sales_amount,
      '',
      '',
      '',
      '',
      '',
      data.total_nhis_payable,
      data.total_patient_payable,
      '',
      '',
    ] as any);
  }
  const wsSales = XLSX.utils.aoa_to_sheet([salesHeader, ...salesRows]);
  wsSales['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 6 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 6 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Detail');

  // ---- Sheet 4: Monthly Purchases ----
  const purchHeader = [
    'Month',
    'Purchase Cost',
    'Units Received',
    'Batches Received',
    'Avg Cost/Unit',
  ];
  const purchRows = data.monthly_purchases.map((r) => [
    r.label,
    r.purchase_cost,
    r.units_received,
    r.batches_received,
    r.units_received > 0 ? Math.round(r.purchase_cost / r.units_received) : 0,
  ]);
  const wsPurch = XLSX.utils.aoa_to_sheet([purchHeader, ...purchRows]);
  wsPurch['!cols'] = [
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPurch, 'Monthly Purchases');

  // ---- Sheet 5: Expiry Risk ----
  const expiryHeader = [
    'Drug Name',
    'Drug Code',
    'Quantity',
    'Selling Value',
    'Earliest Expiry',
    'Days Until Expiry',
    'Risk Level',
  ];
  const expiryRows = data.stock_by_drug
    .filter((d) => d.earliest_expiry)
    .sort((a, b) =>
      (a.earliest_expiry || '').localeCompare(b.earliest_expiry || ''),
    )
    .map((row) => {
      const daysUntil = row.earliest_expiry
        ? Math.ceil(
            (new Date(row.earliest_expiry).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          )
        : 999;
      const risk =
        daysUntil <= 0
          ? 'EXPIRED'
          : daysUntil <= 30
            ? 'CRITICAL'
            : daysUntil <= 90
              ? 'WARNING'
              : 'OK';
      return [
        row.drug_name,
        row.drug_code,
        row.total_qty,
        row.selling_value,
        new Date(row.earliest_expiry!).toLocaleDateString('en-NG'),
        daysUntil,
        risk,
      ];
    });
  const wsExpiry = XLSX.utils.aoa_to_sheet([expiryHeader, ...expiryRows]);
  wsExpiry['!cols'] = [
    { wch: 30 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsExpiry, 'Expiry Risk');

  XLSX.writeFile(
    wb,
    `XenoCare_Pharmacy_Financial_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
  );
}

// =============================================================================
// XenoCare-Branded Export — PDF with logo, tables, signature lines
// =============================================================================

function fmtPDF(value: number): string {
  return `NGN ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function fmtPDFShort(value: number): string {
  return `NGN ${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

async function downloadPDFReport(data: PharmacyFinancialSummary) {
  const logo = await loadLogo();
  const now = new Date();
  const grossProfit = data.total_sales_amount - data.total_purchase_cost;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 10;

  // ===== HEADER BAR =====
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, pw, 22, 'F');

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', m, 3, 16, 16);
    } catch {
      /* ignore */
    }
  }
  const facility = getFacilityInfo();
  const tx = logo ? m + 20 : m;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(BRAND.fullName, tx, 9);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(BRAND.tagline, tx, 14);
  const contact = [
    facility.phone ? `Tel: ${facility.phone}` : '',
    facility.email ? `Email: ${facility.email}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  if (contact) doc.text(contact, tx, 19);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Pharmacy Financial Report', pw - m, 9, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`,
    pw - m,
    14,
    { align: 'right' },
  );
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared By: Pharmacy Department', pw - m, 19, { align: 'right' });

  // ===== SUMMARY STRIP =====
  doc.setFillColor(240, 253, 244);
  doc.rect(0, 22, pw, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  let sx = m;
  doc.setTextColor(22, 101, 52);
  doc.text(`Stock Value: ${fmtPDFShort(data.total_stock_selling)}`, sx, 28);
  sx += 55;
  doc.text(`Sales Revenue: ${fmtPDFShort(data.total_sales_amount)}`, sx, 28);
  sx += 55;
  doc.setTextColor(22, 163, 74);
  doc.text(`NHIS Payable: ${fmtPDFShort(data.total_nhis_payable)}`, sx, 28);
  sx += 55;
  doc.setTextColor(
    grossProfit >= 0 ? 22 : 220,
    grossProfit >= 0 ? 163 : 38,
    grossProfit >= 0 ? 74 : 38,
  );
  doc.text(
    `Gross ${grossProfit >= 0 ? 'Profit' : 'Loss'}: ${fmtPDFShort(Math.abs(grossProfit))}`,
    sx,
    28,
  );

  // ===== EXECUTIVE SUMMARY TABLE =====
  const execData = [
    ['Total Drugs in Catalogue', data.catalogue_total_drugs.toString()],
    ['NHIS Covered Drugs', data.catalogue_nhis_covered.toString()],
    ['Low Stock Items', data.catalogue_low_stock.toString()],
    ['Out of Stock', data.catalogue_out_of_stock.toString()],
    ['Stock Value (Cost)', fmtPDF(data.total_stock_cost)],
    ['Stock Value (Selling)', fmtPDF(data.total_stock_selling)],
    ['Profit Margin', `${data.profit_margin_pct}%`],
    ['Total Sales Revenue', fmtPDF(data.total_sales_amount)],
    ['Total Sales Count', data.total_sales_count.toString()],
    ['NHIS Payable', fmtPDF(data.total_nhis_payable)],
    ['Patient Payable', fmtPDF(data.total_patient_payable)],
    ['Purchase Cost', fmtPDF(data.total_purchase_cost)],
    ['Gross Profit / (Loss)', fmtPDF(grossProfit)],
    ['Status', grossProfit >= 0 ? 'PROFIT' : 'LOSS'],
  ];

  autoTable(doc, {
    head: [['Metric', 'Value']],
    body: execData,
    startY: 34,
    margin: { left: m, right: pw / 2 + 5 },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { halign: 'right', font: 'courier' },
    },
    didParseCell: (cellData) => {
      if (cellData.section === 'body') {
        const raw = String(cellData.cell.raw);
        if (raw === 'LOSS') {
          cellData.cell.styles.textColor = [220, 38, 38];
          cellData.cell.styles.fontStyle = 'bold';
        }
        if (raw === 'PROFIT') {
          cellData.cell.styles.textColor = [22, 163, 74];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Monthly purchases on right half
  if (data.monthly_purchases.length > 0) {
    const purchBody = data.monthly_purchases.map((r) => [
      r.label,
      fmtPDF(r.purchase_cost),
      r.units_received.toLocaleString(),
      r.batches_received.toString(),
    ]);
    purchBody.push([
      'TOTAL',
      fmtPDF(data.total_purchase_cost),
      data.total_units_received.toLocaleString(),
      data.total_batches_received.toString(),
    ]);
    autoTable(doc, {
      head: [['Month', 'Cost', 'Units', 'Batches']],
      body: purchBody,
      startY: 34,
      margin: { left: pw / 2 + 5, right: m },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right', font: 'courier' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
      didParseCell: (cellData) => {
        if (
          cellData.section === 'body' &&
          cellData.row.index === purchBody.length - 1
        ) {
          cellData.cell.styles.fillColor = [168, 85, 247];
          cellData.cell.styles.textColor = [255, 255, 255];
          cellData.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  // ===== PAGE 2: STOCK VALUATION =====
  doc.addPage();
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, pw, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('STOCK VALUATION BY DRUG', m, 8);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.stock_by_drug.length} drugs in stock`, pw - m, 8, {
    align: 'right',
  });

  const stockBody = data.stock_by_drug.map((r, i) => [
    (i + 1).toString(),
    r.drug_name,
    r.drug_code,
    r.total_qty.toLocaleString(),
    fmtPDF(r.cost_value),
    fmtPDF(r.selling_value),
    `${r.profit_margin}%`,
    r.status.replace('_', ' ').toUpperCase(),
    r.earliest_expiry
      ? new Date(r.earliest_expiry).toLocaleDateString('en-NG')
      : 'N/A',
  ]);
  stockBody.push([
    '',
    'TOTAL',
    '',
    data.stock_by_drug.reduce((s, r) => s + r.total_qty, 0).toLocaleString(),
    fmtPDF(data.total_stock_cost),
    fmtPDF(data.total_stock_selling),
    `${data.profit_margin_pct}%`,
    '',
    '',
  ]);

  autoTable(doc, {
    head: [
      [
        'S/N',
        'Drug Name',
        'Code',
        'Qty',
        'Cost Value',
        'Selling Value',
        'Margin',
        'Status',
        'Expiry',
      ],
    ],
    body: stockBody,
    startY: 14,
    margin: { left: m, right: m, bottom: 15 },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 22, font: 'courier', fontSize: 6 },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', font: 'courier' },
      5: { cellWidth: 28, halign: 'right', font: 'courier', fontStyle: 'bold' },
      6: { cellWidth: 18, halign: 'right' },
      7: { cellWidth: 22 },
      8: { cellWidth: 22 },
    },
    didParseCell: (cellData) => {
      if (
        cellData.section === 'body' &&
        cellData.row.index === stockBody.length - 1
      ) {
        cellData.cell.styles.fillColor = [22, 101, 52];
        cellData.cell.styles.textColor = [255, 255, 255];
        cellData.cell.styles.fontStyle = 'bold';
      }
      // Status colours
      if (cellData.section === 'body' && cellData.column.index === 7) {
        const val = String(cellData.cell.raw);
        if (val.includes('RISK') || val.includes('LOW')) {
          cellData.cell.styles.textColor = [220, 38, 38];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // ===== PAGE 3: SALES DETAIL =====
  if (data.sales_detail.length > 0) {
    doc.addPage();
    doc.setFillColor(22, 101, 52);
    doc.rect(0, 0, pw, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DRUGS DISPENSED — SALES RECORDS', m, 8);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${data.sales_detail.length} records | Total: ${fmtPDFShort(data.total_sales_amount)}`,
      pw - m,
      8,
      { align: 'right' },
    );

    const salesBody = data.sales_detail.map((s, i) => [
      (i + 1).toString(),
      s.created_at ? new Date(s.created_at).toLocaleDateString('en-NG') : '',
      s.order_number,
      s.item_name.length > 32
        ? `${s.item_name.substring(0, 30)}…`
        : s.item_name,
      s.patient_name.length > 22
        ? `${s.patient_name.substring(0, 20)}…`
        : s.patient_name,
      s.quantity.toString(),
      fmtPDF(s.total_price),
      s.nhis_covered ? `${s.nhis_percentage}%` : '—',
      s.nhis_payable > 0 ? fmtPDF(s.nhis_payable) : '—',
      s.patient_payable > 0 ? fmtPDF(s.patient_payable) : '—',
    ]);
    salesBody.push([
      '',
      '',
      '',
      'TOTAL',
      '',
      '',
      fmtPDF(data.total_sales_amount),
      '',
      fmtPDF(data.total_nhis_payable),
      fmtPDF(data.total_patient_payable),
    ]);

    autoTable(doc, {
      head: [
        [
          'S/N',
          'Date',
          'Receipt #',
          'Drug',
          'Patient',
          'Qty',
          'Total',
          'NHIS %',
          'NHIS Pays',
          'Patient Pays',
        ],
      ],
      body: salesBody,
      startY: 14,
      margin: { left: m, right: m, bottom: 15 },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [248, 250, 248] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 20 },
        2: { cellWidth: 26, font: 'courier', fontSize: 6 },
        3: { cellWidth: 48 },
        4: { cellWidth: 36 },
        5: { cellWidth: 12, halign: 'right' },
        6: {
          cellWidth: 26,
          halign: 'right',
          font: 'courier',
          fontStyle: 'bold',
        },
        7: { cellWidth: 16, halign: 'center' },
        8: { cellWidth: 26, halign: 'right', font: 'courier' },
        9: { cellWidth: 26, halign: 'right', font: 'courier' },
      },
      didParseCell: (cellData) => {
        if (
          cellData.section === 'body' &&
          cellData.row.index === salesBody.length - 1
        ) {
          cellData.cell.styles.fillColor = [22, 101, 52];
          cellData.cell.styles.textColor = [255, 255, 255];
          cellData.cell.styles.fontStyle = 'bold';
        }
      },
    });
  }

  // ===== SIGNATURE SECTION (on last page) =====
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  const finalY = (doc as any).lastAutoTable?.finalY || ph - 30;
  if (finalY < ph - 25) {
    const sigY = Math.max(finalY + 8, ph - 25);
    const sigW = (pw - m * 4) / 3;
    doc.setDrawColor(22, 101, 52);
    doc.setLineWidth(0.3);
    doc.line(m, sigY, m + sigW, sigY);
    doc.line(m + sigW + m, sigY, m + sigW * 2 + m, sigY);
    doc.line(m + (sigW + m) * 2, sigY, pw - m, sigY);
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Prepared By: ________________', m, sigY + 5);
    doc.text('Verified By: ________________', m + sigW + m, sigY + 5);
    doc.text('Approved By: ________________', m + (sigW + m) * 2, sigY + 5);
  }

  // ===== FOOTER ON ALL PAGES =====
  const pageCount = doc.getNumberOfPages();
  const filename = `XenoCare_Pharmacy_Financial_Report_${now.toISOString().split('T')[0]}`;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(22, 101, 52);
    doc.setLineWidth(0.3);
    doc.line(m, ph - 10, pw - m, ph - 10);
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`Reference: ${filename}`, m, ph - 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${i} of ${pageCount}`, pw / 2, ph - 6, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(
      `© ${now.getFullYear()} ${BRAND.name} - Confidential`,
      pw - m,
      ph - 6,
      { align: 'right' },
    );
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text('Powered by XenoCare', m, ph - 3);
  }

  doc.save(`${filename}.pdf`);
}

// =============================================================================
// Export Dropdown Button Component
// =============================================================================

function ExportDropdown({
  onExport,
  disabled,
}: {
  onExport: (format: 'pdf' | 'excel' | 'csv') => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items: {
    format: 'pdf' | 'excel' | 'csv';
    label: string;
    icon: React.ElementType;
    desc: string;
  }[] = [
    {
      format: 'pdf',
      label: 'Export as PDF',
      icon: FileText,
      desc: 'XenoCare-branded multi-page report',
    },
    {
      format: 'excel',
      label: 'Export as Excel',
      icon: FileSpreadsheet,
      desc: 'Multi-sheet workbook (.xlsx)',
    },
    {
      format: 'csv',
      label: 'Export as CSV',
      icon: FileDown,
      desc: 'Comma-separated flat file',
    },
  ];

  return (
    <div ref={ref} className="relative">
      <Button
        variant="primary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
      >
        <Download size={14} className="mr-1" /> Export XenoCare Report{' '}
        <ChevronDown size={12} className="ml-1" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 animate-in fade-in slide-in-from-top-1">
          {items.map(({ format, label, icon: Icon, desc }) => (
            <button
              key={format}
              onClick={() => {
                setOpen(false);
                onExport(format);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="p-1.5 rounded-lg bg-green-50">
                <Icon size={16} className="text-green-700" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{label}</div>
                <div className="text-[11px] text-gray-500">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function PharmacyFinancials() {
  const { isNightMode } = useTimeTheme();
  const { showToast } = useToast();
  const { data, isLoading, refetch } = usePharmacyFinancialSummary();

  const [activeTab, setActiveTab] = useState<FinancialTab>('stock_value');
  const [stockSearch, setStockSearch] = useState('');
  const [salesSearch, setSalesSearch] = useState('');
  const [stockSort, setStockSort] = useState<'value' | 'qty' | 'margin'>(
    'value',
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Filtered and sorted stock data
  const filteredStock = useMemo(() => {
    let rows = data?.stock_by_drug || [];
    if (stockSearch) {
      const q = stockSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.drug_name.toLowerCase().includes(q) ||
          r.drug_code.toLowerCase().includes(q),
      );
    }
    rows = [...rows].sort((a, b) => {
      let diff = 0;
      if (stockSort === 'value') diff = a.selling_value - b.selling_value;
      else if (stockSort === 'qty') diff = a.total_qty - b.total_qty;
      else diff = a.profit_margin - b.profit_margin;
      return sortDir === 'desc' ? -diff : diff;
    });
    return rows;
  }, [data?.stock_by_drug, stockSearch, stockSort, sortDir]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    let rows = data?.sales_detail || [];
    if (salesSearch) {
      const q = salesSearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.item_name.toLowerCase().includes(q) ||
          r.patient_name.toLowerCase().includes(q) ||
          r.order_number.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data?.sales_detail, salesSearch]);

  const handleExport = async (format: 'pdf' | 'excel' | 'csv' = 'csv') => {
    if (!data) return;
    try {
      switch (format) {
        case 'pdf':
          await downloadPDFReport(data);
          showToast({
            type: 'success',
            title: 'PDF Exported',
            message: 'XenoCare-branded PDF report downloaded',
          });
          break;
        case 'excel':
          downloadExcelReport(data);
          showToast({
            type: 'success',
            title: 'Excel Exported',
            message: 'Multi-sheet Excel workbook downloaded',
          });
          break;
        case 'csv':
          downloadCSVReport(data);
          showToast({
            type: 'success',
            title: 'CSV Exported',
            message: 'XenoCare Pharmacy CSV report downloaded',
          });
          break;
      }
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: e?.message || 'Could not generate report',
      });
    }
  };

  const handleRefresh = () => {
    refetch();
    showToast({
      type: 'info',
      title: 'Refreshing',
      message: 'Updating financial data...',
    });
  };

  const tabs: { id: FinancialTab; label: string; icon: React.ElementType }[] = [
    { id: 'stock_value', label: 'Stock Value', icon: Wallet },
    { id: 'sales', label: 'Sales & Revenue', icon: TrendingUp },
    { id: 'purchases', label: 'Purchase Orders', icon: ShoppingCart },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2
              className={`text-xl font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
            >
              Pharmacy Financials
            </h2>
            <p className="text-sm text-gray-500">Loading financial data...</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`p-5 rounded-xl border animate-pulse ${isNightMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
            >
              <div className="h-10 w-10 rounded-xl bg-gray-200" />
              <div className="mt-3 h-4 w-24 bg-gray-200 rounded" />
              <div className="mt-2 h-6 w-32 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const grossProfit =
    (data?.total_sales_amount || 0) - (data?.total_purchase_cost || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className={`text-xl font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
          >
            Pharmacy Financials
          </h2>
          <p className="text-sm text-gray-500">
            Stock valuation, sales tracking, and purchase history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh}>
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
          <ExportDropdown onExport={handleExport} disabled={!data} />
        </div>
      </div>

      {/* Top-Level Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FinStatCard
          label="Total Sales Revenue"
          value={fmt(data?.total_sales_amount || 0)}
          subtitle={`${data?.total_sales_count || 0} paid orders`}
          icon={DollarSign}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          isNightMode={isNightMode}
        />
        <FinStatCard
          label="Stock Value (Selling)"
          value={fmt(data?.total_stock_selling || 0)}
          subtitle="Current inventory at selling price"
          icon={Wallet}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          isNightMode={isNightMode}
        />
        <FinStatCard
          label="Potential Profit"
          value={fmt(data?.potential_profit || 0)}
          subtitle={`${data?.profit_margin_pct || 0}% margin`}
          icon={TrendingUp}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          trend={
            data?.profit_margin_pct
              ? { value: data.profit_margin_pct, direction: 'up' }
              : undefined
          }
          isNightMode={isNightMode}
        />
        <FinStatCard
          label="Gross Profit / Loss"
          value={fmt(Math.abs(grossProfit))}
          subtitle={
            grossProfit >= 0
              ? 'Profit — Sales vs Purchases'
              : 'Loss — Sales vs Purchases'
          }
          icon={BarChart3}
          iconBg={grossProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}
          iconColor={grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}
          trend={
            grossProfit !== 0
              ? {
                  value: Math.abs(
                    Math.round(
                      (grossProfit /
                        Math.max(data?.total_purchase_cost || 1, 1)) *
                        100,
                    ),
                  ),
                  direction: grossProfit >= 0 ? 'up' : 'down',
                }
              : undefined
          }
          isNightMode={isNightMode}
        />
      </div>

      {/* Catalogue Overview Strip */}
      <div
        className={`flex items-center gap-6 px-5 py-3 rounded-xl border ${isNightMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}
      >
        <div className="flex items-center gap-2">
          <Pill size={14} className="text-indigo-500" />
          <span className="text-xs text-gray-500">Total Drugs:</span>
          <span
            className={`text-sm font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
          >
            {data?.catalogue_total_drugs?.toLocaleString() || 0}
          </span>
        </div>
        {isNhisFeatureEnabled() && (
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-500" />
            <span className="text-xs text-gray-500">NHIS Covered:</span>
            <span className="text-sm font-bold text-emerald-600">
              {data?.catalogue_nhis_covered?.toLocaleString() || 0}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          <span className="text-xs text-gray-500">Low Stock:</span>
          <span className="text-sm font-bold text-amber-600">
            {data?.catalogue_low_stock || 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Package size={14} className="text-red-500" />
          <span className="text-xs text-gray-500">Out of Stock:</span>
          <span className="text-sm font-bold text-red-600">
            {data?.catalogue_out_of_stock || 0}
          </span>
        </div>
      </div>

      {/* Financial Tabs */}
      <div
        className={`flex items-center gap-1 p-1 rounded-xl ${isNightMode ? 'bg-slate-800' : 'bg-gray-100'}`}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                isActive
                  ? isNightMode
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : isNightMode
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== STOCK VALUE TAB ==================== */}
      {activeTab === 'stock_value' && (
        <div className="space-y-4">
          {/* Value Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Active Stock Items
                  </p>
                  <p
                    className={`text-xl font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                  >
                    {data?.stock_by_drug.length || 0} drugs
                  </p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Across{' '}
                {data?.stock_by_drug.reduce(
                  (sum, d) => sum + d.batch_count,
                  0,
                ) || 0}{' '}
                active batches
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    At-Risk Stock Value
                  </p>
                  <p className="text-xl font-bold text-amber-600">
                    {fmt(
                      (data?.stock_by_drug || [])
                        .filter((d) => d.status === 'at_risk')
                        .reduce((sum, d) => sum + d.selling_value, 0),
                    )}
                  </p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {
                  (data?.stock_by_drug || []).filter(
                    (d) => d.status === 'at_risk',
                  ).length
                }{' '}
                items at low stock or near expiry
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Avg Profit Margin
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    {data?.profit_margin_pct || 0}%
                  </p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Selling vs cost price differential
              </div>
            </Card>
          </div>

          {/* Stock Table Controls */}
          <Card className={`${isNightMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search drugs..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm ${
                      isNightMode
                        ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    } focus:outline-none focus:ring-2 focus:ring-primary-500`}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort by:</span>
                {(['value', 'qty', 'margin'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (stockSort === key)
                        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      else {
                        setStockSort(key);
                        setSortDir('desc');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      stockSort === key
                        ? isNightMode
                          ? 'bg-primary-700 text-white'
                          : 'bg-primary-100 text-primary-700'
                        : isNightMode
                          ? 'text-slate-400 hover:bg-slate-700'
                          : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {key === 'value'
                      ? 'Value'
                      : key === 'qty'
                        ? 'Quantity'
                        : 'Margin'}
                    {stockSort === key &&
                      (sortDir === 'desc' ? (
                        <ChevronDown size={12} className="inline ml-1" />
                      ) : (
                        <ChevronUp size={12} className="inline ml-1" />
                      ))}
                  </button>
                ))}
              </div>
              <ExportDropdown onExport={handleExport} disabled={!data} />
            </div>

            {/* Stock Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className={`text-xs uppercase tracking-wider ${isNightMode ? 'text-slate-400 bg-slate-900/50' : 'text-gray-500 bg-gray-50'}`}
                  >
                    <th className="py-3 px-4 text-left font-medium">Drug</th>
                    <th className="py-3 px-4 text-right font-medium">Stock</th>
                    <th className="py-3 px-4 text-right font-medium">
                      Cost Value
                    </th>
                    <th className="py-3 px-4 text-right font-medium">
                      Selling Value
                    </th>
                    <th className="py-3 px-4 text-right font-medium">Margin</th>
                    <th className="py-3 px-4 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <EmptyState
                          icon={Package}
                          title="No Stock Data"
                          description={
                            stockSearch
                              ? 'No drugs match your search'
                              : 'No active stock batches found'
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((row) => (
                      <StockRow
                        key={row.drug_id}
                        row={row}
                        isNightMode={isNightMode}
                      />
                    ))
                  )}
                </tbody>
                {filteredStock.length > 0 && (
                  <tfoot>
                    <tr
                      className={`border-t-2 ${isNightMode ? 'border-slate-600 bg-slate-900/50' : 'border-gray-300 bg-gray-50'}`}
                    >
                      <td className="py-3 px-4 font-bold text-sm">TOTAL</td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        {filteredStock
                          .reduce((s, r) => s + r.total_qty, 0)
                          .toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        {fmt(
                          filteredStock.reduce((s, r) => s + r.cost_value, 0),
                        )}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold text-sm ${isNightMode ? 'text-green-400' : 'text-green-700'}`}
                      >
                        {fmt(
                          filteredStock.reduce(
                            (s, r) => s + r.selling_value,
                            0,
                          ),
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        {data?.profit_margin_pct}%
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-gray-500">
                          {filteredStock.length} drugs
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== SALES & REVENUE TAB ==================== */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FinStatCard
              label="Total Sales Revenue"
              value={fmt(data?.total_sales_amount || 0)}
              subtitle={`${data?.total_sales_count || 0} medication orders`}
              icon={DollarSign}
              iconBg="bg-green-100"
              iconColor="text-green-600"
              isNightMode={isNightMode}
            />
            {isNhisFeatureEnabled() && (
              <FinStatCard
                label="NHIS Covered"
                value={fmt(data?.total_nhis_payable || 0)}
                subtitle="Paid by insurance"
                icon={Shield}
                iconBg="bg-emerald-100"
                iconColor="text-emerald-600"
                isNightMode={isNightMode}
              />
            )}
            <FinStatCard
              label="Patient Out-of-Pocket"
              value={fmt(data?.total_patient_payable || 0)}
              subtitle="Paid by patients"
              icon={Users}
              iconBg="bg-orange-100"
              iconColor="text-orange-600"
              isNightMode={isNightMode}
            />
            <FinStatCard
              label="Revenue Margin"
              value={`${data?.profit_margin_pct || 0}%`}
              subtitle="Selling vs cost price"
              icon={BarChart3}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
              isNightMode={isNightMode}
            />
          </div>

          {/* Revenue visual breakdown */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3
                  className={`text-base font-semibold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                >
                  Revenue Breakdown
                </h3>
                <p className="text-xs text-gray-500">
                  {isNhisFeatureEnabled()
                    ? 'NHIS vs patient payments'
                    : 'Patient payments'}
                </p>
              </div>
              <ExportDropdown onExport={handleExport} disabled={!data} />
            </div>
            <div className="flex items-center gap-4 mb-4">
              {isNhisFeatureEnabled() && (
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-gray-500">NHIS payable</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-orange-500" />
                <span className="text-xs text-gray-500">Patient Payable</span>
              </div>
            </div>
            <div
              className={`h-6 rounded-full overflow-hidden flex ${isNightMode ? 'bg-slate-700' : 'bg-gray-200'}`}
            >
              {(data?.total_sales_amount || 0) > 0 && (
                <>
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${Math.round(((data?.total_nhis_payable || 0) / (data?.total_sales_amount || 1)) * 100)}%`,
                    }}
                  />
                  <div
                    className="h-full bg-orange-500"
                    style={{
                      width: `${Math.round(((data?.total_patient_payable || 0) / (data?.total_sales_amount || 1)) * 100)}%`,
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>NHIS: {fmt(data?.total_nhis_payable || 0)}</span>
              <span>Patient: {fmt(data?.total_patient_payable || 0)}</span>
            </div>
          </Card>

          {/* Sales Detail Table */}
          <Card className={isNightMode ? 'bg-slate-800' : 'bg-white'}>
            <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-green-600" />
                <h3
                  className={`text-base font-semibold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                >
                  Dispensed Drugs — Sales Records
                </h3>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  {data?.sales_detail.length || 0}
                </span>
              </div>
              <div className="flex-1" />
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search sales..."
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm ${
                    isNightMode
                      ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500`}
                />
              </div>
              <ExportDropdown onExport={handleExport} disabled={!data} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className={`text-xs uppercase tracking-wider ${isNightMode ? 'text-slate-400 bg-slate-900/50' : 'text-gray-500 bg-gray-50'}`}
                  >
                    <th className="py-3 px-3 text-left font-medium">Date</th>
                    <th className="py-3 px-3 text-left font-medium">
                      Receipt #
                    </th>
                    <th className="py-3 px-3 text-left font-medium">Drug</th>
                    <th className="py-3 px-3 text-left font-medium">Patient</th>
                    <th className="py-3 px-3 text-right font-medium">Qty</th>
                    <th className="py-3 px-3 text-right font-medium">Total</th>
                    <th className="py-3 px-3 text-center font-medium">NHIS</th>
                    <th className="py-3 px-3 text-right font-medium">
                      NHIS Pays
                    </th>
                    <th className="py-3 px-3 text-right font-medium">
                      Patient Pays
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <EmptyState
                          icon={Receipt}
                          title="No Sales Records"
                          description={
                            salesSearch
                              ? 'No records match your search'
                              : 'Sales will appear here once drugs are dispensed and billed'
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => (
                      <tr
                        key={sale.id}
                        className={`border-b last:border-0 ${isNightMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-gray-100 hover:bg-gray-50'} transition-colors`}
                      >
                        <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                          {fmtDate(sale.created_at)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs font-mono text-gray-600">
                            {sale.order_number}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div
                            className={`text-sm font-medium truncate max-w-[180px] ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                          >
                            {sale.item_name.replace('Medication: ', '')}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div
                            className={`text-sm ${isNightMode ? 'text-slate-200' : 'text-gray-700'}`}
                          >
                            {sale.patient_name}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {sale.insurance_type}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm">
                          {sale.quantity}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right text-sm font-semibold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                        >
                          {fmt(sale.total_price)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {sale.nhis_covered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                              <Shield size={10} /> {sale.nhis_percentage}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm text-emerald-600 font-medium">
                          {sale.nhis_payable > 0 ? fmt(sale.nhis_payable) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm text-orange-600 font-medium">
                          {sale.patient_payable > 0
                            ? fmt(sale.patient_payable)
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredSales.length > 0 && (
                  <tfoot>
                    <tr
                      className={`border-t-2 ${isNightMode ? 'border-slate-600 bg-slate-900/50' : 'border-gray-300 bg-gray-50'}`}
                    >
                      <td colSpan={5} className="py-3 px-3 font-bold text-sm">
                        TOTALS ({filteredSales.length} records)
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sm">
                        {fmt(
                          filteredSales.reduce((s, r) => s + r.total_price, 0),
                        )}
                      </td>
                      <td className="py-3 px-3" />
                      <td className="py-3 px-3 text-right font-bold text-sm text-emerald-600">
                        {fmt(
                          filteredSales.reduce((s, r) => s + r.nhis_payable, 0),
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sm text-orange-600">
                        {fmt(
                          filteredSales.reduce(
                            (s, r) => s + r.patient_payable,
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== PURCHASE ORDERS TAB ==================== */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FinStatCard
              label="Total Purchase Cost"
              value={fmt(data?.total_purchase_cost || 0)}
              subtitle="Cost of goods received"
              icon={ShoppingCart}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
              isNightMode={isNightMode}
            />
            <FinStatCard
              label="Batches Received"
              value={(data?.total_batches_received || 0).toString()}
              subtitle="All time batch receipts"
              icon={Layers}
              iconBg="bg-indigo-100"
              iconColor="text-indigo-600"
              isNightMode={isNightMode}
            />
            <FinStatCard
              label="Total Units Received"
              value={(data?.total_units_received || 0).toLocaleString()}
              subtitle="All units received into stock"
              icon={Package}
              iconBg="bg-teal-100"
              iconColor="text-teal-600"
              isNightMode={isNightMode}
            />
          </div>

          {/* Monthly Purchase History */}
          <Card className={`${isNightMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3
                  className={`text-base font-semibold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                >
                  Monthly Purchase History
                </h3>
                <p className="text-xs text-gray-500">
                  Cost of goods received by month
                </p>
              </div>
              <ExportDropdown onExport={handleExport} disabled={!data} />
            </div>

            {!data?.monthly_purchases || data.monthly_purchases.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={Calendar}
                  title="No Purchase History"
                  description="Purchase data will appear as batches are received into the system"
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className={`text-xs uppercase tracking-wider ${isNightMode ? 'text-slate-400 bg-slate-900/50' : 'text-gray-500 bg-gray-50'}`}
                    >
                      <th className="py-3 px-4 text-left font-medium">Month</th>
                      <th className="py-3 px-4 text-right font-medium">
                        Purchase Cost
                      </th>
                      <th className="py-3 px-4 text-right font-medium">
                        Units Received
                      </th>
                      <th className="py-3 px-4 text-right font-medium">
                        Batches
                      </th>
                      <th className="py-3 px-4 text-right font-medium">
                        Avg Cost/Unit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly_purchases.map((row, i) => (
                      <tr
                        key={row.month}
                        className={`border-b last:border-0 ${isNightMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-gray-100 hover:bg-gray-50'} transition-colors`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            <span
                              className={`font-medium text-sm ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                            >
                              {row.label}
                            </span>
                          </div>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-semibold text-sm ${isNightMode ? 'text-slate-200' : 'text-gray-900'}`}
                        >
                          {fmt(row.purchase_cost)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600">
                          {row.units_received.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600">
                          {row.batches_received}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600">
                          {row.units_received > 0
                            ? fmt(
                                Math.round(
                                  row.purchase_cost / row.units_received,
                                ),
                              )
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr
                      className={`border-t-2 ${isNightMode ? 'border-slate-600 bg-slate-900/50' : 'border-gray-300 bg-gray-50'}`}
                    >
                      <td className="py-3 px-4 font-bold text-sm">TOTAL</td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        {fmt(
                          data.monthly_purchases.reduce(
                            (s, r) => s + r.purchase_cost,
                            0,
                          ),
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        {data.monthly_purchases
                          .reduce((s, r) => s + r.units_received, 0)
                          .toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        {data.monthly_purchases.reduce(
                          (s, r) => s + r.batches_received,
                          0,
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        —
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {/* Per-Drug Purchase Breakdown */}
          <Card className="p-6">
            <h3
              className={`text-base font-semibold mb-4 ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
            >
              Stock by Drug — Purchase Analysis
            </h3>
            <div className="space-y-3">
              {(data?.stock_by_drug || []).slice(0, 10).map((drug) => {
                const maxVal = Math.max(
                  ...(data?.stock_by_drug || []).map((d) => d.selling_value),
                  1,
                );
                const pct = Math.round((drug.selling_value / maxVal) * 100);
                return (
                  <div key={drug.drug_id} className="flex items-center gap-3">
                    <div className="w-48 truncate">
                      <span
                        className={`text-sm font-medium ${isNightMode ? 'text-slate-200' : 'text-gray-700'}`}
                      >
                        {drug.drug_name}
                      </span>
                    </div>
                    <div
                      className={`flex-1 h-6 rounded-full overflow-hidden ${isNightMode ? 'bg-slate-700' : 'bg-gray-100'}`}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      >
                        {pct > 15 && (
                          <span className="text-xs text-white font-medium">
                            {fmt(drug.selling_value)}
                          </span>
                        )}
                      </div>
                    </div>
                    {pct <= 15 && (
                      <span className="text-xs text-gray-500 w-20 text-right">
                        {fmt(drug.selling_value)}
                      </span>
                    )}
                  </div>
                );
              })}
              {(data?.stock_by_drug || []).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">
                    No stock data available
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

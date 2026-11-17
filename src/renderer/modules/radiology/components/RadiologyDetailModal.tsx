import React, { useState } from 'react';
import {
  X,
  User,
  Calendar,
  FileText,
  Image,
  Stethoscope,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Printer,
  FileImage,
  Shield,
  History,
  Scan,
  Loader,
  XCircle,
  Upload,
  ClipboardList,
} from 'lucide-react';
import { SkeletonModalContent } from '../../../components/ui/SkeletonLoader';
import { Button } from '../../../components/ui/FormElements';
import { StatusBadge } from '../../../components/ui/DataDisplay';
import {
  RadiologyRequestDTO,
  RadiologyRequestStatus,
  getModalityColor,
  ImagingModality,
} from '../dtos/radiology.dto';
import { supabase } from '../../../api/supabaseClient';
import { extractPrintableFields } from '../../../utils/printFieldUtils';
import {
  getFacilityAddress,
  getFacilityName,
} from '../../../lib/facility';

// =============================================================================
// Types
// =============================================================================

interface RadiologyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RadiologyRequestDTO | null;
  onStartProcedure?: (request: RadiologyRequestDTO) => void;
  onUploadImage?: (request: RadiologyRequestDTO) => void;
  onWriteReport?: (request: RadiologyRequestDTO) => void;
  onPrintReport?: (request: RadiologyRequestDTO) => void;
  onCancel?: (request: RadiologyRequestDTO) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

const formatDate = (dateString?: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const calculateAge = (dob?: string | null) => {
  if (!dob) return 'N/A';
  const today = new Date();
  const birthDate = new Date(dob);
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
};

// Secure Image Component for Private Buckets
function SecureImage({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!path) return;

    // If it's already a full URL (http/https), use it directly
    if (path.startsWith('http')) {
      setSrc(path);
      return;
    }

    // Otherwise, treat as storage path and sign it
    const fetchSignedUrl = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('radiology-images')
          .createSignedUrl(path, 3600); // 1 hour expiry

        if (error) throw error;
        if (data?.signedUrl) {
          setSrc(data.signedUrl);
        }
      } catch (err) {
        console.error('Error signing URL:', err);
        setError(true);
      }
    };

    fetchSignedUrl();
  }, [path]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
      >
        <AlertCircle className="h-8 w-8" />
        <span className="ml-2 text-xs">Failed to load</span>
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${className}`}
      >
        <SkeletonModalContent sections={2} />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}

// =============================================================================
// Component
// =============================================================================

export default function RadiologyDetailModal({
  isOpen,
  onClose,
  request,
  onStartProcedure,
  onUploadImage,
  onWriteReport,
  onPrintReport,
  onCancel,
}: RadiologyDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'report'>('details');

  if (!isOpen || !request) return null;

  const isPending = request.status === 'Pending';
  const isOrdered =
    request.status === 'Ordered' || request.status === 'Accepted';
  const isScheduled = request.status === 'Scheduled';
  const isInProgress = request.status === 'In Progress';
  const isImagingCompleted =
    request.status === 'Imaging Completed' || request.status === 'Completed';
  const isAwaitingReport = request.status === 'Awaiting Report';
  const isPreliminary = request.status === 'Preliminary Report';
  const isFinal =
    request.status === 'Final Report' || request.status === 'Reported';
  const isCancelled = request.status === 'Cancelled';

  const hasReport = Boolean(
    request.scan_result || request.findings || request.impression,
  );

  // Print Radiology Report Function
  const handlePrintRadiologyReport = () => {
    const facilityName = getFacilityName();
    const facilityAddress = getFacilityAddress();
    const patientName = request.patient
      ? `${request.patient.first_name || ''} ${request.patient.surname || ''}`.trim()
      : 'Unknown Patient';
    const patientAge = calculateAge(request.patient?.date_of_birth);
    const escapeHtml = (value: unknown): string =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const formatHtmlBlock = (value: unknown): string =>
      escapeHtml(value).replace(/\n/g, '<br/>');

    const scanResultExtraFields = extractPrintableFields(
      (request.scan_result as unknown as Record<string, unknown>) || null,
      {
        excludeKeys: [
          'id',
          'request',
          'reporter',
          'verifier',
          'request_id',
          'scan_request_id',
          'findings',
          'impression',
          'report',
          'notes',
          'technique',
          'comparison',
          'urgency',
          'is_preliminary',
          'reported_at',
          'report_date',
          'verified_at',
        ],
        maxDepth: 3,
      },
    );

    const findingsText =
      request.scan_result?.findings ||
      request.findings ||
      'No findings documented.';
    const impressionText =
      request.scan_result?.impression ||
      request.scan_result?.report ||
      request.report ||
      request.impression ||
      'No impression documented.';
    const notesText =
      request.scan_result?.notes || request.recommendations || null;

    const reportContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Radiology Report - ${request.imaging?.imaging_name || 'Imaging Study'}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            width: 210mm;
            min-height: 297mm;
            padding: 0;
            margin: 0 auto;
            line-height: 1.5;
            font-size: 10pt;
            background: #ffffff;
            color: #1f2937;
          }

          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            background: white;
            margin: 0 auto;
          }

          /* Header */
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 15px;
            border-bottom: 3px solid #059669;
            margin-bottom: 20px;
          }
          .logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .logo {
            width: 70px;
            height: 70px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .hospital-info {
            text-align: left;
          }
          .hospital-name {
            font-size: 18pt;
            font-weight: 800;
            color: #059669;
            letter-spacing: 1px;
            line-height: 1.1;
          }
          .hospital-subtitle {
            font-size: 9pt;
            color: #047857;
            font-weight: 600;
          }
          .department {
            font-size: 8pt;
            color: #6b7280;
            margin-top: 2px;
          }
          .header-right {
            text-align: right;
          }
          .report-title {
            font-size: 11pt;
            font-weight: 700;
            color: #059669;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 8px 15px;
            border: 2px solid #059669;
            border-radius: 5px;
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          }
          .report-ref {
            font-size: 8pt;
            color: #6b7280;
            margin-top: 5px;
          }

          /* Patient Info */
          .patient-section {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border: 2px solid #10b981;
            border-radius: 10px;
            padding: 15px 20px;
            margin-bottom: 20px;
          }
          .patient-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
          }
          .patient-field {
            text-align: center;
          }
          .patient-label {
            font-size: 7pt;
            color: #047857;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          .patient-value {
            font-size: 10pt;
            color: #064e3b;
            font-weight: 600;
          }
          .patient-value.name {
            font-size: 12pt;
            font-weight: 700;
          }

          /* Study Info */
          .study-header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
            color: white;
          }
          .study-name {
            font-size: 14pt;
            font-weight: 700;
          }
          .study-modality {
            font-size: 9pt;
            opacity: 0.9;
            margin-top: 3px;
          }

          /* Sections */
          .section {
            margin-bottom: 15px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 10pt;
            font-weight: 700;
            color: #059669;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding-bottom: 5px;
            margin-bottom: 10px;
            border-bottom: 2px solid #d1fae5;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .section-title::before {
            content: '';
            width: 4px;
            height: 16px;
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            border-radius: 2px;
          }

          /* Content Boxes */
          .content-box {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            white-space: pre-wrap;
          }
          .fields-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .field-row {
            border: 1px solid #dbeafe;
            background: #f8fbff;
            border-radius: 6px;
            padding: 8px;
          }
          .field-label {
            display: block;
            font-size: 8pt;
            color: #475569;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 3px;
          }
          .field-value {
            font-size: 9pt;
            color: #1f2937;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .clinical-box {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 12px 15px;
          }
          .clinical-title {
            font-size: 8pt;
            color: #b45309;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .findings-box {
            background: #eff6ff;
            border: 1px solid #3b82f6;
            border-radius: 8px;
            padding: 15px;
          }
          .impression-box {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 15px;
          }
          .impression-title {
            font-size: 9pt;
            color: #047857;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .impression-text {
            font-size: 11pt;
            color: #064e3b;
            font-weight: 600;
          }

          /* Info Grid */
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 15px;
          }
          .info-item {
            display: flex;
            gap: 10px;
          }
          .info-label {
            font-size: 9pt;
            color: #6b7280;
            min-width: 100px;
          }
          .info-value {
            font-size: 9pt;
            color: #1f2937;
            font-weight: 500;
          }

          /* Signatures */
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            page-break-inside: avoid;
          }
          .signature-box {
            text-align: center;
          }
          .signature-line {
            border-top: 1.5px solid #059669;
            margin-top: 40px;
            padding-top: 5px;
          }
          .signature-name {
            font-weight: 600;
            color: #064e3b;
            font-size: 10pt;
          }
          .signature-title {
            font-size: 8pt;
            color: #6b7280;
          }
          .signature-date {
            font-size: 8pt;
            color: #9ca3af;
            margin-top: 3px;
          }

          /* Footer */
          .footer {
            margin-top: 20px;
            padding-top: 12px;
            border-top: 2px solid #10b981;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8pt;
            color: #6b7280;
          }
          .footer-center {
            text-align: center;
          }
          .footer-logo {
            font-size: 11pt;
            font-weight: 800;
            color: #059669;
          }
          .footer-tagline {
            font-size: 7pt;
          }

          /* Action Bar */
          .action-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            padding: 12px 20px;
            display: flex;
            gap: 12px;
            justify-content: center;
            align-items: center;
            box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
            z-index: 1000;
          }
          .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            font-family: 'Segoe UI', Arial, sans-serif;
          }
          .btn-primary {
            background: white;
            color: #6366f1;
          }
          .btn-primary:hover {
            background: #eef2ff;
          }
          .btn-secondary {
            background: #4338ca;
            color: white;
          }
          .btn-secondary:hover {
            background: #3730a3;
          }
          .btn-outline {
            background: transparent;
            color: white;
            border: 2px solid white;
          }
          .btn-outline:hover {
            background: rgba(255,255,255,0.1);
          }

          @media print {
            body { padding: 0; background: white; }
            .page { padding: 10mm; }
            .action-bar { display: none !important; }
            .section { page-break-inside: avoid; }
            .signatures { page-break-inside: avoid; }
            .fields-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }

          @media screen {
            body { padding-top: 60px; background: #f3f4f6; }
            .page { box-shadow: 0 4px 20px rgba(0,0,0,0.15); margin: 20px auto; }
          }
        </style>
      </head>
      <body>
        <!-- Action Bar -->
        <div class="action-bar">
          <button onclick="window.print()" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Print
          </button>
          <button onclick="downloadReport()" class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download
          </button>
          <button onclick="window.close()" class="btn btn-outline">Close</button>
        </div>

        <div class="page">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <div class="logo">
                <span style="font-size:18px;font-weight:bold;color:#059669;">XenoCare</span>
              </div>
              <div class="hospital-info">
                <div class="hospital-name">${facilityName.toUpperCase()}</div>
                <div class="hospital-subtitle">${facilityAddress || 'Radiology & Diagnostic Imaging'}</div>
                <div class="department">Department of Radiology & Diagnostic Imaging</div>
              </div>
            </div>
            <div class="header-right">
              <div class="report-title">Radiology Report</div>
              <div class="report-ref">REF: ${request.request_id.slice(0, 8).toUpperCase()}</div>
            </div>
          </div>

          <!-- Patient Information -->
          <div class="patient-section">
            <div class="patient-grid">
              <div class="patient-field">
                <div class="patient-label">Patient Name</div>
                <div class="patient-value name">${patientName}</div>
              </div>
              <div class="patient-field">
                <div class="patient-label">Patient number</div>
                <div class="patient-value">${request.patient?.emr_number || 'N/A'}</div>
              </div>
              <div class="patient-field">
                <div class="patient-label">Gender / Age</div>
                <div class="patient-value">${request.patient?.gender || 'N/A'} / ${patientAge}</div>
              </div>
              <div class="patient-field">
                <div class="patient-label">Report Date</div>
                <div class="patient-value">${new Date().toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          <!-- Study Header -->
          <div class="study-header">
            <div class="study-name">${request.imaging?.imaging_name || 'Imaging Study'}</div>
            <div class="study-modality">${request.imaging_type || request.imaging?.imaging_type || 'N/A'} • ${request.body_part || 'N/A'}</div>
          </div>

          <!-- Examination Details -->
          <div class="section">
            <div class="section-title">Examination Details</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Study Type:</span>
                <span class="info-value">${request.imaging?.imaging_name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Modality:</span>
                <span class="info-value">${request.imaging_type || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Request Date:</span>
                <span class="info-value">${formatDate(request.created_at)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Exam Date:</span>
                <span class="info-value">${formatDate(request.procedure_date || request.updated_at)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Referring Doctor:</span>
                <span class="info-value">Dr. ${request.doctor?.first_name || ''} ${request.doctor?.last_name || ''}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Priority:</span>
                <span class="info-value">${request.priority || 'Routine'}</span>
              </div>
            </div>
          </div>

          <!-- Clinical Indication -->
          ${
            request.clinical_notes
              ? `
            <div class="section">
              <div class="section-title">Clinical Indication</div>
              <div class="clinical-box">
                <div class="clinical-title">Clinical History / Reason for Examination</div>
                <p>${request.clinical_notes}</p>
              </div>
            </div>
          `
              : ''
          }

          <!-- Findings -->
          <div class="section">
            <div class="section-title">Findings</div>
            <div class="findings-box">
              ${formatHtmlBlock(findingsText)}
            </div>
          </div>

          <!-- Impression -->
          <div class="section">
            <div class="section-title">Impression / Conclusion</div>
            <div class="impression-box">
              <div class="impression-title">Radiologist's Impression</div>
              <div class="impression-text">${formatHtmlBlock(impressionText)}</div>
            </div>
          </div>

          <!-- Notes / Recommendations -->
          ${
            notesText
              ? `
            <div class="section">
              <div class="section-title">Notes / Recommendations</div>
              <div class="content-box">${formatHtmlBlock(notesText)}</div>
            </div>
          `
              : ''
          }

          ${
            request.scan_result?.technique || request.scan_result?.comparison
              ? `
            <div class="section">
              <div class="section-title">Technical Details</div>
              <div class="info-grid">
                ${
                  request.scan_result?.technique
                    ? `
                  <div class="info-item">
                    <span class="info-label">Technique:</span>
                    <span class="info-value">${formatHtmlBlock(request.scan_result.technique)}</span>
                  </div>
                `
                    : ''
                }
                ${
                  request.scan_result?.comparison
                    ? `
                  <div class="info-item">
                    <span class="info-label">Comparison:</span>
                    <span class="info-value">${formatHtmlBlock(request.scan_result.comparison)}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>
          `
              : ''
          }

          ${
            scanResultExtraFields.length > 0
              ? `
            <div class="section">
              <div class="section-title">All Stored Result Fields</div>
              <div class="fields-grid">
                ${scanResultExtraFields
                  .map(
                    (field) => `
                      <div class="field-row">
                        <span class="field-label">${escapeHtml(field.label)}</span>
                        <span class="field-value">${formatHtmlBlock(field.value)}</span>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          <!-- Signatures -->
          <div class="signatures">
            <div class="signature-box">
              <div class="signature-line">
                <div class="signature-name">
                  ${request.radiologist ? `Dr. ${request.radiologist.first_name} ${request.radiologist.last_name}` : '_________________'}
                </div>
                <div class="signature-title">Reporting Radiologist</div>
                <div class="signature-date">${formatDate(request.updated_at)}</div>
              </div>
            </div>
            <div class="signature-box">
              <div class="signature-line">
                <div class="signature-name">
                  ${request.technologist ? `${request.technologist.first_name} ${request.technologist.last_name}` : '_________________'}
                </div>
                <div class="signature-title">Radiographer / Technologist</div>
                <div class="signature-date">${formatDate(request.procedure_date)}</div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-left">
              This report is part of the patient's<br/>permanent medical record.
            </div>
            <div class="footer-center">
              <div class="footer-logo">${facilityName.toUpperCase()}</div>
              <div class="footer-tagline">Excellence in Healthcare Delivery</div>
            </div>
            <div class="footer-right">
              Form: XC-RAD-001<br/>
              Printed: ${new Date().toLocaleString()}
            </div>
          </div>
        </div>

        <script>
          function downloadReport() {
            const content = document.documentElement.outerHTML;
            const blob = new Blob([content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Radiology_Report_${request.request_id.slice(0, 8).toUpperCase()}.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        </script>
      </body>
      </html>
    `;

    // Open in system default browser
    if (window.electron?.html?.saveAndOpen) {
      const filename = `Radiology_Report_${request.request_id.slice(0, 8)}_${Date.now()}.html`;
      window.electron.html.saveAndOpen(filename, reportContent);
    } else {
      const printWindow = window.open('', '_blank', 'width=900,height=700');
      if (printWindow) {
        printWindow.document.write(reportContent);
        printWindow.document.close();
        printWindow.focus();
      }
    }
  };

  const getStatusIcon = () => {
    if (isFinal) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (isCancelled) return <XCircle className="h-5 w-5 text-red-500" />;
    if (isPreliminary || isAwaitingReport)
      return <FileText className="h-5 w-5 text-orange-500" />;
    if (isImagingCompleted)
      return <FileImage className="h-5 w-5 text-blue-500" />;
    if (isInProgress)
      return <Loader className="h-5 w-5 text-indigo-500 animate-spin" />;
    if (isScheduled) return <Calendar className="h-5 w-5 text-indigo-500" />;
    return <Clock className="h-5 w-5 text-amber-500" />;
  };

  const getStatusBadgeVariant = (
    status: RadiologyRequestStatus,
  ): 'warning' | 'info' | 'success' | 'danger' | 'neutral' => {
    switch (status) {
      case 'Pending':
      case 'Ordered':
      case 'Accepted':
        return 'warning';
      case 'Scheduled':
      case 'In Progress':
      case 'Imaging Completed':
      case 'Awaiting Report':
      case 'Preliminary Report':
      case 'Completed':
        return 'info';
      case 'Final Report':
      case 'Reported':
        return 'success';
      case 'Cancelled':
      case 'Rejected':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const statusTheme = isFinal
    ? {
        container:
          'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200',
        title: 'text-green-800',
        subtitle: 'text-green-600',
      }
    : isCancelled
      ? {
          container:
            'bg-gradient-to-r from-red-50 to-rose-50 border border-red-200',
          title: 'text-red-800',
          subtitle: 'text-red-600',
        }
      : isPreliminary
        ? {
            container:
              'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200',
            title: 'text-amber-800',
            subtitle: 'text-amber-600',
          }
        : isAwaitingReport
          ? {
              container:
                'bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200',
              title: 'text-orange-800',
              subtitle: 'text-orange-600',
            }
          : isImagingCompleted
            ? {
                container:
                  'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200',
                title: 'text-blue-800',
                subtitle: 'text-blue-600',
              }
            : isInProgress
              ? {
                  container:
                    'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200',
                  title: 'text-indigo-800',
                  subtitle: 'text-indigo-600',
                }
              : isScheduled
                ? {
                    container:
                      'bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200',
                    title: 'text-indigo-800',
                    subtitle: 'text-indigo-600',
                  }
                : {
                    container:
                      'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200',
                    title: 'text-amber-800',
                    subtitle: 'text-amber-600',
                  };

  const statusTitle = isFinal
    ? 'Report Finalized'
    : isCancelled
      ? 'Request Cancelled'
      : isPreliminary
        ? 'Preliminary Report Ready'
        : isAwaitingReport
          ? 'Awaiting Report'
          : isImagingCompleted
            ? 'Imaging Completed'
            : isInProgress
              ? 'Procedure In Progress'
              : isScheduled
                ? 'Imaging Scheduled'
                : isOrdered || isPending
                  ? 'Awaiting Scheduling'
                  : 'Pending Imaging';

  const statusDescription = isFinal
    ? 'Radiology report has been finalized'
    : isCancelled
      ? 'This imaging request has been cancelled'
      : isPreliminary
        ? 'Preliminary report saved - awaiting final sign-off'
        : isAwaitingReport
          ? 'Images uploaded - report pending'
          : isImagingCompleted
            ? 'Imaging completed - upload files for reporting'
            : isInProgress
              ? 'Patient is currently undergoing imaging'
              : isScheduled
                ? 'Imaging appointment has been scheduled'
                : 'Awaiting radiology department action';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="relative bg-gray-50 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* EMR Header with NDC Branding */}
          <div className="bg-white border-b border-gray-200 flex-shrink-0">
            {/* Top Bar with Logo and Title */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600">
              <div className="flex items-center gap-4">
                <div className="border-l border-white/30 pl-4">
                  <h1 className="text-white font-bold text-lg tracking-wide">
                    {getFacilityName().toUpperCase()}
                  </h1>
                  <p className="text-green-100 text-xs font-medium">
                    {getFacilityAddress() || 'Radiology Request Details'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-4">
                  <p className="text-white text-sm font-medium">
                    REQ #{request.request_id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-green-100 text-xs">
                    {new Date(request.created_at).toLocaleDateString('en-NG', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6 bg-gray-50">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'details'
                    ? 'text-primary-700 border-b-2 border-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Request Details
                </div>
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'report'
                    ? 'text-primary-700 border-b-2 border-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Imaging Report
                  {(hasReport || isFinal || isPreliminary) && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      1
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            {activeTab === 'details' && (
              <div className="p-6 space-y-5">
                {/* Status Banner */}
                <div
                  className={`p-4 rounded-xl flex items-center justify-between ${statusTheme.container}`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon()}
                    <div>
                      <p className={`font-semibold ${statusTheme.title}`}>
                        {statusTitle}
                      </p>
                      <p className={`text-xs ${statusTheme.subtitle}`}>
                        {statusDescription}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    status={request.status}
                    variant={getStatusBadgeVariant(request.status)}
                  />
                </div>

                {/* Priority Badge (if urgent/emergency) */}
                {(request.priority === 'Urgent' ||
                  request.priority === 'Emergency') && (
                  <div
                    className={`p-3 rounded-xl flex items-center gap-3 ${
                      request.priority === 'Emergency'
                        ? 'bg-red-100 border border-red-300'
                        : 'bg-orange-100 border border-orange-300'
                    }`}
                  >
                    <AlertCircle
                      className={`h-5 w-5 ${
                        request.priority === 'Emergency'
                          ? 'text-red-600'
                          : 'text-orange-600'
                      }`}
                    />
                    <div>
                      <p
                        className={`font-semibold ${
                          request.priority === 'Emergency'
                            ? 'text-red-800'
                            : 'text-orange-800'
                        }`}
                      >
                        {request.priority} Priority
                      </p>
                      <p
                        className={`text-xs ${
                          request.priority === 'Emergency'
                            ? 'text-red-600'
                            : 'text-orange-600'
                        }`}
                      >
                        This request requires immediate attention
                      </p>
                    </div>
                  </div>
                )}

                {/* Patient Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-blue-100 rounded-xl">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Patient Information
                      </h3>
                      <p className="text-xs text-gray-500">
                        Patient undergoing imaging
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {request.patient?.first_name?.charAt(0)}
                      {request.patient?.surname?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-semibold text-gray-900">
                        {request.patient?.first_name}{' '}
                        {request.patient?.middle_name}{' '}
                        {request.patient?.surname}
                      </h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>{request.patient?.gender || 'N/A'}</span>
                        <span>•</span>
                        <span>
                          {calculateAge(request.patient?.date_of_birth)}
                        </span>
                        <span>•</span>
                        <span>
                          {request.patient?.contact_phone || 'No phone'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Patient Allergies Warning */}
                  {request.patient?.known_allergies && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <Shield className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-800 uppercase">
                          Known Allergies
                        </p>
                        <p className="text-sm text-red-700">
                          {Array.isArray(request.patient.known_allergies)
                            ? request.patient.known_allergies.join(', ')
                            : request.patient.known_allergies}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Imaging Details Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-purple-100 rounded-xl">
                      <Scan className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Imaging Details
                      </h3>
                      <p className="text-xs text-gray-500">
                        Procedure information and specifications
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 mb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getModalityColor(
                              request.imaging_type as ImagingModality,
                            )}`}
                          >
                            {request.imaging_type}
                          </span>
                          {request.priority && (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                request.priority === 'Emergency'
                                  ? 'bg-red-100 text-red-800'
                                  : request.priority === 'Urgent'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {request.priority}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-900 text-xl">
                          {request.imaging?.imaging_name || 'Unknown Procedure'}
                        </h4>
                        <p className="text-sm text-purple-700 font-medium mt-0.5">
                          {request.body_part || 'Body part not specified'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">
                          Code
                        </span>
                        <p className="text-sm font-medium text-gray-700">
                          {request.imaging?.imaging_code || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Modality
                      </p>
                      <p className="font-medium text-gray-900">
                        {request.imaging_type}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Body Part
                      </p>
                      <p className="font-medium text-gray-900">
                        {request.body_part || 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Cost
                      </p>
                      <p className="font-medium text-gray-900">
                        ₦{request.imaging?.price?.toLocaleString() || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Clinical Information Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                      <Stethoscope className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Clinical Information
                      </h3>
                      <p className="text-xs text-gray-500">
                        Reason for imaging and clinical context
                      </p>
                    </div>
                  </div>

                  {/* Diagnosis / Indication Tags */}
                  {request.diagnosis && request.diagnosis.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-emerald-800 uppercase mb-2">
                        Diagnosis / Indication
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {request.diagnosis.map((dx, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200"
                          >
                            {dx}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-800 uppercase mb-2">
                      Clinical Notes
                    </p>
                    <p className="text-gray-900">
                      {request.clinical_indication ||
                        request.clinical_notes ||
                        'No clinical notes provided'}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow">
                      {request.doctor?.first_name?.charAt(0)}
                      {request.doctor?.last_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Ordered By</p>
                      <p className="font-semibold text-gray-900">
                        {request.doctor
                          ? `Dr. ${request.doctor.first_name} ${request.doctor.last_name}`
                          : 'Unknown Physician'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timeline Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-amber-100 rounded-xl">
                      <History className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Timeline
                      </h3>
                      <p className="text-xs text-gray-500">
                        Request and procedure timeline
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-xs text-gray-500 uppercase tracking-wider">
                          Requested
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {formatDate(request.created_at)}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-xs text-gray-500 uppercase tracking-wider">
                          Scheduled
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {formatDate(request.scheduled_date)}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Scan className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-blue-600 uppercase tracking-wider">
                          Performed
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {formatDate(
                          request.performed_at ||
                            request.scan_result?.reported_at,
                        )}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-blue-600 uppercase tracking-wider">
                          Performed By
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {request.radiologist
                          ? `${request.radiologist.first_name} ${request.radiologist.last_name}`
                          : request.scan_result?.reporter
                            ? `${request.scan_result.reporter.first_name} ${request.scan_result.reporter.last_name}`
                            : 'Not yet performed'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {request.notes && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                      <div className="p-2.5 bg-gray-100 rounded-xl">
                        <FileText className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Additional Notes
                        </h3>
                        <p className="text-xs text-gray-500">
                          Extra information about the request
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-700">{request.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Report Tab */}
            {activeTab === 'report' && (
              <div className="p-6 space-y-5">
                {/* Results Section (if completed/reported) */}
                {request.findings ||
                request.impression ||
                request.report ||
                request.scan_result ? (
                  <>
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                        <div className="p-2.5 bg-green-100 rounded-xl">
                          <FileText className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">
                            Radiology Report
                          </h3>
                          <p className="text-xs text-gray-500">
                            Findings and radiologist impression
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={request.status}
                            variant={getStatusBadgeVariant(
                              request.status as RadiologyRequestStatus,
                            )}
                          />
                          {request.scan_result?.is_preliminary && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                              Preliminary
                            </span>
                          )}
                          {request.scan_result?.urgency &&
                            request.scan_result.urgency !== 'Normal' && (
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  request.scan_result.urgency === 'Stat'
                                    ? 'bg-red-100 text-red-800'
                                    : request.scan_result.urgency === 'Urgent'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {request.scan_result.urgency}
                              </span>
                            )}
                        </div>
                      </div>

                      {/* Technique */}
                      {request.scan_result?.technique && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                            Technique
                          </p>
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-gray-700 text-sm">
                              {request.scan_result.technique}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Comparison */}
                      {request.scan_result?.comparison && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                            Comparison
                          </p>
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-gray-700 text-sm">
                              {request.scan_result.comparison}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Findings */}
                      {(request.findings || request.scan_result?.findings) && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                            Findings
                          </p>
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <p className="text-gray-800 whitespace-pre-wrap">
                              {request.scan_result?.findings ||
                                request.findings}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Impression / Report */}
                      {(request.impression ||
                        request.report ||
                        request.scan_result?.impression) && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                            Impression / Report
                          </p>
                          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                            <p className="text-gray-800 whitespace-pre-wrap font-medium">
                              {request.scan_result?.impression ||
                                request.impression ||
                                request.report}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Additional Notes / Recommendations */}
                      {request.scan_result?.notes && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                            Additional Notes / Recommendations
                          </p>
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                            <p className="text-gray-800 whitespace-pre-wrap">
                              {request.scan_result.notes}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Reported/Verified By */}
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                        {request.scan_result?.reporter && (
                          <div className="text-sm">
                            <p className="text-xs text-gray-500 uppercase mb-1">
                              Reported By
                            </p>
                            <p className="font-medium text-gray-900">
                              {request.scan_result.reporter.first_name}{' '}
                              {request.scan_result.reporter.last_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(request.scan_result.created_at)}
                            </p>
                          </div>
                        )}
                        {request.scan_result?.verifier && (
                          <div className="text-sm">
                            <p className="text-xs text-gray-500 uppercase mb-1">
                              Verified By
                            </p>
                            <p className="font-medium text-gray-900">
                              {request.scan_result.verifier.first_name}{' '}
                              {request.scan_result.verifier.last_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(request.scan_result.verified_at)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Image Preview (if available) */}
                    {(request.result_file_url ||
                      request.image_url ||
                      (request.scan_images &&
                        request.scan_images.length > 0)) && (
                      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                          <div className="p-2.5 bg-indigo-100 rounded-xl">
                            <Image className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-gray-900">
                              Imaging Results
                            </h3>
                            <p className="text-xs text-gray-500">
                              {request.scan_images?.length || 1} image(s)
                              available
                            </p>
                          </div>
                        </div>

                        {request.scan_images &&
                        request.scan_images.length > 0 ? (
                          <div className="grid grid-cols-2 gap-4">
                            {request.scan_images.map((img, idx) => (
                              <div
                                key={img.image_id || idx}
                                className={`rounded-xl overflow-hidden border ${
                                  img.is_key_image
                                    ? 'border-yellow-400 ring-2 ring-yellow-200'
                                    : 'border-gray-200'
                                }`}
                              >
                                {/* Image */}
                                <div className="p-3 bg-gray-900 relative">
                                  <SecureImage
                                    path={img.image_url || img.image_path}
                                    alt={
                                      img.description || `Scan Image ${idx + 1}`
                                    }
                                    className="w-full h-48 rounded-lg object-contain"
                                  />
                                  {/* Key Image Badge */}
                                  {img.is_key_image && (
                                    <div className="absolute top-4 right-4 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
                                      KEY IMAGE
                                    </div>
                                  )}
                                  {/* Sequence Badge */}
                                  <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded">
                                    #{img.sequence_number || idx + 1}
                                  </div>
                                </div>
                                {/* Image Details */}
                                <div className="p-3 bg-gray-50">
                                  <div className="flex items-center justify-between mb-1">
                                    {img.view_plane && (
                                      <span className="font-semibold text-purple-700 text-sm">
                                        {img.view_plane}
                                      </span>
                                    )}
                                    {img.file_size && (
                                      <span className="text-xs text-gray-400">
                                        {(img.file_size / 1024).toFixed(1)} KB
                                      </span>
                                    )}
                                  </div>
                                  {img.file_name && (
                                    <p
                                      className="text-xs text-gray-500 truncate"
                                      title={img.file_name}
                                    >
                                      {img.file_name}
                                    </p>
                                  )}
                                  {img.notes && (
                                    <p className="text-xs text-gray-600 mt-2 italic border-t border-gray-200 pt-2">
                                      {img.notes}
                                    </p>
                                  )}
                                  {img.description && !img.view_plane && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {img.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-900 rounded-xl flex items-center justify-center min-h-[200px]">
                            <SecureImage
                              path={
                                request.result_file_url ||
                                request.image_url ||
                                ''
                              }
                              alt="Radiology Image"
                              className="max-h-[400px] rounded-lg object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
                    <FileImage className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">
                      No Report Yet
                    </h3>
                    <p className="text-sm text-gray-500">
                      The radiology report has not been submitted for this
                      request
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with Actions */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Request ID: {request.request_id}
              </div>
              <div className="flex items-center gap-3">
                {/* Print button - show when report is available */}
                {isFinal && (
                  <button
                    onClick={handlePrintRadiologyReport}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-md transition-all"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Report
                  </button>
                )}
                {(isPending || isOrdered) && onCancel && (
                  <Button
                    variant="secondary"
                    onClick={() => onCancel(request)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Cancel Request
                  </Button>
                )}
                {isScheduled && onStartProcedure && (
                  <Button
                    onClick={() => onStartProcedure(request)}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Start Procedure
                  </Button>
                )}
                {isImagingCompleted && onUploadImage && (
                  <Button
                    onClick={() => onUploadImage(request)}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Images
                  </Button>
                )}
                {(isAwaitingReport || isPreliminary) && onWriteReport && (
                  <Button
                    onClick={() => onWriteReport(request)}
                    className="bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-[#007538] text-white px-6"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Write Report
                  </Button>
                )}
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// XENOCARE EMR - Procedure Details Component
// Detailed view of a single procedure with status management
// =============================================================================

import React, { useState } from 'react';
import {
  ArrowLeft,
  User,
  Calendar,
  Clock,
  Activity,
  Building2,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  XCircle,
  FileText,
  Package,
  Edit,
  Printer,
  MoreVertical,
  FileSignature,
  Stethoscope,
} from 'lucide-react';
import {
  useUpdateProcedureStatus,
  useCancelProcedure,
} from '../hooks/useProcedures';
import ProcedureChecklist from './ProcedureChecklist';
import ProcedureNotes from './ProcedureNotes';
import ConsumablesTracker from './ConsumablesTracker';
import type { ValidationResult } from '../utils/checklistRulesEngine';
import ProcedureTimer from './ProcedureTimer';
import type { Procedure, ProcedureStatus } from '../../../types/database.types';
import { UniversalOrderButton } from '../../../components/orders/UniversalOrderButton';

interface ProcedureDetailsProps {
  procedure: Procedure;
  onBack: () => void;
}

const statusConfig: Record<
  ProcedureStatus,
  { icon: React.ReactNode; color: string; bgColor: string; label: string }
> = {
  scheduled: {
    icon: <Clock className="h-5 w-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Scheduled',
  },
  pre_op: {
    icon: <Clock className="h-5 w-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Pre-Op',
  },
  in_progress: {
    icon: <PlayCircle className="h-5 w-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'In Progress',
  },
  completed: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Completed',
  },
  cancelled: {
    icon: <XCircle className="h-5 w-5" />,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    label: 'Cancelled',
  },
  postponed: {
    icon: <PauseCircle className="h-5 w-5" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Postponed',
  },
  complications: {
    icon: <AlertTriangle className="h-5 w-5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Complications',
  },
};

type TabType = 'overview' | 'checklist' | 'notes' | 'consumables';

const ProcedureDetails: React.FC<ProcedureDetailsProps> = ({
  procedure,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showActions, setShowActions] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // Timer-based completion control - completion only allowed after scheduled time elapsed
  const [canComplete, setCanComplete] = useState<boolean>(
    // Allow completion if no duration set, or if procedure already completed/cancelled
    !procedure.scheduled_duration_minutes ||
      procedure.status === 'completed' ||
      procedure.status === 'cancelled',
  );

  // Checklist validation state - controls status transitions based on checklist completion
  const [checklistValidation, setChecklistValidation] =
    useState<ValidationResult | null>(null);

  const updateStatus = useUpdateProcedureStatus();
  const cancelProcedure = useCancelProcedure();

  const status = statusConfig[procedure.status];

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <Activity className="h-4 w-4" />,
    },
    {
      id: 'checklist',
      label: 'Checklist',
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    { id: 'notes', label: 'Notes', icon: <FileText className="h-4 w-4" /> },
    {
      id: 'consumables',
      label: 'Consumables',
      icon: <Package className="h-4 w-4" />,
    },
  ];

  const handleStatusChange = async (newStatus: ProcedureStatus) => {
    try {
      await updateStatus.mutateAsync({
        procedureId: procedure.id,
        status: newStatus,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason) return;
    try {
      await cancelProcedure.mutateAsync({
        procedureId: procedure.id,
        reason: cancelReason,
      });
      setShowCancelModal(false);
    } catch (error) {
      console.error('Failed to cancel procedure:', error);
    }
  };

  const getAvailableActions = () => {
    const actions: {
      label: string;
      status: ProcedureStatus;
      color: string;
      disabled?: boolean;
      tooltip?: string;
    }[] = [];

    // Check if checklist validation allows starting procedure
    const canStart = checklistValidation?.canProceed ?? true;
    const startBlockedReason =
      checklistValidation && !checklistValidation.canProceed
        ? checklistValidation.blockers.map((b) => b.itemText).join(', ')
        : '';

    // Check if checklist allows completion
    const canCompleteChecklist = checklistValidation?.canProceed ?? true;
    const completeBlockedReason =
      checklistValidation && !checklistValidation.canProceed
        ? checklistValidation.blockers.map((b) => b.itemText).join(', ')
        : '';

    switch (procedure.status) {
      case 'scheduled':
        actions.push(
          { label: 'Start Pre-Op', status: 'pre_op', color: 'text-purple-600' },
          { label: 'Postpone', status: 'postponed', color: 'text-orange-600' },
        );
        break;
      case 'pre_op':
        actions.push(
          {
            label: canStart
              ? 'Start Procedure'
              : 'Start Procedure (Checklist Incomplete)',
            status: 'in_progress',
            color: canStart ? 'text-amber-600' : 'text-gray-400',
            disabled: !canStart,
            tooltip: startBlockedReason || undefined,
          },
          { label: 'Postpone', status: 'postponed', color: 'text-orange-600' },
        );
        break;
      case 'in_progress':
        {
          const canCompleteNow = canComplete && canCompleteChecklist;
          let label = 'Complete Procedure';
          if (!canComplete) label = 'Complete (Time Remaining)';
          else if (!canCompleteChecklist)
            label = 'Complete (Checklist Incomplete)';
          actions.push(
            {
              label,
              status: 'completed',
              color: canCompleteNow ? 'text-green-600' : 'text-gray-400',
              disabled: !canCompleteNow,
              tooltip: completeBlockedReason || undefined,
            },
            {
              label: 'Report Complications',
              status: 'complications',
              color: 'text-red-600',
            },
          );
        }
        break;
      case 'postponed':
        actions.push({
          label: 'Resume Procedure',
          status: 'scheduled',
          color: 'text-blue-600',
        });
        break;
      case 'complications':
        {
          const canCompleteNow = canComplete && canCompleteChecklist;
          let label = 'Mark Completed';
          if (!canComplete) label = 'Mark Completed (Time Remaining)';
          else if (!canCompleteChecklist)
            label = 'Mark Completed (Checklist Incomplete)';
          actions.push({
            label,
            status: 'completed',
            color: canCompleteNow ? 'text-green-600' : 'text-gray-400',
            disabled: !canCompleteNow,
            tooltip: completeBlockedReason || undefined,
          });
        }
        break;
    }

    return actions;
  };

  const handlePrintDetails = () => {
    setShowActions(false);

    // Format dates
    const scheduledDate = procedure.scheduled_date
      ? new Date(procedure.scheduled_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Not scheduled';
    const scheduledTime = procedure.actual_start_time
      ? new Date(procedure.actual_start_time).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Not set';

    // Build print content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Procedure Details - ${procedure.procedure_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px; 
            padding-top: 80px;
            max-width: 800px; 
            margin: 0 auto;
            line-height: 1.5;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #333; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
          }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header h2 { font-size: 18px; color: #666; font-weight: normal; }
          .section { margin-bottom: 25px; }
          .section-title { 
            font-size: 14px; 
            font-weight: bold; 
            color: #333; 
            border-bottom: 1px solid #ddd; 
            padding-bottom: 5px; 
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .field { margin-bottom: 10px; }
          .field-label { font-size: 11px; color: #666; text-transform: uppercase; }
          .field-value { font-size: 14px; color: #333; }
          .status-badge { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold;
          }
          .status-scheduled { background: #dbeafe; color: #1d4ed8; }
          .status-pre_op { background: #f3e8ff; color: #7c3aed; }
          .status-in_progress { background: #fef3c7; color: #d97706; }
          .status-completed { background: #dcfce7; color: #16a34a; }
          .status-cancelled { background: #f3f4f6; color: #6b7280; }
          .status-postponed { background: #ffedd5; color: #D96A36; }
          .status-complications { background: #fee2e2; color: #dc2626; }
          .full-width { grid-column: 1 / -1; }
          .indication { 
            background: #f9fafb; 
            padding: 15px; 
            border-radius: 8px; 
            border: 1px solid #e5e7eb;
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #ddd; 
            font-size: 11px; 
            color: #666; 
            text-align: center; 
          }
          /* Action Bar */
          .action-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            padding: 12px 20px;
            display: flex;
            gap: 12px;
            justify-content: center;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
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
            font-family: Arial, sans-serif;
          }
          .btn-primary {
            background: white;
            color: #1e40af;
          }
          .btn-primary:hover {
            background: #f0f9ff;
            transform: translateY(-1px);
          }
          .btn-secondary {
            background: #22c55e;
            color: white;
          }
          .btn-secondary:hover {
            background: #16a34a;
            transform: translateY(-1px);
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
            body { padding: 20px; padding-top: 20px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <!-- Action Bar -->
        <div class="action-bar no-print">
          <button onclick="window.print()" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Print
          </button>
          <button onclick="downloadHTML()" class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download
          </button>
          <button onclick="window.close()" class="btn btn-outline">Close</button>
        </div>

        <div class="header">
          <h1>XenoCare - Procedure Details</h1>
          <h2>${procedure.procedure_number}</h2>
        </div>
        
        <div class="section">
          <div class="section-title">Procedure Information</div>
          <div class="grid">
            <div class="field">
              <div class="field-label">Procedure Name</div>
              <div class="field-value">${procedure.procedure_name || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Status</div>
              <div class="field-value">
                <span class="status-badge status-${procedure.status}">${status.label}</span>
              </div>
            </div>
            <div class="field">
              <div class="field-label">Priority</div>
              <div class="field-value" style="text-transform: capitalize;">${procedure.priority || 'Normal'}</div>
            </div>
            <div class="field">
              <div class="field-label">Procedure Code</div>
              <div class="field-value">${procedure.procedure_code || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Schedule</div>
          <div class="grid">
            <div class="field">
              <div class="field-label">Scheduled Date</div>
              <div class="field-value">${scheduledDate}</div>
            </div>
            <div class="field">
              <div class="field-label">Scheduled Time</div>
              <div class="field-value">${scheduledTime}</div>
            </div>
            <div class="field">
              <div class="field-label">Location</div>
              <div class="field-value">${procedure.location || 'Not specified'}</div>
            </div>
            <div class="field">
              <div class="field-label">Estimated Duration</div>
              <div class="field-value">${procedure.scheduled_duration_minutes ? `${procedure.scheduled_duration_minutes} minutes` : 'Not specified'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Patient & Team</div>
          <div class="grid">
            <div class="field">
              <div class="field-label">Patient ID</div>
              <div class="field-value">${procedure.patient_id}</div>
            </div>
            <div class="field">
              <div class="field-label">Primary Surgeon</div>
              <div class="field-value">${procedure.primary_surgeon_id ? procedure.primary_surgeon_id : 'Not assigned'}</div>
            </div>
            <div class="field">
              <div class="field-label">Encounter ID</div>
              <div class="field-value">${procedure.encounter_id || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">Created By</div>
              <div class="field-value">${procedure.created_by || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Clinical Details</div>
          <div class="indication">
            <div class="field-label">Indication / Reason for Procedure</div>
            <div class="field-value" style="margin-top: 5px;">${procedure.indication || 'No indication provided'}</div>
          </div>
        </div>

        ${
          procedure.procedure_notes
            ? `
        <div class="section">
          <div class="section-title">Procedure Notes</div>
          <div class="indication">
            <div class="field-value">${procedure.procedure_notes}</div>
          </div>
        </div>
        `
            : ''
        }

        ${
          procedure.post_op_instructions
            ? `
        <div class="section">
          <div class="section-title">Post-Op Instructions</div>
          <div class="indication">
            <div class="field-value">${procedure.post_op_instructions}</div>
          </div>
        </div>
        `
            : ''
        }

        ${
          procedure.complications
            ? `
        <div class="section">
          <div class="section-title">Complications</div>
          <div class="indication" style="border-color: #fca5a5; background: #fef2f2;">
            <div class="field-value">${procedure.complications}</div>
          </div>
        </div>
        `
            : ''
        }

        <div class="footer">
          Printed on ${new Date().toLocaleString()} | XenoCare System
        </div>

        <script>
          function downloadHTML() {
            const content = document.documentElement.outerHTML;
            const blob = new Blob([content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Procedure_Details_${procedure.procedure_number}.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        </script>
      </body>
      </html>
    `;

    // Open in system default browser using Electron API
    if (window.electron?.html?.saveAndOpen) {
      const filename = `Procedure_Details_${procedure.procedure_number}_${Date.now()}.html`;
      window.electron.html.saveAndOpen(filename, printContent);
    } else {
      // Fallback for non-Electron environment
      const printWindow = window.open(
        '',
        '_blank',
        'width=900,height=700,menubar=yes,toolbar=yes,scrollbars=yes,resizable=yes',
      );
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
      }
    }
  };

  const handlePrintConsentForm = () => {
    setShowActions(false);

    // Format dates
    const scheduledDate = procedure.scheduled_date
      ? new Date(procedure.scheduled_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Not scheduled';
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Get patient info
    const patientName = procedure.patient
      ? `${procedure.patient.first_name || ''} ${procedure.patient.surname || ''}`.trim()
      : 'Patient Name';
    const emrNumber = procedure.patient?.emr_number || 'N/A';
    // Note: procedure.encounter_id is a UUID, not a display number
    // Use procedure_number as the reference number for the form
    const procedureRef = procedure.procedure_number || 'N/A';

    // Build consent form content with NDC Branding - A4 Size, Green Theme
    const consentContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Procedure Consent Form - ${procedure.procedure_number}</title>
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
          
          /* A4 Page Container */
          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            background: white;
            margin: 0 auto;
          }
          
          /* NDC Header - Green Branding */
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
            font-size: 20pt;
            font-weight: 800;
            color: #059669;
            letter-spacing: 1px;
            line-height: 1.1;
          }
          .hospital-subtitle {
            font-size: 9pt;
            color: #047857;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .hospital-tagline {
            font-size: 8pt;
            color: #6b7280;
            margin-top: 3px;
            font-style: italic;
          }
          .header-right {
            text-align: right;
          }
          .form-title {
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
          .form-ref {
            font-size: 8pt;
            color: #6b7280;
            margin-top: 5px;
          }

          /* Patient Info Banner */
          .patient-banner {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border: 2px solid #10b981;
            border-radius: 10px;
            padding: 15px 20px;
            margin-bottom: 20px;
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
            font-size: 11pt;
            color: #064e3b;
            font-weight: 600;
          }
          .patient-value.name {
            font-size: 13pt;
            font-weight: 700;
          }

          /* Procedure Box */
          .procedure-box {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            border-radius: 10px;
            padding: 18px;
            margin-bottom: 18px;
            text-align: center;
            box-shadow: 0 3px 10px rgba(5, 150, 105, 0.3);
          }
          .procedure-label {
            font-size: 8pt;
            color: rgba(255,255,255,0.8);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
          }
          .procedure-name {
            font-size: 14pt;
            font-weight: 700;
            color: white;
          }
          .procedure-code {
            font-size: 9pt;
            color: rgba(255,255,255,0.7);
            margin-top: 3px;
          }

          /* Section Styling */
          .section {
            margin-bottom: 15px;
          }
          .section-title {
            font-size: 10pt;
            font-weight: 700;
            color: #059669;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding-bottom: 5px;
            margin-bottom: 8px;
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
          .section-content {
            font-size: 9.5pt;
            color: #374151;
            text-align: justify;
          }
          .consent-list {
            margin: 8px 0 8px 20px;
          }
          .consent-list li {
            margin-bottom: 5px;
            font-size: 9pt;
          }
          .indication-box {
            background: #f9fafb;
            border-left: 4px solid #10b981;
            padding: 10px 15px;
            margin: 10px 0;
            border-radius: 0 8px 8px 0;
          }
          .indication-label {
            font-size: 8pt;
            color: #059669;
            font-weight: 600;
            text-transform: uppercase;
          }
          .indication-text {
            font-size: 10pt;
            color: #1f2937;
            margin-top: 3px;
          }

          /* Checkbox Section */
          .checkbox-section {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            margin: 15px 0;
          }
          .checkbox-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 8px;
            padding: 6px 8px;
            background: white;
            border-radius: 5px;
          }
          .checkbox {
            width: 14px;
            height: 14px;
            border: 2px solid #10b981;
            border-radius: 3px;
            flex-shrink: 0;
            margin-top: 2px;
          }
          .checkbox-text {
            font-size: 9pt;
            color: #374151;
          }

          /* Signature Section */
          .signature-section {
            border: 2px solid #10b981;
            border-radius: 10px;
            padding: 15px;
            margin-top: 15px;
            background: linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%);
          }
          .signature-title {
            font-size: 10pt;
            font-weight: 700;
            color: #059669;
            text-transform: uppercase;
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #d1fae5;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .signature-box {
            background: white;
            border: 1px solid #d1fae5;
            border-radius: 8px;
            padding: 12px;
          }
          .signature-box h4 {
            font-size: 8pt;
            color: #059669;
            text-transform: uppercase;
            font-weight: 700;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e5e7eb;
          }
          .sig-line {
            border-bottom: 1.5px solid #059669;
            height: 30px;
            margin-bottom: 3px;
          }
          .sig-label {
            font-size: 7pt;
            color: #6b7280;
          }
          .sig-field {
            margin-top: 10px;
          }

          /* Footer */
          .footer {
            margin-top: 20px;
            padding-top: 12px;
            border-top: 2px solid #10b981;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .footer-left {
            font-size: 8pt;
            color: #6b7280;
          }
          .footer-center {
            text-align: center;
          }
          .footer-logo {
            font-size: 12pt;
            font-weight: 800;
            color: #059669;
            letter-spacing: 1px;
          }
          .footer-tagline {
            font-size: 7pt;
            color: #6b7280;
          }
          .footer-right {
            font-size: 7pt;
            color: #9ca3af;
            text-align: right;
          }

          /* Action Bar */
          .action-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            padding: 12px 20px;
            display: flex;
            gap: 12px;
            justify-content: center;
            align-items: center;
            box-shadow: 0 2px 10px rgba(5, 150, 105, 0.3);
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
            color: #059669;
          }
          .btn-primary:hover {
            background: #ecfdf5;
            transform: translateY(-1px);
          }
          .btn-secondary {
            background: #064e3b;
            color: white;
          }
          .btn-secondary:hover {
            background: #065f46;
            transform: translateY(-1px);
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
            body { 
              padding: 0; 
              background: white;
            }
            .page {
              padding: 10mm;
            }
            .action-bar { display: none !important; }
            .no-print { display: none !important; }
            
            /* Prevent hanging headers - keep headers with content */
            .section {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .section-title {
              page-break-after: avoid;
              break-after: avoid;
            }
            .signature-section {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .signature-title {
              page-break-after: avoid;
              break-after: avoid;
            }
            .signature-box {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .signature-box h4 {
              page-break-after: avoid;
              break-after: avoid;
            }
            .checkbox-section {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .patient-banner {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .procedure-box {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .indication-box {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .header {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .footer {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            h4 {
              page-break-after: avoid;
              break-after: avoid;
            }
            /* Ensure proper widow/orphan control */
            p, li {
              orphans: 3;
              widows: 3;
            }
          }

          @media screen {
            body {
              padding-top: 60px;
              background: #f3f4f6;
            }
            .page {
              box-shadow: 0 4px 20px rgba(0,0,0,0.15);
              margin: 20px auto;
            }
          }
        </style>
      </head>
      <body>
        <!-- Action Bar -->
        <div class="action-bar no-print">
          <button onclick="window.print()" class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Print
          </button>
          <button onclick="downloadForm()" class="btn btn-secondary">
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
                <div class="hospital-name">XENOCARE</div>
                <div class="hospital-subtitle">National Diagnostic Center</div>
                <div class="hospital-tagline">Excellence in Healthcare Delivery</div>
              </div>
            </div>
            <div class="header-right">
              <div class="form-title">Consent Form</div>
              <div class="form-ref">REF: ${procedure.procedure_number}</div>
            </div>
          </div>

          <!-- Patient Information Banner -->
          <div class="patient-banner">
            <div class="patient-field">
              <div class="patient-label">Patient Name</div>
              <div class="patient-value name">${patientName}</div>
            </div>
            <div class="patient-field">
              <div class="patient-label">Patient number</div>
              <div class="patient-value">${emrNumber}</div>
            </div>
            <div class="patient-field">
              <div class="patient-label">Procedure No.</div>
              <div class="patient-value">${procedureRef}</div>
            </div>
            <div class="patient-field">
              <div class="patient-label">Date</div>
              <div class="patient-value">${new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <!-- Procedure Box -->
          <div class="procedure-box">
            <div class="procedure-label">Procedure to be Performed</div>
            <div class="procedure-name">${procedure.procedure_name || 'Procedure Name'}</div>
            ${procedure.procedure_code ? `<div class="procedure-code">Code: ${procedure.procedure_code}</div>` : ''}
          </div>

          <!-- Indication -->
          <div class="indication-box">
            <div class="indication-label">Indication / Reason for Procedure</div>
            <div class="indication-text">${procedure.indication || 'To be documented by the attending physician'}</div>
          </div>

          <!-- Consent Statement -->
          <div class="section">
            <div class="section-title">Patient Consent Statement</div>
            <div class="section-content">
              I, the undersigned, hereby authorize the medical team at <strong>XenoCare</strong> to perform the above-named procedure. I acknowledge that:
              <ol class="consent-list">
                <li>The nature, purpose, and expected benefits of the procedure have been explained to me.</li>
                <li>The potential risks, complications, and alternatives have been discussed with me.</li>
                <li>I have had the opportunity to ask questions, and all my questions have been answered.</li>
                <li>Unforeseen conditions may require additional or different procedures.</li>
                <li>I authorize the administration of anesthesia as deemed necessary.</li>
                <li>I consent to the disposal of any tissues or organs removed during the procedure.</li>
                <li>No guarantees have been made regarding the outcome of this procedure.</li>
              </ol>
            </div>
          </div>

          <!-- Risks -->
          <div class="section">
            <div class="section-title">Acknowledgment of Risks</div>
            <div class="section-content">
              I understand that all medical procedures carry inherent risks, including but not limited to:
              <ul class="consent-list">
                <li>Bleeding, infection, or adverse reaction to anesthesia</li>
                <li>Blood clots, nerve damage, or organ injury</li>
                <li>Need for additional procedures or extended hospitalization</li>
                <li>In rare cases, permanent disability or death</li>
              </ul>
            </div>
          </div>

          <!-- Checkboxes -->
          <div class="checkbox-section">
            <div class="checkbox-item">
              <div class="checkbox"></div>
              <span class="checkbox-text">I confirm that I have read and understand this consent form.</span>
            </div>
            <div class="checkbox-item">
              <div class="checkbox"></div>
              <span class="checkbox-text">I have had sufficient time to consider my decision and have not been pressured.</span>
            </div>
            <div class="checkbox-item">
              <div class="checkbox"></div>
              <span class="checkbox-text">I am providing this consent voluntarily and of my own free will.</span>
            </div>
            <div class="checkbox-item">
              <div class="checkbox"></div>
              <span class="checkbox-text">I authorize the release of my medical information to my insurance provider if applicable.</span>
            </div>
          </div>

          <!-- Signatures -->
          <div class="signature-section">
            <div class="signature-title">Authorized Signatures</div>
            <div class="signature-grid">
              <div class="signature-box">
                <h4>Patient / Legal Guardian</h4>
                <div class="sig-line"></div>
                <div class="sig-label">Signature</div>
                <div class="sig-field">
                  <div class="sig-line" style="height:22px"></div>
                  <div class="sig-label">Print Name</div>
                </div>
                <div class="sig-field">
                  <div class="sig-line" style="height:22px"></div>
                  <div class="sig-label">Date & Time</div>
                </div>
              </div>
              <div class="signature-box">
                <h4>Witness</h4>
                <div class="sig-line"></div>
                <div class="sig-label">Signature</div>
                <div class="sig-field">
                  <div class="sig-line" style="height:22px"></div>
                  <div class="sig-label">Print Name & Designation</div>
                </div>
                <div class="sig-field">
                  <div class="sig-line" style="height:22px"></div>
                  <div class="sig-label">Date & Time</div>
                </div>
              </div>
              <div class="signature-box">
                <h4>Physician Obtaining Consent</h4>
                <div class="sig-line"></div>
                <div class="sig-label">Signature</div>
                <div class="sig-field">
                  <div class="sig-line" style="height:22px"></div>
                  <div class="sig-label">Print Name & Title</div>
                </div>
                <div class="sig-field">
                  <div class="sig-line" style="height:22px"></div>
                  <div class="sig-label">Date & Time</div>
                </div>
              </div>
              <div class="signature-box">
                <h4>Interpreter (if applicable)</h4>
                <div class="sig-line"></div>
                <div class="sig-label">Signature</div>
                <div class="sig-field">
                  <div class="sig-line" style="height:22px"></div>
                  <div class="sig-label">Print Name</div>
                </div>
                <div class="sig-field">
                  <div class="sig-line" style="height:22px"></div>
                  <div class="sig-label">Language</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-left">
              This form is part of the patient's<br/>permanent medical record.
            </div>
            <div class="footer-center">
              <div class="footer-logo">XENOCARE</div>
              <div class="footer-tagline">Excellence in Healthcare Delivery</div>
            </div>
            <div class="footer-right">
              Form: XC-CONSENT-001<br/>
              Rev: 2026.01
            </div>
          </div>
        </div>

        <script>
          function downloadForm() {
            const content = document.documentElement.outerHTML;
            const blob = new Blob([content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Consent_Form_${procedure.procedure_number}.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        </script>
      </body>
      </html>
    `;

    // Open in system default browser using Electron API
    if (window.electron?.html?.saveAndOpen) {
      const filename = `Consent_Form_${procedure.procedure_number}_${Date.now()}.html`;
      window.electron.html.saveAndOpen(filename, consentContent);
    } else {
      // Fallback for non-Electron environment
      const printWindow = window.open(
        '',
        '_blank',
        'width=900,height=700,menubar=yes,toolbar=yes,scrollbars=yes,resizable=yes',
      );
      if (printWindow) {
        printWindow.document.write(consentContent);
        printWindow.document.close();
        printWindow.focus();
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">
                  {procedure.procedure_number}
                </h1>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${status.bgColor} ${status.color}`}
                >
                  {status.icon}
                  <span className="text-sm font-medium">{status.label}</span>
                </div>
                {procedure.priority === 'emergency' && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Emergency
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {procedure.indication}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Actions */}
            {procedure.status === 'scheduled' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                <PlayCircle className="h-5 w-5" />
                Start Procedure
              </button>
            )}
            {procedure.status === 'in_progress' && (
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={!canComplete}
                title={
                  !canComplete
                    ? 'Scheduled duration has not elapsed yet'
                    : 'Complete procedure'
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  canComplete
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
                {canComplete ? 'Complete' : 'In Progress...'}
              </button>
            )}

            {/* Unified Order Button — same as GOPD QuickOrderModal */}
            {procedure.encounter_id && procedure.status !== 'completed' && procedure.status !== 'cancelled' && (
              <UniversalOrderButton
                encounterId={procedure.encounter_id}
                patientId={procedure.patient_id}
                patientName={`Patient ${procedure.patient_id.slice(0, 8)}`}
                encounterType="In-Patient"
                hasActiveAdmission
              />
            )}

            {/* More Actions */}
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {showActions && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border py-1 z-10">
                  {getAvailableActions().map((action) => (
                    <div key={action.status} className="relative group">
                      <button
                        disabled={action.disabled}
                        onClick={() => {
                          if (!action.disabled) {
                            handleStatusChange(action.status);
                            setShowActions(false);
                          }
                        }}
                        title={action.tooltip}
                        className={`w-full px-4 py-2 text-left text-sm ${
                          action.disabled
                            ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                            : `hover:bg-gray-100 ${action.color}`
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {action.disabled && (
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                          )}
                          <span>{action.label}</span>
                        </span>
                      </button>
                      {action.disabled && action.tooltip && (
                        <div className="hidden group-hover:block absolute left-full top-0 ml-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-20">
                          <span className="font-semibold block mb-1">
                            Blocked by:
                          </span>
                          {action.tooltip}
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handlePrintDetails}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print Details
                  </button>
                  <button
                    onClick={handlePrintConsentForm}
                    className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <FileSignature className="h-4 w-4" />
                    Print Consent Form
                  </button>
                  {procedure.status !== 'completed' &&
                    procedure.status !== 'cancelled' && (
                      <button
                        onClick={() => {
                          setShowCancelModal(true);
                          setShowActions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Cancel Procedure
                      </button>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Checklist Validation Status Banner */}
        {checklistValidation &&
          procedure.status !== 'completed' &&
          procedure.status !== 'cancelled' && (
            <div className="mt-4">
              {!checklistValidation.canProceed &&
                checklistValidation.blockers.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-800 font-medium text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Checklist items blocking progress:</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {checklistValidation.blockers.map((blocker) => (
                        <li
                          key={blocker.itemId}
                          className="text-sm text-red-700 flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                          {blocker.itemText}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setActiveTab('checklist')}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Go to Checklist →
                    </button>
                  </div>
                )}
              {checklistValidation.canProceed &&
                checklistValidation.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Optional items not completed:</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {checklistValidation.warnings
                        .slice(0, 3)
                        .map((warning) => (
                          <li
                            key={warning.itemId}
                            className="text-sm text-amber-700 flex items-center gap-2"
                          >
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />
                            {warning.itemText}
                          </li>
                        ))}
                      {checklistValidation.warnings.length > 3 && (
                        <li className="text-sm text-amber-600 italic">
                          +{checklistValidation.warnings.length - 3} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              {checklistValidation.canProceed &&
                checklistValidation.warnings.length === 0 &&
                checklistValidation.blockers.length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>All required checklist items completed</span>
                    </div>
                  </div>
                )}
            </div>
          )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map((tab) => {
            // Show badge on checklist tab if there are blockers
            const showBlokerBadge =
              tab.id === 'checklist' &&
              checklistValidation &&
              !checklistValidation.canProceed &&
              checklistValidation.blockers.length > 0 &&
              procedure.status !== 'completed' &&
              procedure.status !== 'cancelled';

            const showWarningBadge =
              tab.id === 'checklist' &&
              checklistValidation &&
              checklistValidation.canProceed &&
              checklistValidation.warnings.length > 0 &&
              procedure.status !== 'completed' &&
              procedure.status !== 'cancelled';

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                {tab.label}
                {showBlokerBadge && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
                    {checklistValidation.blockers.length}
                  </span>
                )}
                {showWarningBadge && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-amber-500 text-white text-xs font-bold rounded-full">
                    {checklistValidation.warnings.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Procedure Timer - Shows countdown and controls completion button */}
            <ProcedureTimer
              procedureId={procedure.id}
              status={procedure.status}
              scheduledDurationMinutes={procedure.scheduled_duration_minutes}
              actualStartTime={procedure.actual_start_time}
              actualEndTime={procedure.actual_end_time}
              onCanComplete={setCanComplete}
            />
            <ProcedureOverview procedure={procedure} />
          </div>
        )}
        {activeTab === 'checklist' && (
          <ProcedureChecklist
            procedureId={procedure.id}
            status={procedure.status}
            onValidationChange={setChecklistValidation}
          />
        )}
        {activeTab === 'notes' && <ProcedureNotes procedureId={procedure.id} />}
        {activeTab === 'consumables' && (
          <ConsumablesTracker
            procedureId={procedure.id}
            status={procedure.status}
          />
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Cancel Procedure
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Please provide a reason for cancellation.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Reason for cancellation..."
              className="w-full mt-4 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Keep Procedure
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason || cancelProcedure.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Cancel Procedure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Overview Section
const ProcedureOverview: React.FC<{ procedure: Procedure }> = ({
  procedure,
}) => {
  // Extract pre-op checklist data
  const preOpChecklist = procedure.pre_op_checklist as {
    instructions?: string;
    special_equipment?: string;
  } | null;

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Main Info */}
      <div className="col-span-2 space-y-6">
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            Procedure Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Indication" value={procedure.indication} />
            <InfoItem label="Priority" value={procedure.priority} capitalize />
            <InfoItem
              label="Scheduled Date"
              value={
                procedure.scheduled_date
                  ? new Date(procedure.scheduled_date).toLocaleDateString(
                      'en-GB',
                      {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      },
                    )
                  : 'Not scheduled'
              }
            />
            <InfoItem
              label="Scheduled Time"
              value={
                procedure.scheduled_date
                  ? new Date(procedure.scheduled_date).toLocaleTimeString(
                      'en-GB',
                      { hour: '2-digit', minute: '2-digit' },
                    )
                  : 'Not set'
              }
            />
            <InfoItem
              label="Theatre / Location"
              value={
                procedure.room_number || procedure.location || 'Not assigned'
              }
            />
            <InfoItem
              label="Estimated Duration"
              value={`${procedure.scheduled_duration_minutes || 60} minutes`}
            />
          </div>

          {procedure.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-1">Scheduling Notes</p>
              <p className="text-gray-900 whitespace-pre-wrap">
                {procedure.notes}
              </p>
            </div>
          )}

          {procedure.procedure_notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-1">Procedure Notes</p>
              <p className="text-gray-900 whitespace-pre-wrap">
                {procedure.procedure_notes}
              </p>
            </div>
          )}
        </div>

        {/* Pre-Operative Requirements */}
        {(preOpChecklist?.instructions ||
          preOpChecklist?.special_equipment ||
          procedure.post_op_instructions) && (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Pre-Operative Requirements
            </h3>

            {(preOpChecklist?.instructions ||
              procedure.post_op_instructions) && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">
                  Pre-Op Instructions
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap text-sm">
                    {preOpChecklist?.instructions ||
                      procedure.post_op_instructions}
                  </p>
                </div>
              </div>
            )}

            {preOpChecklist?.special_equipment && (
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  Special Equipment Required
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-gray-900 text-sm">
                    {preOpChecklist.special_equipment}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Timing */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Timing</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Scheduled</p>
              <p className="font-medium text-gray-900">
                {procedure.scheduled_date
                  ? new Date(procedure.scheduled_date).toLocaleTimeString(
                      'en-GB',
                      { hour: '2-digit', minute: '2-digit' },
                    )
                  : 'TBD'}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <PlayCircle className="h-5 w-5 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Started</p>
              <p className="font-medium text-gray-900">
                {procedure.actual_start_time
                  ? new Date(procedure.actual_start_time).toLocaleTimeString(
                      'en-GB',
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )
                  : '—'}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Completed</p>
              <p className="font-medium text-gray-900">
                {procedure.actual_end_time
                  ? new Date(procedure.actual_end_time).toLocaleTimeString(
                      'en-GB',
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Surgical Team */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Surgical Team</h3>
          <div className="space-y-3">
            {/* Primary Surgeon */}
            {procedure.primary_surgeon_id && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {(procedure as any).primary_surgeon
                      ? `Dr. ${(procedure as any).primary_surgeon.first_name} ${(procedure as any).primary_surgeon.last_name}`
                      : 'Surgeon Assigned'}
                  </p>
                  <p className="text-xs text-purple-600">Surgeon in Charge</p>
                </div>
              </div>
            )}

            {/* Anesthesiologist */}
            {procedure.anesthesiologist_id && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {(procedure as any).anesthesiologist
                      ? `Dr. ${(procedure as any).anesthesiologist.first_name} ${(procedure as any).anesthesiologist.last_name}`
                      : 'Anesthesiologist Assigned'}
                  </p>
                  <p className="text-xs text-blue-600">Anesthesiologist</p>
                </div>
              </div>
            )}

            {/* Assistant Surgeons / Nurses */}
            {procedure.assistant_surgeons &&
              Array.isArray(procedure.assistant_surgeons) &&
              procedure.assistant_surgeons.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Participating Staff
                  </p>
                  {(
                    procedure.assistant_surgeons as {
                      user_id?: string;
                      name: string;
                      role: string;
                    }[]
                  ).map((staff, idx) => (
                    <div
                      key={staff.user_id || idx}
                      className="flex items-center gap-3 py-1"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {staff.name}
                        </p>
                        <p className="text-xs text-gray-500">{staff.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {!procedure.primary_surgeon_id &&
              !procedure.anesthesiologist_id && (
                <p className="text-sm text-gray-400 italic">
                  No surgical team assigned
                </p>
              )}
          </div>
        </div>

        {/* Patient Info */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Patient</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Patient</p>
              <p className="text-sm text-gray-500">
                {procedure.patient_id.slice(0, 8)}
              </p>
            </div>
          </div>
        </div>

        {/* Consent Status */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Consent</h3>
          {procedure.consent_obtained ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span>Consent obtained</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Consent pending</span>
            </div>
          )}
        </div>

        {/* Findings (if completed) */}
        {procedure.status === 'completed' && procedure.findings && (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Findings</h3>
            <p className="text-gray-900">{procedure.findings}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const InfoItem: React.FC<{
  label: string;
  value: string | null;
  capitalize?: boolean;
}> = ({ label, value, capitalize }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <p
      className={`font-medium text-gray-900 ${capitalize ? 'capitalize' : ''}`}
    >
      {value || '—'}
    </p>
  </div>
);

export default ProcedureDetails;

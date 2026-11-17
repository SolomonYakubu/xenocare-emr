/**
 * XenoCare — Procedures / Surgery Export Panel
 * Inline export toolbar for the Procedures module page.
 */

import React, { useState } from 'react';
import { ExportToolbar } from '../../reports/components/ExportToolbar';
import { ProcedureReportModal } from '../../reports/components/ProcedureReportModal';
import { dispatchExport } from '../../reports/services/export.service';
import { logExportAudit } from '../../reports/services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import type { ExportFormat } from '../../reports/types/report.types';
import type { Procedure } from '../../../types/database.types';

interface ProcedureExportPanelProps {
  data: Procedure[];
}

export function ProcedureExportPanel({ data }: ProcedureExportPanelProps) {
  const { staff, hasRole } = useAuth();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const canExport = hasRole([
    'admin',
    'medical_director',
    'doctor',
    'super_admin',
  ]);
  if (!canExport) return null;

  const headers = [
    'Patient number',
    'Patient',
    'Procedure Name',
    'Priority',
    'Status',
    'Surgeon',
    'Date',
    'Notes',
  ];

  function toRow(p: Procedure): (string | number)[] {
    return [
      '',
      p.patient_id || '',
      p.procedure_name || '',
      p.priority || '',
      p.status || '',
      p.primary_surgeon_id || '',
      p.scheduled_date ? String(p.scheduled_date).slice(0, 10) : '',
      p.notes || '',
    ];
  }

  const rows = data.map(toRow);

  async function handleExport(format: ExportFormat) {
    const filename = `XenoCare_Procedures_Export_${new Date().toISOString().split('T')[0]}`;
    const pdfOpts = {
      title: 'Procedures Export',
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      sections: [
        { title: 'Procedures', tableHeaders: headers, tableRows: rows },
      ],
    };
    try {
      dispatchExport(
        format,
        [{ name: 'Procedures', headers, rows }],
        pdfOpts,
        filename,
      );
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message:
          error instanceof Error
            ? error.message
            : 'The export could not be generated.',
      });
      return;
    }

    try {
      await logExportAudit({
        module: 'procedures',
        format,
        record_count: data.length,
        filters: {},
        exported_by: staff?.id || '',
        exported_by_name: staff ? `${staff.first_name} ${staff.last_name}` : '',
        exported_at: new Date().toISOString(),
      });
    } catch {
      showToast({
        type: 'warning',
        title: 'Audit Log Pending',
        message:
          'The export completed, but the audit trail could not be recorded right now.',
      });
    }
  }

  return (
    <>
      <ExportToolbar
        onExport={handleExport}
        recordCount={data.length}
        showReportButton
        onReport={() => setModalOpen(true)}
      />
      <ProcedureReportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

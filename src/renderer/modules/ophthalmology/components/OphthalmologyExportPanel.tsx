/**
 * XenoCare — Ophthalmology Export Panel
 * Inline export toolbar for the Ophthalmology module page.
 */

import React, { useState } from 'react';
import { ExportToolbar } from '../../reports/components/ExportToolbar';
import { OphthalmologyReportModal } from '../../reports/components/OphthalmologyReportModal';
import { dispatchExport } from '../../reports/services/export.service';
import { logExportAudit } from '../../reports/services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import type { ExportFormat } from '../../reports/types/report.types';
import type { EyeProcedureDTO } from '../types/ophthalmology.types';

interface OphthalmologyExportPanelProps {
  data: EyeProcedureDTO[];
}

export function OphthalmologyExportPanel({
  data,
}: OphthalmologyExportPanelProps) {
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
    'Procedure Type',
    'Doctor',
    'Status',
    'Scheduled Date',
    'Notes',
  ];

  function toRow(p: EyeProcedureDTO): (string | number)[] {
    return [
      p.patient?.emr_number || '',
      p.patient ? `${p.patient.first_name} ${p.patient.surname}` : '',
      p.procedure_type || '',
      p.performer ? `${p.performer.first_name} ${p.performer.last_name}` : '',
      p.status || '',
      p.performed_at?.slice(0, 10) || '',
      p.procedure_notes || '',
    ];
  }

  const rows = data.map(toRow);

  async function handleExport(format: ExportFormat) {
    const filename = `XenoCare_Ophthalmology_Export_${new Date().toISOString().split('T')[0]}`;
    const pdfOpts = {
      title: 'Ophthalmology Procedures Export',
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      sections: [
        { title: 'Eye Procedures', tableHeaders: headers, tableRows: rows },
      ],
    };
    try {
      dispatchExport(
        format,
        [{ name: 'Eye Procedures', headers, rows }],
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
        module: 'ophthalmology',
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
      <OphthalmologyReportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

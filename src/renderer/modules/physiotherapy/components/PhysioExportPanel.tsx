/**
 * XenoCare — Physiotherapy Export Panel
 * Inline export toolbar for the Physiotherapy module page.
 */

import React, { useState } from 'react';
import { ExportToolbar } from '../../reports/components/ExportToolbar';
import { PhysioReportModal } from '../../reports/components/PhysioReportModal';
import { dispatchExport } from '../../reports/services/export.service';
import { logExportAudit } from '../../reports/services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import type { ExportFormat } from '../../reports/types/report.types';
import type { PhysioSessionDTO } from '../types/physiotherapy.types';

interface PhysioExportPanelProps {
  data: PhysioSessionDTO[];
}

export function PhysioExportPanel({ data }: PhysioExportPanelProps) {
  const { staff, hasRole } = useAuth();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const canExport = hasRole([
    'admin',
    'medical_director',
    'physiotherapist',
    'super_admin',
  ]);
  if (!canExport) return null;

  const headers = [
    'Patient number',
    'Patient',
    'Session Type',
    'Therapist',
    'Status',
    'Date',
    'Notes',
  ];

  function toRow(s: PhysioSessionDTO): (string | number)[] {
    return [
      s.patient?.emr_number || '',
      s.patient ? `${s.patient.first_name} ${s.patient.surname}` : '',
      s.treatment_provided || '',
      s.therapist ? `${s.therapist.first_name} ${s.therapist.last_name}` : '',
      s.attendance_status || '',
      s.session_date?.slice(0, 10) || '',
      s.progress_notes || '',
    ];
  }

  const rows = data.map(toRow);

  async function handleExport(format: ExportFormat) {
    const filename = `XenoCare_Physio_Export_${new Date().toISOString().split('T')[0]}`;
    const pdfOpts = {
      title: 'Physiotherapy Sessions Export',
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      sections: [
        { title: 'Physio Sessions', tableHeaders: headers, tableRows: rows },
      ],
    };
    try {
      dispatchExport(
        format,
        [{ name: 'Physio Sessions', headers, rows }],
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
        module: 'physiotherapy',
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
      <PhysioReportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

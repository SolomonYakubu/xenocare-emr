/**
 * XenoCare — Dental Export Panel
 * Inline export toolbar for the Dental module page.
 */

import React, { useState } from 'react';
import { ExportToolbar } from '../../reports/components/ExportToolbar';
import { DentalReportModal } from '../../reports/components/DentalReportModal';
import { dispatchExport } from '../../reports/services/export.service';
import { logExportAudit } from '../../reports/services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import type { ExportFormat } from '../../reports/types/report.types';
import type { DentalProcedureDTO } from '../types/dental.types';

interface DentalExportPanelProps {
  data: DentalProcedureDTO[];
}

export function DentalExportPanel({ data }: DentalExportPanelProps) {
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
    'Tooth',
    'Priority',
    'Status',
    'Dentist',
    'Date',
  ];

  function toRow(p: DentalProcedureDTO): (string | number)[] {
    return [
      p.patient?.emr_number || '',
      p.patient ? `${p.patient.first_name} ${p.patient.surname}` : '',
      p.procedure_type || '',
      p.tooth_numbers?.join(', ') || '',
      p.priority || '',
      p.status || '',
      p.performer ? `${p.performer.first_name} ${p.performer.last_name}` : '',
      p.created_at?.slice(0, 10) || '',
    ];
  }

  const rows = data.map(toRow);

  async function handleExport(format: ExportFormat) {
    const filename = `XenoCare_Dental_Export_${new Date().toISOString().split('T')[0]}`;
    const pdfOpts = {
      title: 'Dental Procedures Export',
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      sections: [
        { title: 'Dental Procedures', tableHeaders: headers, tableRows: rows },
      ],
    };
    try {
      dispatchExport(
        format,
        [{ name: 'Dental Procedures', headers, rows }],
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
        module: 'dental',
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
      <DentalReportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

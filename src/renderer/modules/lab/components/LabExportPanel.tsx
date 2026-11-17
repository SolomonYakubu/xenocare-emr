/**
 * XenoCare — Lab Export Panel
 * Inline export toolbar for the Lab module page.
 */

import React, { useState } from 'react';
import { ExportToolbar } from '../../reports/components/ExportToolbar';
import { LabReportModal } from '../../reports/components/LabReportModal';
import { dispatchExport } from '../../reports/services/export.service';
import { logExportAudit } from '../../reports/services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import type { ExportFormat } from '../../reports/types/report.types';
import type { LabRequestDTO } from '../dtos/lab.dto';

interface LabExportPanelProps {
  data: LabRequestDTO[];
}

export function LabExportPanel({ data }: LabExportPanelProps) {
  const { staff, hasRole } = useAuth();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const canExport = hasRole([
    'admin',
    'medical_director',
    'lab_technician',
    'super_admin',
  ]);
  if (!canExport) return null;

  const headers = [
    'Patient number',
    'Patient',
    'Test Name',
    'Category',
    'Priority',
    'Status',
    'Requested By',
    'Requested Date',
  ];

  function toRow(r: LabRequestDTO): (string | number)[] {
    const patient = r.patient
      ? `${r.patient.first_name} ${r.patient.surname}`
      : '';
    const requester = r.doctor
      ? `${r.doctor.first_name} ${r.doctor.last_name}`
      : '';
    const testName = r.test?.test_name || '';
    const category = r.test?.category || '';
    return [
      r.patient?.emr_number || '',
      patient,
      testName,
      category,
      r.priority || '',
      r.status,
      requester,
      r.created_at?.slice(0, 10) || '',
    ];
  }

  const rows = data.map((r) => toRow(r));

  async function handleExport(format: ExportFormat) {
    const filename = `XenoCare_Lab_Export_${new Date().toISOString().split('T')[0]}`;
    const pdfOpts = {
      title: 'Lab Requests Export',
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      sections: [
        { title: 'Lab Requests', tableHeaders: headers, tableRows: rows },
      ],
    };
    try {
      dispatchExport(
        format,
        [{ name: 'Lab Requests', headers, rows }],
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
        module: 'lab',
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
      <LabReportModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

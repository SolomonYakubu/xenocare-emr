/**
 * XenoCare — Radiology / Imaging Export Panel
 * Inline export toolbar for the Radiology module page.
 */

import React, { useState } from 'react';
import { ExportToolbar } from '../../reports/components/ExportToolbar';
import { ImagingReportModal } from '../../reports/components/ImagingReportModal';
import { dispatchExport } from '../../reports/services/export.service';
import { logExportAudit } from '../../reports/services/audit.service';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import type { ExportFormat } from '../../reports/types/report.types';
import type { RadiologyRequestDTO } from '../dtos/radiology.dto';

interface ImagingExportPanelProps {
  data: RadiologyRequestDTO[];
}

export function ImagingExportPanel({ data }: ImagingExportPanelProps) {
  const { staff, hasRole } = useAuth();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const canExport = hasRole([
    'admin',
    'medical_director',
    'radiologist',
    'super_admin',
  ]);
  if (!canExport) return null;

  const headers = [
    'Patient number',
    'Patient',
    'Modality',
    'Study',
    'Priority',
    'Status',
    'Requested By',
    'Date',
  ];

  function toRow(r: RadiologyRequestDTO): (string | number)[] {
    const patient = r.patient
      ? `${r.patient.first_name} ${r.patient.surname}`
      : '';
    const requester = r.doctor
      ? `${r.doctor.first_name} ${r.doctor.last_name}`
      : '';
    const modality = r.imaging?.imaging_type || '';
    const studyName = r.imaging?.imaging_name || '';
    return [
      r.patient?.emr_number || '',
      patient,
      modality,
      studyName,
      r.priority || '',
      r.status,
      requester,
      r.created_at?.slice(0, 10) || '',
    ];
  }

  const rows = data.map((r) => toRow(r));

  async function handleExport(format: ExportFormat) {
    const filename = `XenoCare_Radiology_Export_${new Date().toISOString().split('T')[0]}`;
    const pdfOpts = {
      title: 'Radiology / Imaging Export',
      generatedBy: staff ? `${staff.first_name} ${staff.last_name}` : '',
      sections: [
        { title: 'Scan Requests', tableHeaders: headers, tableRows: rows },
      ],
    };
    try {
      dispatchExport(
        format,
        [{ name: 'Scan Requests', headers, rows }],
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
        module: 'imaging',
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
      <ImagingReportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

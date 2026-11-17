import {
  getFacilityAddress,
  getFacilityInfo,
  getFacilityName,
} from '../../../lib/facility';
import { LabRequestDTO } from '../dtos/lab.dto';
import { formatDetailedAge } from '../../patient-registration/dtos/patient.dto';
import { MUHEDA_LOGO_DATA_URI } from '../../../shared/constants/muhedaLogo';
import { sanitizeClinicalHtml } from './clinicalDataHtml';

interface ReportResultRow {
  investigation: string;
  detail?: string;
  result: string;
  unit: string;
  referenceRange: string;
  status: string;
  comments: string;
  abnormal: boolean;
  critical: boolean;
}

interface ReportDepartment {
  name: string;
  rows: ReportResultRow[];
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function patientName(request: LabRequestDTO): string {
  if (!request.patient) return 'Unknown patient';
  return `${request.patient.first_name || ''} ${request.patient.surname || ''}`.trim();
}

function resultRows(request: LabRequestDTO): ReportResultRow[] {
  const labResult = request.lab_result;
  const structured = labResult?.structured_result as
    | {
        parameters?: Array<Record<string, unknown>>;
        panels?: Array<{
          groupName?: string;
          analytes?: Array<Record<string, unknown>>;
        }>;
      }
    | undefined;

  const structuredParameters: Array<Record<string, unknown>> = Array.isArray(
    structured?.parameters,
  )
    ? structured.parameters
    : Array.isArray(structured?.panels)
      ? structured.panels.flatMap((panel) =>
          (panel.analytes || []).map((analyte) => ({
            ...analyte,
            parameter:
              analyte.analyte ||
              analyte.parameter ||
              panel.groupName ||
              'Result',
          })),
        )
      : [];

  if (structuredParameters.length > 0) {
    return structuredParameters.map((parameter) => {
      const critical = Boolean(
        parameter.isCritical ||
          parameter.flag === 'Critical Low' ||
          parameter.flag === 'Critical High',
      );
      const abnormal = Boolean(
        parameter.isAbnormal ||
          parameter.flag === 'High' ||
          parameter.flag === 'Low',
      );
      return {
        investigation: String(
          parameter.parameter ||
            parameter.analyte ||
            parameter.name ||
            request.test?.test_name ||
            'Result',
        ),
        detail: request.test?.test_name,
        result: String(
          parameter.resultValue ??
            parameter.value ??
            parameter.result ??
            '-',
        ),
        unit: String(parameter.unit || ''),
        referenceRange: String(
          parameter.referenceRange || parameter.reference_range || '-',
        ),
        status: critical ? 'Critical' : abnormal ? 'Abnormal' : 'Normal',
        comments: String(parameter.comments || ''),
        abnormal,
        critical,
      };
    });
  }

  const critical = Boolean(labResult?.is_critical);
  const abnormal = Boolean(labResult?.is_abnormal);
  return [
    {
      investigation: request.test?.test_name || 'Laboratory investigation',
      detail: request.test?.category || undefined,
      result:
        labResult?.result ||
        (typeof request.result === 'string' ? request.result : '') ||
        'Pending',
      unit: labResult?.result_unit || '',
      referenceRange:
        labResult?.reference_range || request.test?.normal_range || '-',
      status: critical ? 'Critical' : abnormal ? 'Abnormal' : 'Normal',
      comments: labResult?.remarks || '',
      abnormal,
      critical,
    },
  ];
}

function buildDepartments(requests: LabRequestDTO[]): ReportDepartment[] {
  const groups = new Map<string, ReportResultRow[]>();
  requests.forEach((request) => {
    const department = request.test?.category || 'General Laboratory';
    const rows = groups.get(department) || [];
    rows.push(...resultRows(request));
    groups.set(department, rows);
  });
  return Array.from(groups.entries()).map(([name, rows]) => ({ name, rows }));
}

function aggregateComments(requests: LabRequestDTO[]): string[] {
  return Array.from(
    new Set(
      requests
        .flatMap((request) => {
          const structured = request.lab_result?.structured_result as
            | { additionalComments?: unknown }
            | undefined;
          return [
            structured?.additionalComments
              ? String(structured.additionalComments)
              : null,
            request.lab_result?.remarks,
            request.result_notes,
            request.clinical_notes
              ? `Clinical note: ${request.clinical_notes}`
              : null,
          ];
        })
        .filter((value): value is string => Boolean(value?.trim())),
    ),
  );
}

async function loadLogoDataUri(): Promise<string> {
  return MUHEDA_LOGO_DATA_URI;
}

export interface LabDetailReportContext {
  patientName: string;
  emrNumber: string;
  gender?: string;
}

/**
 * Print a medical-records lab detail row through the same universal report
 * template used by the laboratory module.
 */
export async function printUniversalLabReportFromDetail(
  source: Record<string, unknown>,
  context: LabDetailReportContext,
): Promise<void> {
  const text = (key: string): string => {
    const value = source[key];
    return value === null || value === undefined ? '' : String(value);
  };
  const createdAt = text('created_at') || new Date().toISOString();
  const requestId = text('request_id') || text('id') || `lab-${Date.now()}`;
  const legacyComponents = Array.isArray(source.lab_results_items)
    ? (source.lab_results_items as Array<Record<string, unknown>>)
    : [];
  const structuredResult =
    source.structured_result ||
    (legacyComponents.length > 0
      ? {
          templateType: 'numeric_table',
          version: 1,
          parameters: legacyComponents.map((component, index) => ({
            id: String(component.id || index),
            parameter: String(
              component.component_name ||
                component.parameter ||
                component.name ||
                `Result ${index + 1}`,
            ),
            resultValue:
              component.result_value ??
              component.result_text ??
              component.result ??
              '',
            unit: component.result_unit || component.unit || '',
            referenceRange:
              component.reference_range || component.referenceRange || '',
            flag: component.result_status || 'Normal',
            isAbnormal:
              String(component.result_status || '').toLowerCase() ===
              'abnormal',
            isCritical:
              String(component.result_status || '').toLowerCase() ===
              'critical',
          })),
        }
      : undefined);
  const patientNameParts = context.patientName.trim().split(/\s+/);
  const firstName = patientNameParts[0] || context.patientName || 'Patient';
  const surname = patientNameParts.slice(1).join(' ') || '';

  const request = {
    request_id: requestId,
    patient_id: text('patient_id') || context.emrNumber,
    test_id: text('test_id') || text('id'),
    ordered_by: text('ordered_by') || text('doctor_id'),
    priority: text('priority') || 'Normal',
    clinical_notes: text('clinical_notes') || null,
    processed_by: null,
    processed_at: text('processed_at') || null,
    result: text('result') || text('result_value') || null,
    result_notes: text('result_notes') || text('remarks') || null,
    result_file_url: null,
    status: text('status') || 'Completed',
    sample_collected_at:
      text('sample_collected_at') || text('collected_at') || null,
    specimen_type: text('specimen_type') || text('sample_type') || null,
    specimen_identifier: text('specimen_identifier') || null,
    created_at: createdAt,
    updated_at: text('updated_at') || createdAt,
    request_date: text('request_date') || createdAt,
    patient: {
      id: '',
      patient_id: context.emrNumber,
      emr_number: context.emrNumber,
      first_name: firstName,
      surname,
      gender: context.gender || '',
      date_of_birth: text('date_of_birth'),
    },
    test: {
      test_id: text('test_id') || text('id'),
      test_code: text('test_code'),
      test_name: text('test_name') || text('test') || 'Laboratory investigation',
      category: text('category') || text('test_category') || 'General',
      description: null,
      normal_range: text('reference_range') || null,
      unit: text('result_unit') || text('unit') || null,
      price: 0,
      nhis_eligible: false,
      nhis_percentage: 0,
      turnaround_time: null,
      sample_type: text('sample_type') || text('specimen_type') || null,
      is_active: true,
      created_at: createdAt,
    },
    lab_result: {
      ...source,
      id: text('id'),
      request_id: requestId,
      result: text('result') || text('result_value'),
      result_unit: text('result_unit') || text('unit'),
      reference_range: text('reference_range'),
      remarks: text('remarks') || text('result_notes'),
      is_critical: Boolean(source.is_critical),
      is_abnormal: Boolean(source.is_abnormal),
      structured_result: structuredResult,
      result_template_type: source.result_template_type,
    },
  } as unknown as LabRequestDTO;

  await printUniversalLabReport([request], request);
}

export async function printUniversalLabReport(
  requests: LabRequestDTO[],
  focusRequest?: LabRequestDTO | null,
): Promise<void> {
  const reportRequests =
    requests.length > 0 ? requests : focusRequest ? [focusRequest] : [];
  if (reportRequests.length === 0) return;

  const primary = focusRequest || reportRequests[0];
  const patient = primary.patient;
  const facility = getFacilityInfo();
  const facilityName = getFacilityName();
  const facilityAddress = getFacilityAddress();
  const logo = await loadLogoDataUri();
  const departments = buildDepartments(reportRequests);
  const comments = aggregateComments(reportRequests);
  const clinicalData = reportRequests
    .map((item) => item.lab_result?.structured_result)
    .find(
      (value): value is Record<string, unknown> =>
        Boolean(
          value &&
            typeof value === 'object' &&
            (value as Record<string, unknown>).templateType ===
              'clinical_data',
        ),
    );
  const clinicalHtml = clinicalData?.html
    ? sanitizeClinicalHtml(String(clinicalData.html))
    : '';
  const clinicalTitle = clinicalData?.reportTitle
    ? String(clinicalData.reportTitle)
    : '';
  const clinicalDepartment = clinicalData?.department
    ? String(clinicalData.department)
    : '';
  const doctor = primary.doctor;
  const scientist = reportRequests.find((item) => item.technician)?.technician;
  const validatedResult = reportRequests
    .map((item) => item.lab_result)
    .find((item) => item?.verified_at || item?.reported_at);
  const specimenTypes = Array.from(
    new Set(
      reportRequests
        .map((item) => item.specimen_type || item.test?.sample_type)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const specimenId =
    reportRequests.find((item) => item.specimen_identifier)
      ?.specimen_identifier || '-';
  const collectedAt = reportRequests
    .map((item) => item.sample_collected_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const departmentNames =
    clinicalDepartment ||
    departments.map((item) => item.name).join(', ');
  const labNumber = (
    primary.lab_request_group_id ||
    primary.encounter_id ||
    primary.request_id
  )
    .slice(0, 8)
    .toUpperCase();
  const clinicianName = doctor
    ? `Dr. ${doctor.first_name || ''} ${doctor.last_name || ''}`.trim()
    : 'Requesting doctor';
  const scientistName = scientist
    ? `${scientist.first_name || ''} ${scientist.last_name || ''}`.trim()
    : 'Laboratory scientist';
  const scientistDesignation =
    scientist?.department || scientist?.role || 'Laboratory scientist';

  const departmentHtml = departments
    .map(
      (department) => `
        <tr class="department-row">
          <td colspan="6">${escapeHtml(department.name)}</td>
        </tr>
        ${department.rows
          .map(
            (row) => `
          <tr class="${row.critical ? 'critical-row' : row.abnormal ? 'abnormal-row' : ''}">
            <td>
              <div class="investigation">${escapeHtml(row.investigation)}</div>
              ${
                row.detail
                  ? `<div class="investigation-detail">${escapeHtml(row.detail)}</div>`
                  : ''
              }
            </td>
            <td class="result-value">${escapeHtml(row.result)}</td>
            <td class="muted">${escapeHtml(row.unit || '-')}</td>
            <td class="muted">${escapeHtml(row.referenceRange || '-')}</td>
            <td class="status ${row.critical ? 'status-critical' : row.abnormal ? 'status-abnormal' : 'status-normal'}">${escapeHtml(row.status)}</td>
            <td class="comments">${escapeHtml(row.comments || '-')}</td>
          </tr>`,
          )
          .join('')}`,
    )
    .join('');

  const commentsHtml = comments
    .map((comment) => `<li>${escapeHtml(comment)}</li>`)
    .join('');

  const resultsMarkup = clinicalHtml
    ? `<div class="section-title">Clinical Data / Laboratory Results</div>
      <div class="clinical-data">${clinicalHtml}</div>`
    : `<div class="section-title">Requested investigations and results</div>
      <table class="result-table">
        <thead>
          <tr>
            <th style="width:27%">Investigation</th>
            <th style="width:20%">Result</th>
            <th style="width:9%">Unit</th>
            <th style="width:18%">Reference range</th>
            <th style="width:10%">Status</th>
            <th style="width:16%">Comment</th>
          </tr>
        </thead>
        <tbody>${departmentHtml}</tbody>
      </table>`;

  const reportContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Laboratory Report - ${escapeHtml(patientName(primary))}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #eef1f4;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .action-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 20;
      background: #11151C; color: #fff; padding: 10px 18px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .action-bar strong { font-size: 10pt; letter-spacing: .8px; }
    .action-bar button {
      border: 0; border-radius: 6px; padding: 7px 15px; cursor: pointer;
      font-weight: 700; font-size: 9pt; margin-left: 8px;
    }
    .btn-primary { background: #E9783F; color: #fff; }
    .btn-secondary { background: #fff; color: #11151C; }
    .page {
      width: 210mm; min-height: 297mm; margin: 58px auto 24px; padding: 13mm 12mm;
      background: #fff; box-shadow: 0 10px 35px rgba(15, 23, 42, .12);
    }
    .header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 3px solid #11151C; padding-bottom: 10px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .logo { width: 58px; height: 58px; object-fit: contain; }
    .logo-fallback { width: 58px; height: 58px; display: flex; align-items: center; justify-content: center; border: 2px solid #11151C; color: #11151C; font-weight: 900; font-size: 14pt; }
    .facility-name { font-size: 16pt; font-weight: 900; color: #11151C; text-transform: uppercase; letter-spacing: .4px; }
    .facility-meta { margin-top: 3px; color: #4b5563; font-size: 8.5pt; }
    .report-meta { text-align: right; min-width: 150px; }
    .report-title { display: inline-block; background: #11151C; color: #fff; padding: 5px 12px; font-size: 10pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
    .report-subtitle { margin-top: 7px; color: #6b7280; font-size: 8pt; }
    .section-title { margin: 13px 0 5px; color: #11151C; font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
    .info-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .info-table td { border: 1px solid #d1d5db; padding: 5px 7px; vertical-align: top; }
    .info-label { color: #6b7280; font-size: 7pt; text-transform: uppercase; font-weight: 700; letter-spacing: .4px; }
    .info-value { margin-top: 2px; font-size: 9.5pt; font-weight: 700; color: #111827; }
    .result-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    .result-table th { background: #11151C; color: #fff; border: 1px solid #11151C; padding: 7px 6px; text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .4px; }
    .result-table td { border: 1px solid #d1d5db; padding: 6px 6px; vertical-align: top; font-size: 8.6pt; }
    .department-row td { background: #f1f5f9; color: #11151C; font-weight: 800; font-size: 8pt; text-transform: uppercase; letter-spacing: .7px; }
    .investigation { font-weight: 700; color: #111827; }
    .investigation-detail { color: #6b7280; font-size: 7.5pt; margin-top: 1px; }
    .result-value { font-weight: 800; color: #111827; }
    .muted { color: #4b5563; }
    .comments { color: #4b5563; font-size: 8pt; }
    .status { font-weight: 800; text-transform: uppercase; font-size: 7.5pt; white-space: nowrap; }
    .status-normal { color: #166534; }
    .status-abnormal { color: #b45309; }
    .status-critical { color: #b91c1c; }
    .abnormal-row td { background: #fffbeb; }
    .critical-row td { background: #fef2f2; }
    .clinical-data { border: 1px solid #d1d5db; padding: 10px 12px; background: #fff; font-size: 9.5pt; line-height: 1.55; }
    .clinical-data h1 { font-size: 14pt; margin: 8px 0 6px; }
    .clinical-data h2 { font-size: 12pt; margin: 8px 0 5px; }
    .clinical-data h3 { font-size: 10.5pt; margin: 8px 0 4px; }
    .clinical-data p { margin: 0 0 6px; }
    .clinical-data ul { margin: 4px 0 8px 18px; padding: 0; }
    .clinical-data ol { margin: 4px 0 8px 18px; padding: 0; }
    .clinical-data table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    .clinical-data th, .clinical-data td { border: 1px solid #9ca3af; padding: 5px 6px; vertical-align: top; }
    .clinical-data th { background: #f1f5f9; font-weight: 700; }
    .clinical-data blockquote { margin: 6px 0; padding-left: 10px; border-left: 3px solid #cbd5e1; color: #475569; }
    .note-box { border: 1px solid #d1d5db; border-left: 4px solid #E9783F; padding: 8px 10px; margin-top: 6px; background: #fffaf5; }
    .note-box ul { margin: 4px 0 0 16px; padding: 0; }
    .note-box li { margin-bottom: 3px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 18px; page-break-inside: avoid; }
    .signature { font-size: 8.5pt; }
    .signature-line { margin-top: 28px; border-bottom: 1px solid #111827; }
    .signature-name { margin-top: 4px; font-weight: 800; font-size: 9pt; }
    .signature-role { color: #4b5563; margin-top: 2px; }
    .footer { margin-top: 18px; border-top: 1px solid #cbd5e1; padding-top: 6px; display: flex; justify-content: space-between; gap: 20px; color: #6b7280; font-size: 7.5pt; }
    @media print {
      body { background: #fff; }
      .action-bar { display: none !important; }
      .page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
      .department-row, .note-box, .signatures { page-break-inside: avoid; }
      .result-table tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <strong>${escapeHtml(facilityName)} · LABORATORY REPORT</strong>
    <div>
      <button class="btn-primary" onclick="window.print()">PRINT REPORT</button>
      <button class="btn-secondary" onclick="window.close()">CLOSE</button>
    </div>
  </div>

  <div class="page">
    <div class="header">
      <div class="brand">
        ${
          logo
            ? `<img class="logo" src="${logo}" alt="XenoCare" />`
            : `<div class="logo-fallback">XC</div>`
        }
        <div>
          <div class="facility-name">${escapeHtml(facilityName)}</div>
          <div class="facility-meta">${escapeHtml(facilityAddress || 'Department of Laboratory Medicine')}</div>
          <div class="facility-meta">
            ${escapeHtml([facility.phone, facility.email].filter(Boolean).join(' · ') || 'Laboratory Services')}
          </div>
        </div>
      </div>
      <div class="report-meta">
        <div class="report-title">Laboratory Report</div>
        ${clinicalTitle ? `<div class="report-subtitle">${escapeHtml(clinicalTitle)}</div>` : ''}
        <div class="report-subtitle">Lab No: <strong>${escapeHtml(labNumber)}</strong></div>
        <div class="report-subtitle">Report date: ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
      </div>
    </div>

    <div class="section-title">Patient information</div>
    <table class="info-table">
      <tr>
        <td><div class="info-label">Patient name</div><div class="info-value">${escapeHtml(patientName(primary))}</div></td>
        <td><div class="info-label">Hospital / EMR number</div><div class="info-value">${escapeHtml(patient?.emr_number || patient?.patient_id || '-')}</div></td>
        <td><div class="info-label">Age</div><div class="info-value">${escapeHtml(patient?.date_of_birth ? formatDetailedAge(patient.date_of_birth) : '-')}</div></td>
        <td><div class="info-label">Sex</div><div class="info-value">${escapeHtml(patient?.gender || '-')}</div></td>
      </tr>
      <tr>
        <td><div class="info-label">Ward / Clinic</div><div class="info-value">${escapeHtml(primary.encounter?.clinic_name || patient?.patient_category || 'OPD')}</div></td>
        <td><div class="info-label">Request date</div><div class="info-value">${escapeHtml(formatDateTime(primary.request_date || primary.created_at))}</div></td>
        <td><div class="info-label">Requesting doctor</div><div class="info-value">${escapeHtml(clinicianName)}</div></td>
        <td><div class="info-label">Department(s)</div><div class="info-value">${escapeHtml(departmentNames || 'Laboratory')}</div></td>
      </tr>
    </table>

    <div class="section-title">Specimen information</div>
    <table class="info-table">
      <tr>
        <td><div class="info-label">Specimen type</div><div class="info-value">${escapeHtml(specimenTypes.join(', ') || '-')}</div></td>
        <td><div class="info-label">Collection date / time</div><div class="info-value">${escapeHtml(formatDateTime(collectedAt))}</div></td>
        <td><div class="info-label">Specimen identification no.</div><div class="info-value">${escapeHtml(specimenId)}</div></td>
      </tr>
    </table>

    ${resultsMarkup}

    ${
      comments.length
        ? `<div class="section-title">Laboratory comments</div>
          <div class="note-box"><ul>${commentsHtml}</ul></div>`
        : ''
    }

    <div class="signatures">
      <div class="signature">
        <div class="section-title" style="margin-top:0">Laboratory validation</div>
        <div class="signature-line"></div>
        <div class="signature-name">${escapeHtml(scientistName)}</div>
        <div class="signature-role">${escapeHtml(scientistDesignation)}</div>
        <div class="signature-role">Validated: ${escapeHtml(formatDateTime(validatedResult?.verified_at || validatedResult?.reported_at))}</div>
      </div>
      <div class="signature">
        <div class="section-title" style="margin-top:0">Requesting doctor</div>
        <div class="signature-line"></div>
        <div class="signature-name">${escapeHtml(clinicianName)}</div>
        <div class="signature-role">${escapeHtml(doctor?.department || doctor?.role || 'Clinician')}</div>
        <div class="signature-role">Requested: ${escapeHtml(formatDate(primary.request_date || primary.created_at))}</div>
      </div>
    </div>

    <div class="footer">
      <span>${escapeHtml(facilityName)} · Laboratory Services</span>
      <span>Printed ${escapeHtml(formatDateTime(new Date().toISOString()))} · XenoCare</span>
    </div>
  </div>
</body>
</html>`;

  const electronWindow = window as unknown as {
    electron?: {
      html?: {
        saveAndOpen?: (filename: string, content: string) => void;
      };
    };
  };
  if (electronWindow.electron?.html?.saveAndOpen) {
    const filename = `Laboratory_Report_${labNumber}_${Date.now()}.html`;
    electronWindow.electron.html.saveAndOpen(filename, reportContent);
    return;
  }

  const printWindow = window.open('', '_blank', 'width=980,height=780');
  if (!printWindow) return;
  printWindow.document.write(reportContent);
  printWindow.document.close();
  printWindow.focus();
}

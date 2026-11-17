import {
  MedicalReportDTO,
  getReportTypeLabel,
} from '../dtos/medical-reports.dto';
import {
  getFacilityAddress,
  getFacilityName,
} from '../../../lib/facility';

interface PrintOptions {
  printedByName?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value?: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function resolvePatientName(report: MedicalReportDTO): string {
  const fullName = [
    report.patient?.first_name,
    report.patient?.middle_name,
    report.patient?.surname,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || 'Unknown Patient';
}

function resolveDoctorName(
  report: MedicalReportDTO,
  fallback?: string,
): string {
  const creatorName = [report.creator?.first_name, report.creator?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return creatorName || fallback || 'Attending Clinician';
}

function replacePlaceholders(
  content: string,
  report: MedicalReportDTO,
  doctorName: string,
): string {
  const replacementDate = formatDate(report.issued_at || report.created_at);
  return content
    .replace(/\{patient_name\}/gi, resolvePatientName(report))
    .replace(/\{doctor_name\}/gi, doctorName)
    .replace(/\{date\}/gi, replacementDate)
    .replace(/\{document_number\}/gi, report.document_number || '')
    .replace(/\{report_type\}/gi, getReportTypeLabel(report.report_type));
}

export function printMedicalReport(
  report: MedicalReportDTO,
  options: PrintOptions = {},
): void {
  const printWindow = window.open('', '_blank', 'width=980,height=900');
  if (!printWindow) {
    throw new Error(
      'Unable to open print preview. Please allow pop-ups and retry.',
    );
  }

  const patientName = resolvePatientName(report);
  const doctorName = resolveDoctorName(report, options.printedByName);
  const approvedBy = [report.approver?.first_name, report.approver?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const processedContent = replacePlaceholders(
    report.report_content || '',
    report,
    doctorName,
  );
  const safeContent = escapeHtml(processedContent).replace(/\n/g, '<br />');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(report.document_number || report.report_title)}</title>
  <style>
    :root {
      --ndc-green: #166534;
      --ndc-gold: #b58900;
      --ndc-ink: #0f172a;
      --ndc-muted: #475569;
      --ndc-line: #dbe3ea;
      --sheet-bg: #ffffff;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 24px;
      background: #eef2f6;
      color: var(--ndc-ink);
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      line-height: 1.45;
    }

    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: var(--sheet-bg);
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
      display: flex;
      flex-direction: column;
    }

    .top-accent {
      height: 8px;
      background: linear-gradient(90deg, var(--ndc-green) 0%, #1d7a46 62%, var(--ndc-gold) 100%);
    }

    .header {
      padding: 18px 24px 14px;
      border-bottom: 1px solid var(--ndc-line);
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand img {
      width: 54px;
      height: 54px;
      object-fit: contain;
      border-radius: 50%;
      border: 1px solid #d1d5db;
      background: #fff;
      padding: 4px;
    }

    .logo-fallback {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #e2e8f0;
      color: var(--ndc-green);
      font-weight: 800;
      border: 1px solid #cbd5e1;
    }

    .brand h1 {
      margin: 0;
      font-size: 16px;
      letter-spacing: 0.08em;
      color: var(--ndc-green);
      text-transform: uppercase;
      font-weight: 800;
    }

    .brand p {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--ndc-muted);
    }

    .document-meta {
      text-align: right;
      font-size: 12px;
      color: var(--ndc-muted);
    }

    .document-meta strong {
      color: var(--ndc-ink);
      font-size: 13px;
    }

    .title {
      padding: 18px 24px 8px;
      border-bottom: 1px solid var(--ndc-line);
    }

    .title h2 {
      margin: 0;
      color: var(--ndc-ink);
      font-size: 24px;
      font-weight: 800;
    }

    .title p {
      margin: 4px 0 0;
      color: var(--ndc-muted);
      font-size: 13px;
    }

    .meta-grid {
      padding: 14px 24px;
      border-bottom: 1px solid var(--ndc-line);
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 22px;
      font-size: 12px;
    }

    .meta-item .label {
      color: #64748b;
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 2px;
    }

    .meta-item .value {
      color: #0f172a;
      font-weight: 600;
    }

    .content {
      padding: 22px 24px 10px;
      font-size: 14px;
      color: #111827;
      white-space: normal;
    }

    .sign-off {
      margin-top: 28px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .signature-card {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      font-size: 12px;
      color: #334155;
    }

    .signature-card strong {
      display: block;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .footer {
      margin-top: auto;
      border-top: 1px solid var(--ndc-line);
      padding: 10px 24px 14px;
      color: #64748b;
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }

    .toolbar {
      margin: 0 auto 12px;
      width: 210mm;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .toolbar button {
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #1f2937;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      cursor: pointer;
    }

    .toolbar button:hover {
      background: #f8fafc;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
        background: #fff;
      }

      .toolbar { display: none !important; }

      .sheet {
        width: auto;
        min-height: auto;
        border: none;
        box-shadow: none;
        margin: 0;
      }

      @page {
        size: A4;
        margin: 10mm;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Print / Save PDF</button>
    <button onclick="window.close()">Close</button>
  </div>

  <article class="sheet">
    <div class="top-accent"></div>

    <header class="header">
      <div class="brand">
        <div class="logo-fallback">XenoCare</div>
        <div>
          <h1>${escapeHtml(getFacilityName())}</h1>
          <p>${escapeHtml(getFacilityAddress())}</p>
          <p>Official Clinical Documentation</p>
        </div>
      </div>

      <div class="document-meta">
        <div><strong>${escapeHtml(report.document_number || 'Draft Document')}</strong></div>
        <div>Status: ${escapeHtml(report.status)}</div>
        <div>Issued: ${escapeHtml(formatDate(report.issued_at || report.created_at))}</div>
      </div>
    </header>

    <section class="title">
      <h2>${escapeHtml(report.report_title)}</h2>
      <p>${escapeHtml(getReportTypeLabel(report.report_type))}</p>
    </section>

    <section class="meta-grid">
      <div class="meta-item">
        <span class="label">Patient</span>
        <span class="value">${escapeHtml(patientName)}</span>
      </div>
      <div class="meta-item">
        <span class="label">Patient ID</span>
        <span class="value">${escapeHtml(report.patient?.patient_id || report.patient_id)}</span>
      </div>
      <div class="meta-item">
        <span class="label">Valid From</span>
        <span class="value">${escapeHtml(formatDate(report.valid_from))}</span>
      </div>
      <div class="meta-item">
        <span class="label">Valid To</span>
        <span class="value">${escapeHtml(formatDate(report.valid_to))}</span>
      </div>
      <div class="meta-item">
        <span class="label">Prepared By</span>
        <span class="value">${escapeHtml(doctorName)}</span>
      </div>
      <div class="meta-item">
        <span class="label">Approved By</span>
        <span class="value">${escapeHtml(approvedBy || 'Pending approval')}</span>
      </div>
    </section>

    <section class="content">
      ${safeContent}

      <div class="sign-off">
        <div class="signature-card">
          <strong>${escapeHtml(doctorName)}</strong>
          <span>Attending Clinician</span>
        </div>
        <div class="signature-card">
          <strong>${escapeHtml(approvedBy || '________________________')}</strong>
          <span>Approving Officer</span>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div>This document is generated from ${escapeHtml(getFacilityName())} and is intended for official clinical use.</div>
      <div>Generated on ${escapeHtml(new Date().toLocaleString())}</div>
    </footer>
  </article>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.print();
      }, 250);
    });

    window.onafterprint = function () {
      window.close();
    };
  </script>
</body>
</html>
`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

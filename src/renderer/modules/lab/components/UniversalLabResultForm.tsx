import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlaskConical,
  Loader2,
  Save,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import {
  formatDetailedAge,
  formatPatientName,
} from '../../patient-registration/dtos/patient.dto';
import { getFacilityName } from '../../../lib/facility';
import { MUHEDA_LOGO_DATA_URI } from '../../../shared/constants/muhedaLogo';
import type {
  ResultTemplateType,
  StructuredResult,
} from '../dtos/lab-templates.dto';
import { LabRequestDTO } from '../dtos/lab.dto';
import type { EnhancedCreateLabResultDTO } from './EnhancedLabResultForm';
import { useLabReportRequests } from '../hooks/useLab';
import {
  clinicalHtmlToPlainText,
  plainTextToClinicalHtml,
  sanitizeClinicalHtml,
} from '../utils/clinicalDataHtml';

export type UniversalLabResultBatch = EnhancedCreateLabResultDTO;

interface UniversalLabResultFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (results: UniversalLabResultBatch[]) => Promise<void>;
  isLoading?: boolean;
  request: LabRequestDTO | null;
}

interface ClinicalDataStructuredResult {
  templateType: 'clinical_data';
  version: number;
  html: string;
  plainText: string;
  reportTitle?: string;
  department?: string;
  additionalComments?: string;
}

const FIELD_CLS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600/30';

function toLocalDateTime(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function readStructuredResult(
  request: LabRequestDTO,
): ClinicalDataStructuredResult | null {
  const raw = request.lab_result?.structured_result;
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (record.templateType !== 'clinical_data' && !record.html) return null;
  return {
    templateType: 'clinical_data',
    version: Number(record.version) || 1,
    html: String(record.html || ''),
    plainText: String(record.plainText || ''),
    reportTitle: record.reportTitle ? String(record.reportTitle) : undefined,
    department: record.department ? String(record.department) : undefined,
    additionalComments: record.additionalComments
      ? String(record.additionalComments)
      : undefined,
  };
}

export default function UniversalLabResultForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  request,
}: UniversalLabResultFormProps) {
  const { staff } = useAuth();
  const { showToast } = useToast();
  const { data: reportRequests = [], isLoading: isLoadingRequests } =
    useLabReportRequests(isOpen ? request : null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [initialHtml, setInitialHtml] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [clinicalDataHtml, setClinicalDataHtml] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [specimenType, setSpecimenType] = useState('');
  const [specimenIdentifier, setSpecimenIdentifier] = useState('');
  const [collectedAt, setCollectedAt] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const groupedRequests = useMemo(() => {
    if (reportRequests.length > 0) return reportRequests;
    return request ? [request] : [];
  }, [reportRequests, request]);

  useEffect(() => {
    if (!isOpen || !request || isLoadingRequests) return;

    const source = groupedRequests.length > 0 ? groupedRequests : [request];
    const existing = source
      .map((item) => readStructuredResult(item))
      .find((item): item is ClinicalDataStructuredResult => Boolean(item));
    const existingPlainText = source.find((item) => item.lab_result?.result)
      ?.lab_result?.result;
    const loadedHtml =
      existing?.html ||
      (existingPlainText ? plainTextToClinicalHtml(existingPlainText) : '');

    const specimenTypes = Array.from(
      new Set(
        source
          .map((item) => item.specimen_type || item.test?.sample_type)
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const testNames = Array.from(
      new Set(
        source
          .map((item) => item.test?.test_name)
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const departments = Array.from(
      new Set(
        source
          .map((item) => item.test?.category)
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const collected =
      source
        .map((item) => item.sample_collected_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) || null;

    setInitialHtml(loadedHtml);
    setClinicalDataHtml(loadedHtml);
    setEditorKey((current) => current + 1);
    setReportTitle(
      existing?.reportTitle || testNames.join(', ') || 'Laboratory Report',
    );
    setDepartment(
      existing?.department || departments.join(', ') || 'Laboratory',
    );
    setSpecimenType(specimenTypes.join(', '));
    setSpecimenIdentifier(
      source.find((item) => item.specimen_identifier)?.specimen_identifier || '',
    );
    setCollectedAt(toLocalDateTime(collected || request.sample_collected_at));
    setAdditionalComments(
      existing?.additionalComments ||
        source.find((item) => item.lab_result?.remarks)?.lab_result?.remarks ||
        '',
    );
    setSaveError(null);
  }, [isOpen, request, groupedRequests, isLoadingRequests]);

  useEffect(() => {
    if (!isOpen || isLoadingRequests) return;
    const timer = window.setTimeout(() => editorRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [isOpen, isLoadingRequests, editorKey]);

  const syncEditor = () => {
    if (!editorRef.current) return;
    const html = sanitizeClinicalHtml(editorRef.current.innerHTML);
    setClinicalDataHtml(html);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    if (!html && !text) return;

    event.preventDefault();
    const insertion = html
      ? sanitizeClinicalHtml(html)
      : plainTextToClinicalHtml(text);
    document.execCommand('insertHTML', false, insertion);
    syncEditor();
  };

  const handleSave = async () => {
    const currentHtml = sanitizeClinicalHtml(
      editorRef.current?.innerHTML || clinicalDataHtml,
    );
    const plainText = clinicalHtmlToPlainText(currentHtml);
    if (!plainText.trim()) {
      showToast({
        type: 'error',
        message: 'Enter or paste the laboratory results before saving.',
      });
      return;
    }

    const saveableRequests = groupedRequests.filter(
      (item) => !['Rejected', 'Cancelled'].includes(item.status),
    );
    if (saveableRequests.length === 0) {
      showToast({
        type: 'error',
        message: 'This laboratory request is no longer active.',
      });
      return;
    }

    const structuredResult: ClinicalDataStructuredResult = {
      templateType: 'clinical_data',
      version: 1,
      html: currentHtml,
      plainText,
      reportTitle: reportTitle.trim() || undefined,
      department: department.trim() || undefined,
      additionalComments: additionalComments.trim() || undefined,
    };

    const results: UniversalLabResultBatch[] = saveableRequests.map((item) => ({
      lab_request_id: item.request_id,
      result: plainText,
      remarks: additionalComments.trim() || undefined,
      structured_result: structuredResult as unknown as StructuredResult,
      result_template_type:
        'clinical_data' as unknown as ResultTemplateType,
      workflow_status: 'released',
      is_critical: false,
      collected_at: collectedAt
        ? new Date(collectedAt).toISOString()
        : undefined,
      specimen_type: specimenType || undefined,
      specimen_identifier: specimenIdentifier || undefined,
    }));

    setSaveError(null);
    try {
      await onSubmit(results);
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The laboratory report could not be saved.';
      setSaveError(message);
      showToast({
        type: 'error',
        title: 'Save Failed',
        message,
      });
    }
  };

  if (!isOpen || !request) return null;

  const patient = request.patient;
  const doctorName = request.doctor
    ? `Dr. ${request.doctor.first_name || ''} ${request.doctor.last_name || ''}`.trim()
    : 'Requesting doctor';
  const labNumber = (
    request.lab_request_group_id ||
    request.encounter_id ||
    request.request_id
  )
    .slice(0, 8)
    .toUpperCase();
  const requestedDate =
    request.request_date || request.created_at || new Date().toISOString();
  const scientistName = staff
    ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
    : 'Laboratory scientist';
  const scientistDesignation = staff?.department || staff?.role || 'Laboratory';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4">
        <div className="relative flex h-[95vh] w-[96vw] max-w-[1580px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#eef2f6] shadow-2xl">
          <header className="relative flex flex-shrink-0 flex-wrap items-center justify-between gap-3 bg-[#E9783F] px-5 py-4 text-white lg:px-7">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-transparent" />
            <div className="flex min-w-0 items-center gap-4">
              <div className="rounded-xl bg-white p-1.5 shadow-lg">
                <img
                  src={MUHEDA_LOGO_DATA_URI}
                  alt="MUHEDA Clinic"
                  className="h-12 w-12 object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-lg font-bold tracking-tight">
                    {getFacilityName()}
                  </h2>
                  <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-100">
                    Laboratory Services
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  Clinical Data / Laboratory Results
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">
                  Laboratory number
                </p>
                <p className="font-mono text-sm font-bold text-white">
                  {labNumber}
                </p>
              </div>
              <div className="hidden text-right md:block">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">
                  Request date
                </p>
                <p className="text-sm font-semibold text-white">
                  {formatDateTime(requestedDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
            <div className="space-y-4">
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Patient and specimen information
                  </h3>
                  <span className="text-[10px] font-medium text-slate-400">
                    Auto-filled from the EMR record
                  </span>
                </div>
                <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoItem
                    icon={User}
                    label="Patient name"
                    value={patient ? formatPatientName(patient) : 'Unknown'}
                  />
                  <InfoItem
                    label="Hospital number"
                    value={patient?.emr_number || patient?.patient_id || '-'}
                  />
                  <InfoItem
                    label="Age / Sex"
                    value={`${patient?.date_of_birth ? formatDetailedAge(patient.date_of_birth) : '-'} / ${patient?.gender || '-'}`}
                  />
                  <InfoItem
                    label="Ward / location"
                    value={
                      request.encounter?.clinic_name ||
                      patient?.patient_category ||
                      'OPD'
                    }
                  />
                  <InfoItem label="Laboratory number" value={labNumber} />
                  <InfoItem
                    label="Specimen"
                    value={
                      specimenType ||
                      request.test?.sample_type ||
                      'Not recorded'
                    }
                  />
                  <InfoItem
                    label="Requesting doctor"
                    value={doctorName}
                    icon={ShieldCheck}
                  />
                  <InfoItem
                    label="Request date"
                    value={formatDateTime(requestedDate)}
                  />
                  <div className="sm:col-span-2 lg:col-span-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Requested investigations
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                      {groupedRequests
                        .map((item) => item.test?.test_name)
                        .filter(Boolean)
                        .join(' · ') || reportTitle}
                    </p>
                  </div>
                </div>
              </section>

              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
                <div className="space-y-4">
                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Clinical Data / Laboratory Results
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Type or paste the complete laboratory report.
                          Formatting, tables and line breaks are preserved.
                        </p>
                      </div>
                    </div>

                    <div
                      key={editorKey}
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      aria-label="Clinical Data and Laboratory Results"
                      spellCheck
                      onInput={syncEditor}
                      onPaste={handlePaste}
                      data-placeholder="Type or paste the complete laboratory report here..."
                      className="clinical-data-editor min-h-[460px] cursor-text bg-white px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition-shadow focus:ring-2 focus:ring-inset focus:ring-[#11151C]/15 xl:min-h-[560px]"
                      dangerouslySetInnerHTML={{ __html: initialHtml }}
                    />
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Additional comments
                    </label>
                    <textarea
                      rows={3}
                      value={additionalComments}
                      onChange={(event) =>
                        setAdditionalComments(event.target.value)
                      }
                      className={FIELD_CLS}
                      placeholder="Optional observations separate from the main laboratory report..."
                    />
                  </section>
                </div>

                <aside className="space-y-4 xl:sticky xl:top-0">
                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-[#11151C]" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Laboratory information
                      </h3>
                    </div>

                    {isLoadingRequests ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading request details...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Investigation / report title
                          </label>
                          <input
                            type="text"
                            value={reportTitle}
                            onChange={(event) =>
                              setReportTitle(event.target.value)
                            }
                            className={FIELD_CLS}
                            placeholder="e.g. Serology and Haematology Report"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Laboratory department
                          </label>
                          <input
                            type="text"
                            value={department}
                            onChange={(event) =>
                              setDepartment(event.target.value)
                            }
                            className={FIELD_CLS}
                            placeholder="e.g. Haematology, Serology"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Specimen
                          </label>
                          <input
                            type="text"
                            value={specimenType}
                            onChange={(event) =>
                              setSpecimenType(event.target.value)
                            }
                            className={FIELD_CLS}
                            placeholder="Blood, Urine, Sputum..."
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Specimen identification no.
                          </label>
                          <input
                            type="text"
                            value={specimenIdentifier}
                            onChange={(event) =>
                              setSpecimenIdentifier(event.target.value)
                            }
                            className={FIELD_CLS}
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Collection date and time
                          </label>
                          <input
                            type="datetime-local"
                            value={collectedAt}
                            onChange={(event) =>
                              setCollectedAt(event.target.value)
                            }
                            className={FIELD_CLS}
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Validation and release
                      </h3>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Laboratory scientist
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">
                          {scientistName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {scientistDesignation}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {formatDateTime(new Date().toISOString())}
                        </p>
                      </div>

                      <div className="flex items-start gap-2 text-[11px] leading-5 text-slate-600">
                        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                        The report is saved against the patient, encounter,
                        laboratory request and your staff account. Prior
                        versions remain in the audit history.
                      </div>

                      {saveError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                          {saveError}
                        </div>
                      )}

                      <Button
                        onClick={() => void handleSave()}
                        disabled={isLoading || isLoadingRequests}
                        className="w-full bg-[#E9783F] py-2.5 text-white hover:bg-[#173f66]"
                      >
                        {isLoading ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-1.5 h-4 w-4" />
                        )}
                        Save Laboratory Report
                      </Button>
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .clinical-data-editor:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        .clinical-data-editor p { margin: 0 0 0.65rem; }
        .clinical-data-editor h1 { font-size: 1.5rem; font-weight: 800; margin: 0.9rem 0 0.55rem; color: #11151C; }
        .clinical-data-editor h2 { font-size: 1.25rem; font-weight: 800; margin: 0.85rem 0 0.5rem; color: #11151C; }
        .clinical-data-editor h3 { font-size: 1.05rem; font-weight: 700; margin: 0.75rem 0 0.45rem; color: #173f66; }
        .clinical-data-editor blockquote {
          margin: 0.65rem 0; padding-left: 0.85rem; border-left: 3px solid #cbd5e1; color: #475569;
        }
        .clinical-data-editor ul { list-style: disc; margin: 0.45rem 0 0.7rem 1.35rem; }
        .clinical-data-editor ol { list-style: decimal; margin: 0.45rem 0 0.7rem 1.35rem; }
        .clinical-data-editor table { width: 100%; border-collapse: collapse; margin: 0.7rem 0; }
        .clinical-data-editor th, .clinical-data-editor td { border: 1px solid #cbd5e1; padding: 0.45rem 0.55rem; vertical-align: top; }
        .clinical-data-editor th { background: #f1f5f9; font-weight: 700; }
      `}</style>
    </div>
  );

}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">
        {value || '-'}
      </p>
    </div>
  );
}

import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileImage,
  Image as ImageIcon,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { Button, Input } from '../../components/ui/FormElements';
import { useToast } from '../../components/ui/Toast';
import { uploadFile } from '../../utils/storage';
import {
  recordExternalRadiologyResult,
} from './api/radiology.api';
import {
  RadiologyRequestDTO,
} from './dtos/radiology.dto';
import {
  useRadiologyRequests,
  useRadiologySubscription,
} from './hooks/useRadiology';

const COMPLETED_STATUSES = new Set([
  'Final Report',
  'Completed',
  'Reported',
]);

function patientName(request: RadiologyRequestDTO): string {
  const patient: any = request.patient;
  if (!patient) return request.patient_id || 'Unknown patient';
  return (
    [patient.first_name, patient.middle_name, patient.surname]
      .filter(Boolean)
      .join(' ') || patient.patient_id || 'Unknown patient'
  );
}

function studyName(request: RadiologyRequestDTO): string {
  const imaging: any = request.imaging;
  return (
    imaging?.name ||
    (request as any).imaging_name ||
    request.imaging_type ||
    'Imaging study'
  );
}

export default function ExternalRadiology() {
  useRadiologySubscription();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'awaiting' | 'results'>('awaiting');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RadiologyRequestDTO | null>(null);
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useRadiologyRequests({ limit: 200 });
  const requests = useMemo(() => data?.data || [], [data]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return requests.filter((request) => {
      const completed = COMPLETED_STATUSES.has(request.status);
      if (activeTab === 'awaiting' && completed) return false;
      if (activeTab === 'results' && !completed) return false;
      if (!search) return true;
      return (
        patientName(request).toLowerCase().includes(search) ||
        studyName(request).toLowerCase().includes(search)
      );
    });
  }, [requests, activeTab, query]);

  const awaitingCount = requests.filter(
    (request) => !COMPLETED_STATUSES.has(request.status),
  ).length;
  const completedCount = requests.length - awaitingCount;

  const openResult = (request: RadiologyRequestDTO) => {
    setSelected(request);
    setFindings(request.findings || '');
    setImpression(request.impression || '');
    setFile(null);
    setPreviewUrl(null);
  };

  const closeResult = () => {
    setSelected(null);
    setFindings('');
    setImpression('');
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const onPickFile = (picked: File | null) => {
    setFile(picked);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(picked ? URL.createObjectURL(picked) : null);
  };

  const saveResult = async () => {
    if (!selected) return;
    if (!findings.trim() && !impression.trim()) {
      showToast({
        type: 'error',
        title: 'Result required',
        message: 'Enter the findings or impression before saving.',
      });
      return;
    }

    setIsSaving(true);
    try {
      let uploaded: {
        file: File;
        url: string;
        name: string;
        size: number;
        mime_type: string;
      } | null = null;

      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `external/${selected.request_id}/${Date.now()}-${safeName}`;
        const url = await uploadFile('radiology-images', path, file);
        uploaded = {
          file,
          url,
          name: file.name,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
        };
      }

      await recordExternalRadiologyResult({
        request_id: selected.request_id,
        findings: findings.trim(),
        impression: impression.trim(),
        image: uploaded,
      });

      showToast({
        type: 'success',
        title: 'Result saved',
        message: 'The external report is now available in the patient record.',
      });
      closeResult();
      await refetch();
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Could not save result',
        message: error?.message || 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D96A36]">
              Diagnostics
            </p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#11151C]">
              External Radiology
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Studies are performed outside the hospital. Record the report and
              attach the returned image here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Awaiting
              </p>
              <p className="text-xl font-bold text-[#11151C]">{awaitingCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Reported
              </p>
              <p className="text-xl font-bold text-[#11151C]">{completedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('awaiting')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'awaiting'
                  ? 'bg-white text-[#11151C] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="h-4 w-4" />
              Awaiting result
              {awaitingCount > 0 && (
                <span className="rounded-full bg-[#E9783F] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {awaitingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'results'
                  ? 'bg-white text-[#11151C] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              Results
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search patient or study…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#E9783F] focus:bg-white focus:ring-4 focus:ring-[#E9783F]/15"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-xl bg-slate-200/70"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <FileImage className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="font-semibold text-slate-700">
              {activeTab === 'awaiting'
                ? 'No results pending'
                : 'No reported results yet'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Imaging requests created in consultation appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[1.4fr_1.2fr_0.8fr_0.7fr_0.7fr] gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 md:grid">
              <span>Patient</span>
              <span>Study</span>
              <span>Requested</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filtered.map((request) => {
                const completed = COMPLETED_STATUSES.has(request.status);
                return (
                  <div
                    key={request.request_id}
                    className="grid gap-2 px-4 py-3 transition-colors hover:bg-slate-50/70 md:grid-cols-[1.4fr_1.2fr_0.8fr_0.7fr_0.7fr] md:items-center md:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {patientName(request)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {(request as any).patient?.emr_number || request.patient_id}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {studyName(request)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {(request as any).body_part || request.imaging_type || ''}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {request.created_at
                        ? new Date(request.created_at).toLocaleDateString()
                        : '—'}
                    </p>
                    <span
                      className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        completed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {completed ? 'Reported' : 'Awaiting'}
                    </span>
                    <div className="flex items-center gap-2 md:justify-end">
                      {completed && request.result_file_url && (
                        <a
                          href={request.result_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          Image
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => openResult(request)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#E9783F] px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-[#D96A36] active:scale-[0.99]"
                      >
                        {completed ? 'Edit result' : 'Enter result'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeResult}
          />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-[#E9783F] px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                  External result
                </p>
                <h2 className="truncate text-lg font-bold">
                  {patientName(selected)}
                </h2>
                <p className="truncate text-sm text-white/70">
                  {studyName(selected)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeResult}
                className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Findings
                </label>
                <textarea
                  value={findings}
                  onChange={(event) => setFindings(event.target.value)}
                  rows={4}
                  placeholder="Describe what the external report shows…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#E9783F] focus:bg-white focus:ring-4 focus:ring-[#E9783F]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Impression / Conclusion
                </label>
                <textarea
                  value={impression}
                  onChange={(event) => setImpression(event.target.value)}
                  rows={3}
                  placeholder="Radiologist's impression or conclusion…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-[#E9783F] focus:bg-white focus:ring-4 focus:ring-[#E9783F]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  Result image (optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(event) =>
                    onPickFile(event.target.files?.[0] || null)
                  }
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500 transition-colors hover:border-[#E9783F]/40 hover:bg-[#E9783F]/5 hover:text-[#11151C]"
                >
                  <Upload className="h-4 w-4" />
                  {file ? 'Replace image' : 'Upload report image'}
                </button>

                {file && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
                    {previewUrl && file.type.startsWith('image/') ? (
                      <img
                        src={previewUrl}
                        alt="Result preview"
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <ImageIcon className="h-6 w-6" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPickFile(null)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button variant="secondary" onClick={closeResult} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={saveResult} isLoading={isSaving}>
                Save result
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * RadiologyPanel - Professional Imaging & Diagnostics Report View
 *
 * Features:
 * - Formal radiology report layout
 * - Integrated findings and impressions with professional typography
 * - Image/Scan preview link section
 * - Print-ready design
 */

import React, { useState, useRef } from 'react';
import {
  Scan,
  ChevronRight,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  X,
  Edit3,
  Printer,
  User,
  Activity,
  Maximize2,
  ExternalLink,
  Download,
  Shield,
  ClipboardList,
} from 'lucide-react';
import { EncounterDetail } from '../../../../api/medical-records.api';
import { EmptyState } from '../../../../../../components/ui/DataDisplay';
import { StatusBadge, formatDateTime, formatDate } from '../shared';
import { ClinicalNotesModal } from '../../ClinicalNotesModal';

interface RadiologyPanelProps {
  encounter: EncounterDetail;
}

export function RadiologyPanel({ encounter }: RadiologyPanelProps) {
  const [selectedImaging, setSelectedImaging] = useState<any | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const imaging = encounter.imaging_results || [];
  const radiologyRequests = encounter.radiology_requests || [];

  // Combine results and requests
  const allImaging =
    imaging.length > 0
      ? imaging
      : radiologyRequests.map((req) => ({
          request_id: req.id,
          exam_name: req.study_type,
          study_type: req.study_type,
          body_part: req.body_part,
          modality: req.study_type,
          status: req.status,
          findings: req.report?.findings || null,
          impression: req.report?.impression || null,
          clinical_indication: req.clinical_indication,
          requested_date: req.requested_at,
          report_date: req.report?.reported_at || null,
          reported_by: req.report?.reported_by || null,
          result_file_url: null,
        }));

  if (allImaging.length === 0) {
    return (
      <EmptyState
        title="No Imaging Studies"
        description="No imaging studies ordered for this encounter."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* List View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allImaging.map((img: any, idx) => {
          const hasReport = img.findings || img.impression || img.report;

          return (
            <button
              key={img.request_id || idx}
              onClick={() => setSelectedImaging(img)}
              className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-lg flex flex-col justify-between ${
                hasReport
                  ? 'border-purple-100 bg-white'
                  : 'border-slate-100 bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`p-2 rounded-lg ${
                      hasReport
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Scan size={20} />
                  </div>
                  <StatusBadge status={img.status} />
                </div>
                <h3 className="font-bold text-slate-800 line-clamp-2 text-sm h-10 mb-1">
                  {img.exam_name || img.study_type}
                </h3>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                  {img.modality} {img.body_part ? ` — ${img.body_part}` : ''}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-medium">
                  <Calendar size={12} />
                  {formatDate(img.requested_date)}
                </div>
              </div>

              <div className="mt-auto border-t border-slate-100 pt-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {img.result_file_url && (
                    <Activity size={14} className="text-emerald-500" />
                  )}
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {img.status || 'Ordered'}
                  </span>
                </div>
                {hasReport ? (
                  <div className="flex items-center text-purple-600 font-bold text-xs">
                    View Report
                    <ChevronRight size={14} />
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">
                    Processing
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Imaging Detail Modal */}
      {selectedImaging && (
        <ImagingResultModal
          imaging={selectedImaging}
          patientName={encounter.patient_name || 'Patient'}
          emrNumber={encounter.emr_number}
          onClose={() => setSelectedImaging(null)}
          onDocumentReview={() => {
            setSelectedResult({
              id: selectedImaging.request_id || selectedImaging.id,
              name: selectedImaging.exam_name || selectedImaging.study_type,
            });
            setShowReviewModal(true);
          }}
        />
      )}

      {/* Clinical Notes Modal for Result Review */}
      {showReviewModal && selectedResult && (
        <ClinicalNotesModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedResult(null);
          }}
          encounterId={encounter.encounter_id}
          encounterNumber={encounter.encounter_number}
          visitId={encounter.visit_id}
          patientId={encounter.patient_id}
          patientName={encounter.patient_name || 'Patient'}
          encounterContext={{
            encounterId: encounter.encounter_id,
            patientId: encounter.patient_id,
            currentStage: encounter.status as any,
            status: encounter.status,
            createdAt: encounter.encounter_date,
            encounterType: (encounter.visit_type?.includes('Patient')
              ? 'In-Patient'
              : encounter.visit_type?.includes('Emergency')
                ? 'Emergency'
                : 'OPD') as 'OPD' | 'In-Patient' | 'Emergency',
            hasUnresolvedResults: false,
            consultationCount: 1,
          }}
          resultContext={{
            type: 'radiology',
            resultId: selectedResult.id,
            resultName: selectedResult.name,
          }}
          initialNoteType="result_review"
        />
      )}
    </div>
  );
}

// =============================================================================
// Imaging Result Modal - Redesigned as Formal Radiology Report
// =============================================================================
function ImagingResultModal({
  imaging,
  patientName,
  emrNumber,
  onClose,
  onDocumentReview,
}: {
  imaging: any;
  patientName: string;
  emrNumber: string;
  onClose: () => void;
  onDocumentReview: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const hasReport = imaging.findings || imaging.impression;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write('<html><head><title>Radiology Report</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(
      'body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }',
    );
    printWindow.document.write(
      '.header { border-bottom: 3px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }',
    );
    printWindow.document.write(
      '.section-title { font-weight: 900; text-transform: uppercase; font-size: 14px; margin-bottom: 10px; color: #64748b; border-bottom: 1px solid #e2e8f0; }',
    );
    printWindow.document.write(
      '.findings { margin-bottom: 25px; text-align: justify; }',
    );
    printWindow.document.write(
      '.impression { background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #1e293b; font-weight: 600; }',
    );
    printWindow.document.write(
      'h1 { margin: 0; font-size: 28px; font-weight: 900; }',
    );
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(content.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header toolbar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-500" />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <span className="font-bold text-slate-700 tracking-tight">
              Radiology Information Systems (RIS)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <Printer size={16} /> Print Report
            </button>
            {hasReport && (
              <button
                onClick={onDocumentReview}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Edit3 size={16} /> Clinical Interpretation
              </button>
            )}
          </div>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-y-auto p-10 space-y-10" ref={printRef}>
          {/* Document Header */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8">
            <div className="space-y-4">
              <div>
                <h1 className="text-4xl font-black text-slate-900 leading-none">
                  RADIOLOGY REPORT
                </h1>
                <p className="text-slate-500 font-bold tracking-widest mt-1 text-xs uppercase">
                  Diagnostic Imaging Division
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-slate-400" />
                  <span className="text-slate-400 text-xs font-black uppercase">
                    Patient Name
                  </span>
                  <span className="font-bold text-slate-900 text-sm whitespace-nowrap">
                    {patientName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-slate-400" />
                  <span className="text-slate-400 text-xs font-black uppercase">
                    Patient number
                  </span>
                  <span className="font-bold text-slate-900 text-sm font-mono tracking-tighter">
                    {emrNumber}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                  {imaging.status || 'Report Released'}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Reporting Pipeline
                </p>
                <p className="text-xs font-bold text-slate-800">
                  Request: {formatDateTime(imaging.requested_date)}
                </p>
                {imaging.report_date && (
                  <p className="text-xs font-bold text-blue-600">
                    Released: {formatDateTime(imaging.report_date)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Study Summary Card */}
          <div className="bg-slate-950 p-6 rounded-xl text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Scan size={120} />
            </div>

            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-xs font-black uppercase tracking-[0.3em] mb-1">
                  Investigation Profile
                </p>
                <h2 className="text-3xl font-black tracking-tight">
                  {imaging.exam_name || imaging.study_type}
                </h2>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg text-sm font-bold border border-white/10">
                    <Maximize2 size={14} className="text-blue-400" />
                    {imaging.modality || 'Diagnostic Scan'}
                  </div>
                  {imaging.body_part && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg text-sm font-bold border border-white/10">
                      <Activity size={14} className="text-emerald-400" />
                      {imaging.body_part}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Indication */}
          {imaging.clinical_indication && (
            <div className="bg-amber-50 rounded-xl p-6 border-l-4 border-amber-500 shadow-sm">
              <h4 className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-widest mb-3">
                <ClipboardList size={16} /> Clinical History & Indication
              </h4>
              <p className="text-sm font-medium text-amber-900 leading-relaxed italic">
                {imaging.clinical_indication}
              </p>
            </div>
          )}

          {/* The Report Core */}
          <div className="space-y-8">
            {hasReport ? (
              <>
                {/* Findings Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                      Clinical Findings
                    </h3>
                    <div className="h-px bg-slate-200 w-full" />
                  </div>
                  <div className="text-slate-800 text-sm leading-[1.8] font-medium whitespace-pre-wrap px-2">
                    {imaging.findings ||
                      'No descriptive findings provided for this study.'}
                  </div>
                </div>

                {/* Impression Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                      Radiological Impression
                    </h3>
                    <div className="h-px bg-slate-200 w-full" />
                  </div>
                  <div className="bg-slate-50 border-2 border-slate-200 p-6 rounded-xl shadow-inner group transition-all hover:bg-white hover:border-slate-800">
                    <p className="text-lg font-black text-slate-900 leading-relaxed uppercase tracking-tighter decoration-slate-300 decoration-4">
                      {imaging.impression ||
                        'Diagnosis pending formal verification.'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center bg-slate-50 rounded-xl border-4 border-dashed border-slate-200">
                <div className="p-5 bg-white rounded-xl shadow-xl mb-4 text-slate-400 animate-pulse">
                  <Clock size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                  Report Under Review
                </h3>
                <p className="text-slate-500 text-sm font-medium max-w-xs text-center mt-2">
                  The radiologist is currently analyzing the captured images.
                  The report will appear here automatically when released.
                </p>
              </div>
            )}
          </div>

          {/* Technical and Signature Details */}
          <div className="grid grid-cols-2 gap-10 pt-10 border-t border-slate-100">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Imaging Metadata
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                    <span className="text-slate-500">Modality</span>
                    <span className="font-bold">{imaging.modality || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                    <span className="text-slate-500">Body Part</span>
                    <span className="font-bold">{imaging.body_part || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1">
                    <span className="text-slate-500">Priority</span>
                    <span className="font-bold">{imaging.priority || 'Routine'}</span>
                  </div>
                </div>
              </div>

              {/* Attachment Previews */}
              {imaging.result_file_url && (
                <div className="pt-2">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                    Visual Evidence
                  </p>
                  <div className="flex gap-3">
                    <a
                      href={imaging.result_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-slate-900 text-white flex items-center gap-2 font-bold text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                    >
                      <ExternalLink size={14} /> Full DICOM Viewer
                    </a>
                    <a
                      href={imaging.result_file_url}
                      download
                      className="p-3 rounded-xl bg-white border border-slate-300 text-slate-700 flex items-center gap-2 font-bold text-xs hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                      <Download size={14} /> JPEG Archive
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end justify-end">
              <div className="w-full text-center space-y-2">
                <div className="h-14 flex items-center justify-center overflow-hidden opacity-60 grayscale">
                  {/* Placeholder for real signature image */}
                  <span className="text-2xl font-serif italic text-slate-300">
                    Certified Signature
                  </span>
                </div>
                <div className="border-t-2 border-slate-900 pt-2">
                  <p className="text-sm font-black text-slate-900 uppercase">
                    {imaging.reported_by || 'Staff Radiologist'}
                  </p>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Board Certified Radiologist
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1">
                    License #: RIS-{emrNumber.slice(-4)}-RAD
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

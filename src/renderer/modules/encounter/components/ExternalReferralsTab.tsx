// =============================================================================
// ENCOUNTER MODULE - EXTERNAL REFERRALS TAB
//
// This component displays approved outgoing NHIS referrals ready for printing.
// Staff can view referral details and print the official NHIS Referral Form.
//
// Workflow:
// 1. Doctor creates outgoing referral request during consultation
// 2. NHIS Desk approves and enters referral code + destination
// 3. Approved referrals appear here for printing
// 4. Staff prints the form and gives to patient
// =============================================================================

import { isMilitaryFeatureEnabled } from '../../../config/features';
import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  FileText,
  User,
  Building2,
  Calendar,
  Clock,
  ChevronRight,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  X,
  Stethoscope,
  FlaskConical,
  ScanLine,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../api/supabaseClient';
import NhisReferralForm, { NhisReferralFormData } from './NhisReferralForm';
import { formatDetailedAge } from '../../patient-registration/dtos/patient.dto';

interface OutgoingReferral {
  queue_id: string;
  queue_status: string;
  referral_direction: string;
  requested_at: string;
  processed_at: string;

  // NHIS Referral Details
  nhis_referral_code: string;
  referral_valid_from: string;
  referral_valid_to: string;
  is_expired: boolean;

  // Destination Facility
  destination_facility_name: string;
  destination_facility_nhis_id: string | null;
  destination_facility_address: string | null;

  // Patient Info
  patient_id: string;
  file_number: string;
  emr_number: string | null;
  first_name: string;
  middle_name: string | null;
  surname: string;
  patient_full_name: string;
  patient_age: number | null;
  gender: string | null;
  contact_phone: string | null;
  residential_address: string | null;

  // Patient NHIS Info
  nhis_number: string | null;
  hmo_code: string | null;
  nhis_id_no: string | null;

  // Clinical Data
  clinical_findings: string | null;
  examination_findings: string | null;
  investigation_findings: string | null;
  provisional_diagnosis: string | null;
  diagnosis: string | null;
  reason_for_referral: string | null;
  clinical_notes: string | null;

  // Referring Doctor
  referring_doctor_id: string | null;
  referring_doctor_name: string | null;
  referring_doctor_department: string | null;

  // Source Encounter
  source_encounter_id: string | null;
  encounter_number: string | null;
  encounter_date: string | null;

  // Print Info
  printed_at: string | null;
  print_count: number;
  printed_by_first_name: string | null;
  printed_by_last_name: string | null;

  // Approval Info
  approved_by_first_name: string | null;
  approved_by_last_name: string | null;
  approval_notes: string | null;
}

interface ExternalReferralsTabProps {
  showOnlyReadyToPrint?: boolean;
}

export const ExternalReferralsTab: React.FC<ExternalReferralsTabProps> = ({
  showOnlyReadyToPrint = false,
}) => {
  const { user, staff } = useAuth();
  const [referrals, setReferrals] = useState<OutgoingReferral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReferral, setSelectedReferral] =
    useState<OutgoingReferral | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [patientBio, setPatientBio] = useState<{
    patient_category: string | null;
    title: string | null;
    rank: string | null;
    service_number: string | null;
    military_branch: string | null;
    arm_of_service: string | null;
    date_of_birth: string | null;
    emr_number: string | null;
  } | null>(null);
  const [investigationData, setInvestigationData] = useState<{
    labRequests: Array<{
      test_name: string;
      status: string;
      result: string | null;
      result_notes: string | null;
      clinical_notes: string | null;
    }>;
    radiologyRequests: Array<{
      imaging_type: string;
      body_part: string | null;
      status: string;
      findings: string | null;
      impression: string | null;
      clinical_indication: string | null;
    }>;
  }>({ labRequests: [], radiologyRequests: [] });

  const printRef = useRef<HTMLDivElement>(null);

  const fetchReferrals = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('nhis_outgoing_referrals_view')
        .select('*')
        .order('processed_at', { ascending: false });

      if (showOnlyReadyToPrint) {
        query = query.eq('queue_status', 'approved');
      } else {
        query = query.in('queue_status', ['approved', 'completed']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReferrals(data || []);
    } catch (err) {
      console.error('Error fetching external referrals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, [showOnlyReadyToPrint]);

  // Fetch patient registration bio-data from patients table
  const fetchPatientBio = async (patientId: string) => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(
          'patient_category, title, rank, service_number, military_branch, arm_of_service, date_of_birth, emr_number',
        )
        .eq('id', patientId)
        .single();

      if (error) throw error;
      setPatientBio(data);
    } catch (err) {
      console.error('Error fetching patient bio:', err);
      setPatientBio(null);
    }
  };

  // Fetch lab and radiology investigation data for the referral's encounter
  const fetchInvestigationData = async (
    encounterId: string | null,
    patientId: string,
  ) => {
    try {
      // Fetch lab requests - prefer encounter-level, fall back to patient-level
      let labQuery = supabase
        .from('lab_requests')
        .select(
          'request_id, status, result, result_notes, clinical_notes, test_id',
        )
        .order('created_at', { ascending: false });

      if (encounterId) {
        labQuery = labQuery.eq('encounter_id', encounterId);
      } else {
        labQuery = labQuery.eq('patient_id', patientId).limit(10);
      }

      const { data: labData } = await labQuery;

      // Fetch test names from catalogue
      const testIds = (labData || [])
        .map((lr: any) => lr.test_id)
        .filter(Boolean);
      const testMap: Record<string, { name: string; category: string | null }> =
        {};
      if (testIds.length > 0) {
        const { data: tests } = await supabase
          .from('lab_test_catalogue')
          .select('id, name, category')
          .in('id', testIds);
        (tests || []).forEach((t: any) => {
          testMap[t.id] = { name: t.name, category: t.category };
        });
      }

      // Fetch radiology requests
      let radQuery = supabase
        .from('radiology_requests')
        .select(
          'request_id, status, findings, impression, clinical_indication, imaging_id, imaging_type, body_part',
        )
        .order('created_at', { ascending: false });

      if (encounterId) {
        radQuery = radQuery.eq('encounter_id', encounterId);
      } else {
        radQuery = radQuery.eq('patient_id', patientId).limit(10);
      }

      const { data: radData } = await radQuery;

      // Fetch imaging names from catalogue
      const imgIds = (radData || [])
        .map((rr: any) => rr.imaging_id)
        .filter(Boolean);
      const imgMap: Record<
        string,
        { modality: string; body_part: string | null; name: string }
      > = {};
      if (imgIds.length > 0) {
        const { data: imgs } = await supabase
          .from('imaging_catalogue')
          .select('id, modality, body_part, name')
          .in('id', imgIds);
        (imgs || []).forEach((im: any) => {
          imgMap[im.id] = {
            modality: im.modality,
            body_part: im.body_part,
            name: im.name,
          };
        });
      }

      setInvestigationData({
        labRequests: (labData || []).map((lr: any) => ({
          test_name: testMap[lr.test_id]?.name || 'Unknown Test',
          status: lr.status || 'Pending',
          result: lr.result,
          result_notes: lr.result_notes,
          clinical_notes: lr.clinical_notes,
        })),
        radiologyRequests: (radData || []).map((rr: any) => {
          const cat = imgMap[rr.imaging_id];
          return {
            imaging_type: cat?.modality || rr.imaging_type || 'Unknown',
            body_part: cat?.body_part || rr.body_part || null,
            status: rr.status || 'Pending',
            findings: rr.findings,
            impression: rr.impression,
            clinical_indication: rr.clinical_indication,
          };
        }),
      });
    } catch (err) {
      console.error('Error fetching investigation data:', err);
      setInvestigationData({ labRequests: [], radiologyRequests: [] });
    }
  };

  // Format investigation data as readable text for the print form
  const formatInvestigationText = (): string => {
    const parts: string[] = [];

    // Add existing investigation_findings if any
    if (selectedReferral?.investigation_findings) {
      parts.push(selectedReferral.investigation_findings);
    }

    // Lab investigations
    if (investigationData.labRequests.length > 0) {
      const labLines = investigationData.labRequests.map((lr) => {
        let line = `• ${lr.test_name} — ${lr.status}`;
        if (lr.result) line += `: ${lr.result}`;
        if (lr.result_notes) line += ` (${lr.result_notes})`;
        return line;
      });
      if (
        !parts.length ||
        !parts[0]?.includes(investigationData.labRequests[0].test_name)
      ) {
        parts.push(`LABORATORY INVESTIGATIONS:\n${labLines.join('\n')}`);
      }
    }

    // Radiology investigations
    if (investigationData.radiologyRequests.length > 0) {
      const radLines = investigationData.radiologyRequests.map((rr) => {
        let line = `• ${rr.imaging_type}`;
        if (rr.body_part) line += ` (${rr.body_part})`;
        line += ` — ${rr.status}`;
        if (rr.findings) line += `\n  Findings: ${rr.findings}`;
        if (rr.impression) line += `\n  Impression: ${rr.impression}`;
        return line;
      });
      parts.push(`IMAGING/RADIOLOGY INVESTIGATIONS:\n${radLines.join('\n')}`);
    }

    return parts.filter(Boolean).join('\n\n') || '';
  };

  // Fetch patient bio & investigations when a referral is selected
  useEffect(() => {
    if (selectedReferral) {
      fetchPatientBio(selectedReferral.patient_id);
      fetchInvestigationData(
        selectedReferral.source_encounter_id,
        selectedReferral.patient_id,
      );
    } else {
      setPatientBio(null);
      setInvestigationData({ labRequests: [], radiologyRequests: [] });
    }
  }, [selectedReferral?.queue_id]);

  // Handle print using window.print()
  const handlePrint = async () => {
    if (!printRef.current) return;

    // Create a new window for printing
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>NHIS_Referral_${selectedReferral?.nhis_referral_code || 'form'}</title>
          <style>
            @media print {
              body { margin: 0; padding: 16px; }
              .no-print { display: none !important; }
              @page { margin: 10mm; size: A4 portrait; }
            }
            body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
            img { max-width: 100%; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
        </html>
      `);
      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = async () => {
          printWindow.close();
          // Record the print
          if (selectedReferral) {
            try {
              await supabase.rpc('record_referral_print', {
                p_queue_id: selectedReferral.queue_id,
                p_printed_by: staff?.id || null,
              });
              fetchReferrals();
            } catch (err) {
              console.error('Error recording print:', err);
            }
          }
          setShowPrintPreview(false);
        };
      };
    }
  };

  const filteredReferrals = referrals.filter((ref) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ref.patient_full_name?.toLowerCase().includes(query) ||
      ref.file_number?.toLowerCase().includes(query) ||
      ref.nhis_referral_code?.toLowerCase().includes(query) ||
      ref.destination_facility_name?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string, isExpired: boolean) => {
    if (isExpired) {
      return (
        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 border border-red-200">
          Expired
        </span>
      );
    }
    switch (status) {
      case 'approved':
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 border border-green-200">
            Ready to Print
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            Printed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const getPrintFormData = (ref: OutgoingReferral): NhisReferralFormData => ({
    nhisReferralCode: ref.nhis_referral_code || '',
    nhisIdNo: ref.nhis_id_no || ref.nhis_number || '',
    hmoCode: ref.hmo_code || '',
    date: ref.processed_at || ref.requested_at,

    fromFacility: 'XenoCare',
    fromFacilityNhisId: '', // TODO: Get from facility settings
    fromFacilityAddress: 'XenoCare',
    referredTo: ref.destination_facility_name || '',
    referredToNhisId: ref.destination_facility_nhis_id || undefined,
    referredToAddress: ref.destination_facility_address || undefined,

    fileNo: patientBio?.emr_number || ref.emr_number || '', // Use emr_number (e.g. NDC-0001), NOT file_number (UUID)
    patientName:
      ref.patient_full_name ||
      `${ref.first_name} ${ref.middle_name || ''} ${ref.surname}`.trim(),
    patientCategory:
      isMilitaryFeatureEnabled() || patientBio?.patient_category !== 'Military'
        ? patientBio?.patient_category || ''
        : 'Civilian',
    patientTitle: patientBio?.title || '',
    patientRank: isMilitaryFeatureEnabled() ? patientBio?.rank || '' : '',
    serviceNumber: isMilitaryFeatureEnabled()
      ? patientBio?.service_number || ''
      : '',
    militaryBranch: isMilitaryFeatureEnabled()
      ? patientBio?.military_branch || patientBio?.arm_of_service || ''
      : '',
    patientAge: ref.patient_age ?? undefined,
    patientGender: ref.gender || '',
    dateOfBirth: patientBio?.date_of_birth || '',
    patientAddress: ref.residential_address || '',
    patientPhone: ref.contact_phone || '',

    clinicalFindings: ref.clinical_findings || ref.examination_findings || '',
    investigation: formatInvestigationText(),
    provisionalDiagnosis: ref.provisional_diagnosis || ref.diagnosis || '',
    reasonForReferral: ref.reason_for_referral || '',

    doctorName: ref.referring_doctor_name || '',

    validFrom: ref.referral_valid_from || '',
    validTo: ref.referral_valid_to || '',
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2.5 rounded-lg">
              <ExternalLink className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                External NHIS Referrals
              </h2>
              <p className="text-sm text-gray-500">
                Approved outgoing referrals ready for printing
              </p>
            </div>
          </div>
          <button
            onClick={fetchReferrals}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient name, file number, referral code, or destination..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-600">
              Ready to Print:{' '}
              {
                referrals.filter(
                  (r) => r.queue_status === 'approved' && !r.is_expired,
                ).length
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-600">
              Printed:{' '}
              {referrals.filter((r) => r.queue_status === 'completed').length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-gray-600">
              Expired: {referrals.filter((r) => r.is_expired).length}
            </span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-100">
        {isLoading ? (
          <div className="py-12 text-center">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading referrals...</p>
          </div>
        ) : filteredReferrals.length === 0 ? (
          <div className="py-12 text-center">
            <ExternalLink className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              No external referrals found
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Approved outgoing NHIS referrals will appear here
            </p>
          </div>
        ) : (
          filteredReferrals.map((ref) => (
            <div
              key={ref.queue_id}
              className="px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Patient Avatar */}
                  <div className="bg-indigo-100 p-2.5 rounded-full">
                    <User className="h-5 w-5 text-indigo-600" />
                  </div>

                  {/* Patient & Referral Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 truncate">
                        {ref.patient_full_name}
                      </p>
                      {getStatusBadge(ref.queue_status, ref.is_expired)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {ref.emr_number || ref.file_number}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-indigo-600">
                        {ref.nhis_referral_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                      <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      <span>→ {ref.destination_facility_name}</span>
                    </div>
                  </div>
                </div>

                {/* Right Side - Date & Actions */}
                <div className="flex items-center gap-4">
                  {/* Validity */}
                  <div className="text-right text-sm">
                    <p className="text-gray-500">Valid Until</p>
                    <p
                      className={`font-medium ${ref.is_expired ? 'text-red-600' : 'text-gray-900'}`}
                    >
                      {ref.referral_valid_to
                        ? new Date(ref.referral_valid_to).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>

                  {/* Print Count */}
                  {ref.print_count > 0 && (
                    <div className="text-right text-sm">
                      <p className="text-gray-500">Printed</p>
                      <p className="font-medium text-gray-900">
                        {ref.print_count}x
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedReferral(ref)}
                      className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReferral(ref);
                        setShowPrintPreview(true);
                      }}
                      disabled={ref.is_expired}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Printer className="h-4 w-4" />
                      Print Form
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal — Matches Print Form Template */}
      {selectedReferral && !showPrintPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header — XenoCare Branded */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-700 to-[#008545] px-6 py-4 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Referral Details
                    </h3>
                    <p className="text-sm text-emerald-100 font-mono">
                      {selectedReferral.nhis_referral_code}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedReferral(null)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Section 1: Patient Bio-Data */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
                  <User size={14} className="text-primary-700" />
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Patient Bio-Data
                  </span>
                </div>
                <div className="p-4 grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Full Name
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {selectedReferral.patient_full_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Category
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {patientBio?.patient_category || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      File No. (EMR)
                    </p>
                    <p className="text-sm font-bold text-primary-700 font-mono mt-0.5">
                      {patientBio?.emr_number ||
                        selectedReferral.emr_number ||
                        'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Age
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {patientBio?.date_of_birth
                        ? formatDetailedAge(patientBio.date_of_birth)
                        : selectedReferral.patient_age
                          ? `${selectedReferral.patient_age}y`
                          : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Gender
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {selectedReferral.gender || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Date of Birth
                    </p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {patientBio?.date_of_birth
                        ? new Date(patientBio.date_of_birth).toLocaleDateString(
                            'en-GB',
                            { day: '2-digit', month: 'short', year: 'numeric' },
                          )
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Address
                    </p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {selectedReferral.residential_address || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Phone
                    </p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {selectedReferral.contact_phone || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: NHIS Details */}
              <div className="bg-primary-700/5 rounded-xl border border-primary-700/15 overflow-hidden">
                <div className="px-4 py-2.5 bg-primary-700/10 border-b border-primary-700/15 flex items-center gap-2">
                  <FileText size={14} className="text-primary-700" />
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">
                    NHIS Details
                  </span>
                </div>
                <div className="p-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider">
                      Referral Code
                    </p>
                    <p className="text-sm font-bold text-primary-700 font-mono mt-0.5">
                      {selectedReferral.nhis_referral_code}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider">
                      NHIS ID No
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {selectedReferral.nhis_id_no ||
                        selectedReferral.nhis_number ||
                        '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider">
                      HMO / Scheme
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {selectedReferral.hmo_code || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider">
                      Dest. Facility NHIS ID
                    </p>
                    <p className="text-sm font-mono text-gray-900 mt-0.5">
                      {selectedReferral.destination_facility_nhis_id || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider">
                      Date Code Issued
                    </p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {selectedReferral.referral_valid_from
                        ? new Date(
                            selectedReferral.referral_valid_from,
                          ).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider">
                      Code Expiry (30 Days)
                    </p>
                    <p
                      className={`text-sm font-semibold mt-0.5 ${selectedReferral.is_expired ? 'text-red-600' : 'text-gray-900'}`}
                    >
                      {selectedReferral.referral_valid_to
                        ? new Date(
                            selectedReferral.referral_valid_to,
                          ).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                      {selectedReferral.is_expired && ' (EXPIRED)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: Facility Information */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <Building2 size={14} className="text-primary-700" />
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Facility Information
                  </span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider">
                      From (Health Facility)
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      XenoCare
                    </p>
                    <p className="text-xs text-gray-600">
                      XenoCare
                    </p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      Referred To
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {selectedReferral.destination_facility_name}
                    </p>
                    {selectedReferral.destination_facility_address && (
                      <p className="text-xs text-gray-600">
                        {selectedReferral.destination_facility_address}
                      </p>
                    )}
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Referring Doctor
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {selectedReferral.referring_doctor_name || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 4: Clinical Details */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <Stethoscope size={14} className="text-primary-700" />
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Clinical Details
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Clinical Findings
                    </p>
                    <p className="mt-1 text-sm text-gray-800 bg-gray-50 rounded-lg p-2.5 border border-gray-100 whitespace-pre-wrap">
                      {selectedReferral.clinical_findings ||
                        selectedReferral.examination_findings ||
                        'N/A'}
                    </p>
                  </div>

                  {/* Investigation — Auto-populated from lab & radiology */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      Investigation
                      {(investigationData.labRequests.length > 0 ||
                        investigationData.radiologyRequests.length > 0) && (
                        <span className="text-[9px] font-normal bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                          Auto-populated
                        </span>
                      )}
                    </p>
                    <div className="mt-1 text-sm text-gray-800 bg-gray-50 rounded-lg p-2.5 border border-gray-100 space-y-2">
                      {/* Manual investigation findings */}
                      {selectedReferral.investigation_findings && (
                        <p className="whitespace-pre-wrap">
                          {selectedReferral.investigation_findings}
                        </p>
                      )}

                      {/* Lab Investigations */}
                      {investigationData.labRequests.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-blue-700 flex items-center gap-1 mb-1">
                            <FlaskConical size={12} /> Laboratory Investigations
                            ({investigationData.labRequests.length})
                          </p>
                          <div className="space-y-1">
                            {investigationData.labRequests.map((lr, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 text-xs"
                              >
                                <span className="text-gray-400">•</span>
                                <span className="font-medium text-gray-800">
                                  {lr.test_name}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    lr.status === 'Completed'
                                      ? 'bg-green-100 text-green-700'
                                      : lr.status === 'Pending'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {lr.status}
                                </span>
                                {lr.result && (
                                  <span className="text-gray-600">
                                    — {lr.result}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Radiology Investigations */}
                      {investigationData.radiologyRequests.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-purple-700 flex items-center gap-1 mb-1">
                            <ScanLine size={12} /> Imaging/Radiology
                            Investigations (
                            {investigationData.radiologyRequests.length})
                          </p>
                          <div className="space-y-1">
                            {investigationData.radiologyRequests.map(
                              (rr, i) => (
                                <div key={i} className="text-xs">
                                  <div className="flex items-start gap-2">
                                    <span className="text-gray-400">•</span>
                                    <span className="font-medium text-gray-800">
                                      {rr.imaging_type}
                                      {rr.body_part ? ` (${rr.body_part})` : ''}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                        rr.status === 'Reported'
                                          ? 'bg-green-100 text-green-700'
                                          : rr.status === 'Completed'
                                            ? 'bg-blue-100 text-blue-700'
                                            : rr.status === 'Pending'
                                              ? 'bg-yellow-100 text-yellow-700'
                                              : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {rr.status}
                                    </span>
                                  </div>
                                  {rr.findings && (
                                    <p className="ml-4 text-gray-600 mt-0.5">
                                      Findings: {rr.findings}
                                    </p>
                                  )}
                                  {rr.impression && (
                                    <p className="ml-4 text-gray-600">
                                      Impression: {rr.impression}
                                    </p>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                      {/* Fallback if nothing */}
                      {!selectedReferral.investigation_findings &&
                        investigationData.labRequests.length === 0 &&
                        investigationData.radiologyRequests.length === 0 && (
                          <p className="text-gray-400 italic">
                            No investigations requested for this encounter
                          </p>
                        )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Provisional Diagnosis
                    </p>
                    <p className="mt-1 text-sm text-gray-800 bg-gray-50 rounded-lg p-2.5 border border-gray-100 whitespace-pre-wrap">
                      {selectedReferral.provisional_diagnosis ||
                        selectedReferral.diagnosis ||
                        'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Reason for Referral
                    </p>
                    <p className="mt-1 text-sm text-gray-800 bg-gray-50 rounded-lg p-2.5 border border-gray-100 whitespace-pre-wrap">
                      {selectedReferral.reason_for_referral || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Print Info */}
              {selectedReferral.print_count > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="text-blue-800">
                    <span className="font-medium">Printed:</span>{' '}
                    {selectedReferral.print_count} time(s)
                    {selectedReferral.printed_at && (
                      <>
                        {' '}
                        • Last:{' '}
                        {new Date(selectedReferral.printed_at).toLocaleString()}
                      </>
                    )}
                    {selectedReferral.printed_by_first_name && (
                      <>
                        {' '}
                        by {selectedReferral.printed_by_first_name}{' '}
                        {selectedReferral.printed_by_last_name}
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setSelectedReferral(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => setShowPrintPreview(true)}
                  disabled={selectedReferral.is_expired}
                  className="flex items-center gap-2 px-6 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Printer className="h-4 w-4" />
                  Print Referral Form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && selectedReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-700 to-[#008545] px-6 py-4 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Print Preview
                    </h3>
                    <p className="text-sm text-emerald-100">
                      NHIS Referral Form — XenoCare
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="p-2 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Print Content */}
            <div className="p-4 bg-gray-100">
              <div className="bg-white shadow-lg">
                <NhisReferralForm
                  ref={printRef}
                  data={getPrintFormData(selectedReferral)}
                  showAcknowledgement
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Print count:{' '}
                  <span className="font-semibold text-gray-700">
                    {selectedReferral.print_count}
                  </span>
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowPrintPreview(false)}
                    className="px-5 py-2.5 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary-700 text-white rounded-xl hover:bg-primary-800 font-semibold text-sm shadow-sm transition-colors"
                  >
                    <Printer className="h-4 w-4" />
                    Print Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalReferralsTab;
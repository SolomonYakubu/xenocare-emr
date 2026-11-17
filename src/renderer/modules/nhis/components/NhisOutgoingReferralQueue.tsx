// =============================================================================
// NHIS OUTGOING REFERRAL PROCESSING COMPONENT — XenoCare Branded
//
// This component allows NHIS desk officers to:
// 1. View pending outgoing referral requests from doctors
// 2. Enter the official NHIS referral code
// 3. Select/enter the destination facility
// 4. Approve or reject the referral
//
// Approved referrals route to Encounter module for printing.
// =============================================================================

import React, { useState, useEffect, startTransition } from 'react';
import {
  Building2,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  User,
  Phone,
  Calendar,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Search,
  Shield,
  Send,
  Printer,
  Hash,
  CreditCard,
  MapPin,
  Stethoscope,
  X,
  FlaskConical,
  ScanLine,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../api/supabaseClient';
import { formatDetailedAge } from '../../patient-registration/dtos/patient.dto';
import { PayerDetailsCard } from './PayerDetailsCard';
import type { PayerInfo } from '../../../types/database.types';
import { useToast } from '../../../components/ui/Toast';
import { formatClinicalTextForDisplay } from '../../../utils/clinicalTextFormatter';

interface OutgoingReferralItem {
  queue_id: string;
  status: string;
  urgency: string;
  requested_at: string;

  // Patient Info
  patient_id: string;
  file_number: string;
  patient_name: string;
  contact_phone: string | null;
  nhis_number: string | null;
  hmo_scheme: string | null;
  hmo_enrolee_id: string | null;

  // Clinical Summary
  provisional_diagnosis: string | null;
  reason_for_referral: string | null;

  // Referring Doctor
  referring_doctor: string | null;

  // Fields NHIS Officer enters
  nhis_referral_code: string | null;
  destination_facility_name: string | null;
  destination_facility_nhis_id: string | null;
  referral_valid_from: string | null;
  referral_valid_to: string | null;

  // Source encounter (for fetching investigations)
  source_encounter_id?: string | null;

  // patient number (enriched after fetch)
  emr_number?: string | null;
}

// Extended patient bio data fetched separately
interface PatientBioData {
  patient_category: string | null;
  title: string | null;
  rank: string | null;
  service_number: string | null;
  military_branch: string | null;
  date_of_birth: string | null;
  emr_number: string | null;
  gender: string | null;
  residential_address: string | null;
  payer_info: PayerInfo | null;
  insurance_type: string | null;
  nhis_number: string | null;
}

interface InvestigationData {
  labRequests: Array<{
    test_name: string;
    status: string;
    result: string | null;
    result_notes: string | null;
  }>;
  radiologyRequests: Array<{
    imaging_type: string;
    body_part: string | null;
    status: string;
    findings: string | null;
    impression: string | null;
  }>;
}

function normalizeSearchValue(value: string | null | undefined): string {
  return (value || '').toLowerCase();
}

// Clinical findings from nhis_referral_queue + consultations
interface ClinicalData {
  chief_complaint: string | null;
  examination_findings: string | null;
  investigation_findings: string | null;
  clinical_notes: string | null;
  // From consultations table (fallback)
  history_of_present_illness: string | null;
  treatment_plan: string | null;
  complaints: string | null;
}

interface ApprovalModalProps {
  item: OutgoingReferralItem;
  onClose: () => void;
  onApprove: (data: {
    nhis_referral_code: string;
    destination_facility_name: string;
    destination_facility_nhis_id?: string;
    destination_facility_address?: string;
    referral_valid_from: string;
    referral_valid_to: string;
    processing_notes?: string;
  }) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  isProcessing: boolean;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({
  item,
  onClose,
  onApprove,
  onReject,
  isProcessing,
}) => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    nhis_referral_code: '',
    destination_facility_name: '',
    destination_facility_nhis_id: '',
    destination_facility_address: '',
    referral_valid_from: new Date().toISOString().split('T')[0],
    referral_valid_to: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })(),
    processing_notes: '',
    rejection_reason: '',
  });
  const [showReject, setShowReject] = useState(false);
  const [patientBio, setPatientBio] = useState<PatientBioData | null>(null);
  const [investigationData, setInvestigationData] = useState<InvestigationData>(
    { labRequests: [], radiologyRequests: [] },
  );
  const [clinicalData, setClinicalData] = useState<ClinicalData | null>(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Default to standard size, expandable to fullscreen
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const clinicalFindingsDisplay = formatClinicalTextForDisplay(
    clinicalData?.chief_complaint ||
      clinicalData?.examination_findings ||
      clinicalData?.complaints,
  );
  const provisionalDiagnosisDisplay = formatClinicalTextForDisplay(
    item.provisional_diagnosis,
  );
  const reasonForReferralDisplay = formatClinicalTextForDisplay(
    item.reason_for_referral,
  );

  const toggleSection = (key: string) => {
    setCollapsedSections((prev: Record<string, boolean>) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Fetch full patient bio-data from patients table
  const fetchPatientBio = async (patientId: string) => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(
          'patient_category, title, rank, service_number, military_branch, date_of_birth, emr_number, gender, residential_address, payer_info, insurance_type, nhis_number',
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

  // Fetch clinical findings from nhis_referral_queue + consultations
  const fetchClinicalData = async (
    queueId: string,
    encounterId: string | null,
  ) => {
    try {
      // First fetch from nhis_referral_queue (has chief_complaint, examination_findings, etc.)
      const { data: queueData } = await supabase
        .from('nhis_referral_queue')
        .select(
          'chief_complaint, examination_findings, investigation_findings, clinical_notes, source_encounter_id',
        )
        .eq('id', queueId)
        .single();

      const effectiveEncounterId =
        encounterId || queueData?.source_encounter_id;

      // Also fetch from consultations table for richer clinical data
      let consultData: any = null;
      if (effectiveEncounterId) {
        const { data } = await supabase
          .from('consultations')
          .select(
            'complaints, history_of_present_illness, examination_findings, clinical_notes, treatment_plan, assessment, plan',
          )
          .eq('encounter_id', effectiveEncounterId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        consultData = data;
      }

      setClinicalData({
        chief_complaint:
          queueData?.chief_complaint || consultData?.complaints || null,
        examination_findings:
          queueData?.examination_findings ||
          consultData?.examination_findings ||
          null,
        investigation_findings: queueData?.investigation_findings || null,
        clinical_notes:
          queueData?.clinical_notes || consultData?.clinical_notes || null,
        history_of_present_illness:
          consultData?.history_of_present_illness || null,
        treatment_plan:
          consultData?.treatment_plan || consultData?.plan || null,
        complaints: consultData?.complaints || null,
      });
    } catch (err) {
      console.error('Error fetching clinical data:', err);
      setClinicalData(null);
    }
  };

  // Fetch investigation data (lab + radiology) for the encounter/patient
  const fetchInvestigationData = async (
    encounterId: string | null,
    patientId: string,
  ) => {
    try {
      // Fetch lab requests
      let labQuery = supabase
        .from('lab_requests')
        .select('request_id, status, result, result_notes, test_id')
        .order('created_at', { ascending: false });
      if (encounterId) {
        labQuery = labQuery.eq('encounter_id', encounterId);
      } else {
        labQuery = labQuery.eq('patient_id', patientId).limit(10);
      }
      const { data: labData } = await labQuery;

      // Fetch test names from catalogue for lab requests
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

      // Fetch imaging names from catalogue for radiology requests
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
        })),
        radiologyRequests: (radData || []).map((rr: any) => {
          const cat = imgMap[rr.imaging_id];
          return {
            imaging_type: cat?.modality || rr.imaging_type || 'Unknown',
            body_part: cat?.body_part || rr.body_part || null,
            status: rr.status || 'Pending',
            findings: rr.findings,
            impression: rr.impression,
          };
        }),
      });
    } catch (err) {
      console.error('Error fetching investigation data:', err);
      setInvestigationData({ labRequests: [], radiologyRequests: [] });
    }
  };

  // When modal opens, fetch patient bio + encounter_id + investigations
  useEffect(() => {
    if (!item.patient_id) return;
    setBioLoading(true);

    const loadData = async () => {
      // Fetch bio
      await fetchPatientBio(item.patient_id);

      // Fetch source_encounter_id from nhis_referral_queue
      let encounterId: string | null = item.source_encounter_id || null;
      if (!encounterId) {
        try {
          const { data } = await supabase
            .from('nhis_referral_queue')
            .select('source_encounter_id')
            .eq('id', item.queue_id)
            .single();
          encounterId = data?.source_encounter_id || null;
        } catch {}
      }

      // Fetch clinical findings + investigation data in parallel
      await Promise.all([
        fetchClinicalData(item.queue_id, encounterId),
        fetchInvestigationData(encounterId, item.patient_id),
      ]);
      setBioLoading(false);
    };

    loadData();
  }, [item.patient_id, item.queue_id]);

  const handleApprove = async () => {
    if (!formData.nhis_referral_code.trim()) {
      showToast({
        type: 'error',
        title: 'Missing Referral Code',
        message: 'NHIS Referral Code is required.',
      });
      return;
    }
    if (!formData.destination_facility_name.trim()) {
      showToast({
        type: 'error',
        title: 'Missing Destination',
        message: 'Destination Facility Name is required.',
      });
      return;
    }
    await onApprove({
      nhis_referral_code: formData.nhis_referral_code,
      destination_facility_name: formData.destination_facility_name,
      destination_facility_nhis_id:
        formData.destination_facility_nhis_id || undefined,
      destination_facility_address:
        formData.destination_facility_address || undefined,
      referral_valid_from: formData.referral_valid_from,
      referral_valid_to: formData.referral_valid_to,
      processing_notes: formData.processing_notes || undefined,
    });
  };

  const handleReject = async () => {
    if (!formData.rejection_reason.trim()) {
      showToast({
        type: 'error',
        title: 'Missing Rejection Reason',
        message: 'Please provide a reason for rejection.',
      });
      return;
    }
    await onReject(formData.rejection_reason);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-300"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <div
        className={`bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out ${
          isExpanded
            ? 'fixed inset-0 w-full h-full rounded-none'
            : 'w-full max-w-6xl h-[90vh] rounded-xl'
        }`}
      >
        {/* HEADER */}
        <div className="bg-primary-700 px-6 py-4 flex items-center justify-between shrink-0 shadow-md z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Shield className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                Process Referral Request
              </h2>
              <div className="flex items-center gap-2 text-green-100 text-xs mt-0.5">
                <span className="font-semibold">{item.patient_name}</span>
                <span className="opacity-60">•</span>
                <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">
                  {patientBio?.emr_number || item.file_number}
                </span>
                <span className="opacity-60">•</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    item.urgency?.toLowerCase() === 'emergency'
                      ? 'bg-red-500 text-white'
                      : item.urgency?.toLowerCase() === 'urgent'
                        ? 'bg-amber-400 text-amber-900'
                        : 'bg-white/20 text-white'
                  }`}
                >
                  {item.urgency || 'Routine'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title={isExpanded ? 'Collapse View' : 'Expand View'}
            >
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Two-Column Layout: Left = Read-only info, Right = Input form */}
        <div
          className={`flex-1 overflow-hidden flex ${isExpanded ? 'flex-row' : 'flex-col lg:flex-row'}`}
        >
          {/* LEFT PANEL — Patient & Clinical Data (scrollable) */}
          <div
            className={`overflow-y-auto border-r border-gray-100 bg-gray-50/30 ${isExpanded ? 'w-1/2' : 'w-full lg:w-[55%]'}`}
          >
            <div className="p-5 space-y-4">
              {/* Patient Bio-Data — Collapsible */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleSection('bio')}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 flex items-center gap-2 hover:from-gray-100 hover:to-gray-150 transition-colors"
                >
                  <User size={14} className="text-primary-700" />
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex-1 text-left">
                    Patient Bio-Data
                  </span>
                  {bioLoading && (
                    <RefreshCw
                      size={12}
                      className="text-gray-400 animate-spin"
                    />
                  )}
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 transition-transform ${collapsedSections.bio ? '-rotate-90' : ''}`}
                  />
                </button>
                {!collapsedSections.bio && (
                  <div className="p-4 grid grid-cols-3 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Full Name
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">
                        {item.patient_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        File No.
                      </p>
                      <p className="text-sm font-bold text-primary-700 mt-0.5 font-mono">
                        {patientBio?.emr_number || item.file_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Category
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">
                        {patientBio?.patient_category || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Age
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-0.5">
                        {patientBio?.date_of_birth
                          ? formatDetailedAge(patientBio.date_of_birth)
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Gender
                      </p>
                      <p className="text-sm text-gray-900 mt-0.5 capitalize">
                        {patientBio?.gender || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Date of Birth
                      </p>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {patientBio?.date_of_birth
                          ? new Date(
                              patientBio.date_of_birth,
                            ).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </p>
                    </div>
                    {patientBio?.rank && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Rank / Title
                        </p>
                        <p className="text-sm text-gray-900 mt-0.5">
                          {patientBio.rank}
                          {patientBio.title ? ` (${patientBio.title})` : ''}
                        </p>
                      </div>
                    )}
                    {patientBio?.service_number && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Service No.
                        </p>
                        <p className="text-sm text-gray-900 mt-0.5 font-mono">
                          {patientBio.service_number}
                        </p>
                      </div>
                    )}
                    {patientBio?.military_branch && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Service Branch
                        </p>
                        <p className="text-sm text-gray-900 mt-0.5 capitalize">
                          {patientBio.military_branch}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Contact Phone
                      </p>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {item.contact_phone || 'N/A'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Address
                      </p>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {patientBio?.residential_address || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* NHIS Details — Collapsible */}
              <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleSection('nhis')}
                  className="w-full px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 hover:bg-emerald-100/70 transition-colors"
                >
                  <Shield size={14} className="text-primary-700" />
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider flex-1 text-left">
                    NHIS Details
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-primary-700/40 transition-transform ${collapsedSections.nhis ? '-rotate-90' : ''}`}
                  />
                </button>
                {!collapsedSections.nhis && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          NHIS Number
                        </p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5 font-mono">
                          {item.nhis_number || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          HMO Scheme
                        </p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">
                          {item.hmo_scheme || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Referring Doctor
                        </p>
                        <p className="text-sm text-gray-900 mt-0.5">
                          {item.referring_doctor || 'Not specified'}
                        </p>
                      </div>
                    </div>
                    {/* Full Payer Details */}
                    <PayerDetailsCard
                      payerInfo={patientBio?.payer_info as PayerInfo | null}
                      nhisNumber={patientBio?.nhis_number || item.nhis_number}
                      insuranceType={patientBio?.insurance_type}
                      patientCategory={patientBio?.patient_category}
                      hmoScheme={item.hmo_scheme}
                      compact
                    />
                  </div>
                )}
              </div>

              {/* Clinical Details — Collapsible */}
              <div className="bg-white rounded-xl border border-primary-700/20 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleSection('clinical')}
                  className="w-full px-4 py-2.5 bg-primary-700/5 border-b border-primary-700/15 flex items-center gap-2 hover:bg-primary-700/10 transition-colors"
                >
                  <Stethoscope size={14} className="text-primary-700" />
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider flex-1 text-left">
                    Clinical Details
                  </span>
                  {bioLoading && (
                    <RefreshCw
                      size={12}
                      className="text-primary-700/40 animate-spin"
                    />
                  )}
                  <ChevronDown
                    size={14}
                    className={`text-primary-700/40 transition-transform ${collapsedSections.clinical ? '-rotate-90' : ''}`}
                  />
                </button>
                {!collapsedSections.clinical && (
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider">
                        Clinical Findings
                      </p>
                      <p className="mt-1 text-sm text-gray-800 bg-gray-50 rounded-lg p-2.5 border border-gray-200 whitespace-pre-wrap">
                        {clinicalFindingsDisplay || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider">
                        Provisional Diagnosis
                      </p>
                      <p className="mt-1 text-sm text-gray-800 bg-gray-50 rounded-lg p-2.5 border border-gray-200 whitespace-pre-wrap">
                        {provisionalDiagnosisDisplay || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary-700/60 uppercase tracking-wider">
                        Reason for Referral
                      </p>
                      <p className="mt-1 text-sm text-gray-800 bg-gray-50 rounded-lg p-2.5 border border-gray-200 whitespace-pre-wrap">
                        {reasonForReferralDisplay || 'Not specified'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Investigations — Collapsible */}
              <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleSection('investigations')}
                  className="w-full px-4 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-2 hover:bg-blue-100/70 transition-colors"
                >
                  <FlaskConical size={14} className="text-blue-700" />
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex-1 text-left">
                    Investigations Requested
                  </span>
                  {investigationData.labRequests.length +
                    investigationData.radiologyRequests.length >
                    0 && (
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {investigationData.labRequests.length +
                        investigationData.radiologyRequests.length}
                    </span>
                  )}
                  {bioLoading && (
                    <RefreshCw
                      size={12}
                      className="text-blue-400 animate-spin"
                    />
                  )}
                  <ChevronDown
                    size={14}
                    className={`text-blue-400 transition-transform ${collapsedSections.investigations ? '-rotate-90' : ''}`}
                  />
                </button>
                {!collapsedSections.investigations && (
                  <div className="p-4 space-y-4">
                    {investigationData.labRequests.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FlaskConical size={13} className="text-purple-600" />
                          <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                            Laboratory
                          </span>
                          <span className="text-xs font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                            {investigationData.labRequests.length}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {investigationData.labRequests.map((lr, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-purple-100 hover:bg-purple-50/50 transition-colors"
                            >
                              <span className="text-sm text-gray-800 font-medium">
                                {lr.test_name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                    lr.status?.toLowerCase() === 'completed'
                                      ? 'bg-green-100 text-green-700'
                                      : lr.status?.toLowerCase() ===
                                          'in_progress'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {lr.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {investigationData.radiologyRequests.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ScanLine size={13} className="text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                            Imaging / Radiology
                          </span>
                          <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
                            {investigationData.radiologyRequests.length}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {investigationData.radiologyRequests.map(
                            (rr, idx) => (
                              <div
                                key={idx}
                                className="bg-gray-50 rounded-lg px-3 py-2 border border-indigo-100 hover:bg-indigo-50/50 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-800 font-medium">
                                    {rr.imaging_type}
                                    {rr.body_part ? ` — ${rr.body_part}` : ''}
                                  </span>
                                  <span
                                    className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                                      rr.status?.toLowerCase() === 'completed'
                                        ? 'bg-green-100 text-green-700'
                                        : rr.status?.toLowerCase() ===
                                            'in_progress'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {rr.status}
                                  </span>
                                </div>
                                {rr.findings && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Findings: {rr.findings}
                                  </p>
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                    {investigationData.labRequests.length === 0 &&
                      investigationData.radiologyRequests.length === 0 &&
                      !bioLoading && (
                        <p className="text-sm text-gray-400 text-center py-3 italic">
                          No investigation requests found for this encounter
                        </p>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — NHIS Officer Input (scrollable) */}
          <div
            className={`overflow-y-auto bg-white ${isExpanded ? 'w-1/2' : 'w-full lg:w-[45%]'}`}
          >
            <div className="p-5 space-y-4">
              {!showReject ? (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-lg bg-primary-700/10 flex items-center justify-center">
                      <Shield size={16} className="text-primary-700" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">
                        NHIS Officer Input
                      </h4>
                      <p className="text-xs text-gray-400">
                        Fill in the required fields to process this referral
                      </p>
                    </div>
                  </div>

                  {/* NHIS Referral Code */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                      NHIS Referral Code <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.nhis_referral_code}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            nhis_referral_code: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="Enter official NHIS referral code"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-shadow"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      e.g., REF/2026/NDC/001234
                    </p>
                  </div>

                  {/* Destination Facility */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                      Destination Facility{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.destination_facility_name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            destination_facility_name: e.target.value,
                          }))
                        }
                        placeholder="Enter destination hospital name"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-shadow"
                      />
                    </div>
                  </div>

                  {/* Facility NHIS ID & Address */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Facility NHIS ID{' '}
                        <span className="text-gray-300 text-[9px]">
                          (Optional)
                        </span>
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={formData.destination_facility_nhis_id}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              destination_facility_nhis_id: e.target.value,
                            }))
                          }
                          placeholder="NHIS ID"
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-shadow"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Address{' '}
                        <span className="text-gray-300 text-[9px]">
                          (Optional)
                        </span>
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={formData.destination_facility_address}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              destination_facility_address: e.target.value,
                            }))
                          }
                          placeholder="Address"
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-shadow"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Validity Period */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Date Code Issued <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.referral_valid_from}
                        onChange={(e) => {
                          const from = e.target.value;
                          const expiry = new Date(from);
                          expiry.setDate(expiry.getDate() + 30);
                          setFormData((prev) => ({
                            ...prev,
                            referral_valid_from: from,
                            referral_valid_to: expiry
                              .toISOString()
                              .split('T')[0],
                          }));
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Code Expiry (30 Days)
                      </label>
                      <input
                        type="date"
                        value={formData.referral_valid_to}
                        readOnly
                        className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Auto: issue date + 30 days
                      </p>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                      Processing Notes{' '}
                      <span className="text-gray-300 text-[9px]">
                        (Optional)
                      </span>
                    </label>
                    <textarea
                      value={formData.processing_notes}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          processing_notes: e.target.value,
                        }))
                      }
                      placeholder="Any additional notes..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-shadow"
                    />
                  </div>

                  {/* Action Buttons — Sticky bottom */}
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setShowReject(true)}
                      disabled={isProcessing}
                      className="px-5 py-2.5 text-sm font-medium text-red-600 border border-red-300 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-all flex items-center gap-1.5"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-700 text-white rounded-xl hover:bg-primary-800 disabled:opacity-50 font-semibold text-sm shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />{' '}
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" /> Approve & Route to
                          Encounter
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Rejection Form */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-red-600 pb-2 border-b border-red-100">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                        <XCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">
                          Reject Referral Request
                        </h4>
                        <p className="text-xs text-red-400">
                          This will notify the referring doctor
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Reason for Rejection{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formData.rejection_reason}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            rejection_reason: e.target.value,
                          }))
                        }
                        placeholder="Explain why this referral request is being rejected..."
                        rows={4}
                        className="w-full px-4 py-3 bg-white border border-red-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowReject(false)}
                        disabled={isProcessing}
                        className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold text-sm shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />{' '}
                            Processing...
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" /> Confirm Rejection
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface NhisOutgoingReferralQueueProps {
  showHeader?: boolean;
}

export const NhisOutgoingReferralQueue: React.FC<
  NhisOutgoingReferralQueueProps
> = ({ showHeader = true }) => {
  const { user, staff } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<OutgoingReferralItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<OutgoingReferralItem | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOutgoingReferrals = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('nhis_pending_outgoing_referrals')
        .select('*');

      if (error) throw error;

      // Enrich with patient numbers from patients table
      const enriched = await Promise.all(
        (data || []).map(async (item: any) => {
          try {
            const { data: patData } = await supabase
              .from('patients')
              .select('emr_number')
              .eq('id', item.patient_id)
              .single();
            return { ...item, emr_number: patData?.emr_number || null };
          } catch {
            return { ...item, emr_number: null };
          }
        }),
      );

      setItems(enriched);
    } catch (err) {
      console.error('Error fetching outgoing referrals:', err);
      showToast({
        type: 'error',
        title: 'Load Failed',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to fetch outgoing referrals.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutgoingReferrals();
  }, []);

  const handleApprove = async (data: {
    nhis_referral_code: string;
    destination_facility_name: string;
    destination_facility_nhis_id?: string;
    destination_facility_address?: string;
    referral_valid_from: string;
    referral_valid_to: string;
    processing_notes?: string;
  }) => {
    if (!selectedItem) return;
    const selectedSnapshot = selectedItem;
    const previousItems = items;
    setIsProcessing(true);

    startTransition(() => {
      setSelectedItem(null);
      setItems((current) =>
        current.filter((item) => item.queue_id !== selectedSnapshot.queue_id),
      );
    });
    showToast({
      type: 'info',
      title: 'Processing',
      message: 'Outgoing referral approval is being processed.',
    });

    try {
      const { data: result, error } = await supabase.rpc(
        'approve_outgoing_referral',
        {
          p_queue_id: selectedItem.queue_id,
          p_nhis_referral_code: data.nhis_referral_code,
          p_destination_facility_name: data.destination_facility_name,
          p_destination_facility_nhis_id:
            data.destination_facility_nhis_id || null,
          p_destination_facility_address:
            data.destination_facility_address || null,
          p_referral_valid_from: data.referral_valid_from,
          p_referral_valid_to: data.referral_valid_to,
          p_processing_notes: data.processing_notes || null,
          p_processed_by: staff?.id || null,
        },
      );

      if (error) throw error;

      if (result?.success) {
        showToast({
          type: 'success',
          title: 'Approved',
          message:
            'Referral approved successfully. It will appear in Encounter for printing.',
        });
        void fetchOutgoingReferrals();
      } else {
        startTransition(() => {
          setSelectedItem(selectedSnapshot);
          setItems(previousItems);
        });
        showToast({
          type: 'error',
          title: 'Approval Failed',
          message: result?.error || 'Unknown error',
        });
      }
    } catch (err: any) {
      console.error('Error approving referral:', err);
      startTransition(() => {
        setSelectedItem(selectedSnapshot);
        setItems(previousItems);
      });
      showToast({
        type: 'error',
        title: 'Approval Failed',
        message: err.message || 'Failed to approve referral',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedItem) return;
    const selectedSnapshot = selectedItem;
    const previousItems = items;
    setIsProcessing(true);

    startTransition(() => {
      setSelectedItem(null);
      setItems((current) =>
        current.filter((item) => item.queue_id !== selectedSnapshot.queue_id),
      );
    });
    showToast({
      type: 'info',
      title: 'Processing',
      message: 'Outgoing referral rejection is being processed.',
    });

    try {
      const { error } = await supabase
        .from('nhis_referral_queue')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          processed_by: staff?.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedItem.queue_id);

      if (error) throw error;

      showToast({
        type: 'success',
        title: 'Rejected',
        message: 'Referral rejected successfully.',
      });
      void fetchOutgoingReferrals();
    } catch (err: any) {
      console.error('Error rejecting referral:', err);
      startTransition(() => {
        setSelectedItem(selectedSnapshot);
        setItems(previousItems);
      });
      showToast({
        type: 'error',
        title: 'Rejection Failed',
        message: err.message || 'Failed to reject referral',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      normalizeSearchValue(item.patient_name).includes(query) ||
      normalizeSearchValue(item.file_number).includes(query) ||
      normalizeSearchValue(item.emr_number).includes(query) ||
      normalizeSearchValue(item.nhis_number).includes(query)
    );
  });

  const getUrgencyColor = (urgency: string) => {
    switch (urgency?.toLowerCase()) {
      case 'emergency':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'urgent':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const urgentCount = items.filter(
    (i) =>
      i.urgency?.toLowerCase() === 'urgent' ||
      i.urgency?.toLowerCase() === 'emergency',
  ).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {showHeader && (
        <div className="bg-gradient-to-r from-primary-700 to-[#008545] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Outgoing NHIS Referrals
                  {items.length > 0 && (
                    <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  )}
                </h2>
                <p className="text-emerald-100 text-sm">
                  Process referral requests to external hospitals
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {urgentCount > 0 && (
                <span className="bg-red-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5" /> {urgentCount} Urgent
                </span>
              )}
              <button
                onClick={fetchOutgoingReferrals}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary-700 bg-white rounded-xl hover:bg-emerald-50 shadow-sm transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient name, file number, or NHIS number..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700 bg-white"
          />
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="py-12 text-center">
            <RefreshCw className="h-8 w-8 text-primary-700 animate-spin mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              Loading outgoing referrals...
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="h-8 w-8 text-primary-700/40" />
            </div>
            <p className="text-gray-600 font-semibold">
              No Pending Outgoing Referrals
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Outgoing referral requests from doctors will appear here
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.queue_id}
              className="group relative bg-white border border-gray-200 rounded-xl hover:border-primary-700/40 hover:shadow-md cursor-pointer transition-all overflow-hidden"
              onClick={() => startTransition(() => setSelectedItem(item))}
            >
              {/* Left accent stripe */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${
                  item.urgency?.toLowerCase() === 'emergency'
                    ? 'bg-red-500'
                    : item.urgency?.toLowerCase() === 'urgent'
                      ? 'bg-amber-500'
                      : 'bg-primary-700'
                }`}
              />

              <div className="pl-5 pr-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-emerald-50 p-2 rounded-full flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                      <User className="h-5 w-5 text-primary-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900">
                          {item.patient_name}
                        </p>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full border ${getUrgencyColor(item.urgency)}`}
                        >
                          {item.urgency || 'Routine'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                          {item.emr_number || item.file_number}
                        </span>
                        {item.nhis_number && (
                          <span className="font-mono bg-emerald-50 text-primary-700 px-1.5 py-0.5 rounded">
                            NHIS: {item.nhis_number}
                          </span>
                        )}
                      </div>
                      {item.provisional_diagnosis && (
                        <p className="text-xs text-gray-600 mt-1.5 line-clamp-1">
                          <span className="font-semibold text-gray-700">
                            Dx:
                          </span>{' '}
                          {formatClinicalTextForDisplay(
                            item.provisional_diagnosis,
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Referring Doctor
                      </p>
                      <p className="text-sm font-semibold text-gray-800">
                        {item.referring_doctor || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Requested
                      </p>
                      <p className="text-sm font-semibold text-gray-800">
                        {new Date(item.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="bg-primary-700/10 p-1.5 rounded-lg group-hover:bg-primary-700 transition-colors">
                      <ChevronRight className="h-4 w-4 text-primary-700 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Approval Modal */}
      {selectedItem && (
        <ApprovalModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};

export default NhisOutgoingReferralQueue;

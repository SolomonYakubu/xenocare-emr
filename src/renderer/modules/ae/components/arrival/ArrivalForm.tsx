// =============================================================================
// ArrivalForm — A&E Arrival Registration
// Streamlined Nigerian A&E standard: Chief complaint first, then details
// =============================================================================

import { isMilitaryFeatureEnabled } from '../../../../config/features';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  Ambulance,
  AlertTriangle,
  Shield,
  User,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Siren,
} from 'lucide-react';
import { arrivalFormSchema, type ArrivalFormDTO } from '../../dtos/ae.dto';
import { useCreateArrival, useCheckDuplicateAe } from '../../hooks/useAe';
import { useCreateEncounter } from '../../../../lib/workflow/hooks';
import type { AeArrival } from '../../api/ae.types';
import { supabase } from '../../../../api/supabaseClient';
import { SelectWithOther } from '../../../shared/components/SelectWithOther';
import SavedNotesPopover from '../../../../components/ui/SavedNotesPopover';
import { useToast } from '../../../../components/ui/Toast';

interface ArrivalFormProps {
  patientId?: string;
  patientName?: string;
  onSuccess?: (encounterId: string) => void;
}

// Look up the A&E clinic UUID dynamically by clinic_id code
function useAeClinicId() {
  return useQuery({
    queryKey: ['ae-clinic-uuid'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id')
        .eq('clinic_id', 'CLN-040')
        .maybeSingle();
      return data?.id as string | undefined;
    },
    staleTime: Infinity,
  });
}

const ARRIVAL_MODES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'ambulance', label: 'Ambulance' },
  { value: 'transfer', label: 'Transfer from Facility' },
  { value: 'police', label: 'Police Escort' },
  { value: 'military_escort', label: 'Military Escort' },
  { value: 'other', label: 'Other' },
];

const REFERRAL_SOURCES = [
  { value: 'self', label: 'Self / Walk-in' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'police', label: 'Police' },
  { value: 'military', label: 'Military' },
  { value: 'workplace', label: 'Workplace' },
  { value: 'other', label: 'Other' },
];

const INCIDENT_TYPES = [
  { value: 'rta', label: 'Road Traffic Accident (RTA)' },
  { value: 'assault', label: 'Assault' },
  { value: 'fall', label: 'Fall' },
  { value: 'burn', label: 'Burn' },
  { value: 'gunshot', label: 'Gunshot Wound' },
  { value: 'blast', label: 'Blast Injury' },
  { value: 'poisoning', label: 'Poisoning' },
  { value: 'drowning', label: 'Drowning / Near-drowning' },
  { value: 'medical', label: 'Medical Emergency' },
  { value: 'obstetric', label: 'Obstetric Emergency' },
  { value: 'pediatric', label: 'Pediatric Emergency' },
  { value: 'other', label: 'Other' },
];

export default function ArrivalForm({
  patientId,
  patientName,
  onSuccess,
}: ArrivalFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const { data: aeClinicUuid } = useAeClinicId();

  const createEncounterMutation = useCreateEncounter();
  const createArrivalMutation = useCreateArrival();
  const { data: hasDuplicate } = useCheckDuplicateAe(patientId);
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ArrivalFormDTO>({
    resolver: zodResolver(arrivalFormSchema),
    defaultValues: {
      patient_id: patientId || '',
      arrival_mode: 'walk_in',
      referral_source: 'self',
      chief_complaint: '',
      medico_legal_flag: false,
      priority: 'Urgent',
      payment_category: 'Cash',
    },
  });

  const watchMedicoLegal = watch('medico_legal_flag');

  const onSubmit = async (data: ArrivalFormDTO) => {
    if (!patientId) return;
    setSubmitting(true);
    try {
      // 1. Create encounter
      const encounter = await createEncounterMutation.mutateAsync({
        patient_id: patientId,
        visit_type: 'A&E' as any,
        payment_category: data.payment_category as any,
        priority: data.priority as any,
        chief_complaint: data.chief_complaint,
        clinic_id: aeClinicUuid || undefined,
      });

      // 2. Create arrival record
      await createArrivalMutation.mutateAsync({
        dto: { ...data, patient_id: patientId },
        encounterId: encounter.id,
      });

      onSuccess?.(encounter.id);
      showToast({ message: 'Arrival registered', type: 'success' });
    } catch (err) {
      console.error('[A&E] Arrival registration failed:', err);
      showToast({ message: 'Failed to register arrival', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const [showIncident, setShowIncident] = useState(false);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-200"
    >
      {/* Duplicate Warning */}
      {hasDuplicate && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <p className="text-sm text-yellow-800 font-medium">
              This patient already has an active A&E encounter.
            </p>
          </div>
        </div>
      )}

      {/* ── Section 1: Chief Complaint (FIRST — most critical) ──────────── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-semibold text-gray-800">
            <Siren className="inline h-4 w-4 mr-1 text-red-500" />
            Chief Complaint <span className="text-red-500">*</span>
          </label>
          <SavedNotesPopover
            category="ae_notes"
            subcategory="chief_complaint"
            currentValue={watch('chief_complaint') || ''}
            onInsert={(content) => setValue('chief_complaint', content)}
          />
        </div>
        <textarea
          {...register('chief_complaint')}
          rows={2}
          placeholder="What is the patient presenting with? e.g. 'RTA victim, bleeding from head laceration, conscious'"
          className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-red-500 focus:border-red-500"
          autoFocus
        />
        {errors.chief_complaint && (
          <p className="text-red-600 text-xs mt-1">
            {errors.chief_complaint.message}
          </p>
        )}
      </div>

      {/* ── Section 2: Arrival & Priority ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Ambulance className="inline h-4 w-4 mr-1" />
            Mode of Arrival <span className="text-red-500">*</span>
          </label>
          <SelectWithOther
            fieldId="ae:arrival_mode"
            value={watch('arrival_mode') || ''}
            onChange={(v) => setValue('arrival_mode', v as any)}
            options={ARRIVAL_MODES.filter(
              (mode) =>
                isMilitaryFeatureEnabled() || mode.value !== 'military_escort',
            )}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-red-500 focus:border-red-500 bg-white"
          />
          {errors.arrival_mode && (
            <p className="text-red-600 text-xs mt-1">
              {errors.arrival_mode.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Referral Source
          </label>
          <SelectWithOther
            fieldId="ae:referral_source"
            value={watch('referral_source') || ''}
            onChange={(v) => setValue('referral_source', v as any)}
            options={REFERRAL_SOURCES.filter(
              (source) =>
                isMilitaryFeatureEnabled() || source.value !== 'military',
            )}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-red-500 focus:border-red-500 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-1">
            {[
              { value: 'Emergency', label: 'Emergency', color: 'red' },
              { value: 'Urgent', label: 'Urgent', color: 'yellow' },
              { value: 'Normal', label: 'Normal', color: 'green' },
            ].map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setValue('priority', p.value as any)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold border-2 transition-colors ${
                  watch('priority') === p.value
                    ? p.color === 'red'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : p.color === 'yellow'
                        ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                        : 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment
          </label>
          <SelectWithOther
            fieldId="ae:payment_category"
            value={watch('payment_category') || 'Cash'}
            onChange={(v) => setValue('payment_category', v as any)}
            options={[
              { value: 'Cash', label: 'Cash' },
              { value: 'POS', label: 'POS/Card' },
              { value: 'NHIS', label: 'NHIS' },
              { value: 'Retainership', label: 'Retainership' },
            ]}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-red-500 focus:border-red-500 bg-white"
          />
        </div>
      </div>

      {/* ── Section 3: Incident Details (collapsible) ──────────────────── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowIncident(!showIncident)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Incident Details (Trauma / RTA / Assault)</span>
          {showIncident ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {showIncident && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Incident Type
                </label>
                <SelectWithOther
                  fieldId="ae:incident_type"
                  value={watch('incident_type') || ''}
                  onChange={(v) => setValue('incident_type', v as any)}
                  options={INCIDENT_TYPES}
                  placeholder="— Select —"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Incident Time
                </label>
                <input
                  type="datetime-local"
                  {...register('incident_time')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Incident Location
                </label>
                <input
                  type="text"
                  {...register('incident_location')}
                  placeholder="Where did the incident occur?"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Medico-Legal & Brought By (side by side) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Medico-Legal */}
        <div className="border border-orange-200 rounded-lg p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('medico_legal_flag')}
              className="rounded text-red-600"
            />
            <Shield className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">
              Medico-Legal Case
            </span>
          </label>
          {watchMedicoLegal && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm text-gray-600">
                  Medico-Legal Notes
                </label>
                <SavedNotesPopover
                  category="ae_notes"
                  subcategory="medico_legal_notes"
                  currentValue={watch('medico_legal_notes') || ''}
                  onInsert={(content) => setValue('medico_legal_notes', content)}
                />
              </div>
              <textarea
                {...register('medico_legal_notes')}
                rows={2}
                placeholder="Police report number, circumstances..."
                className="w-full border border-orange-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

        {/* Brought By */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <User className="h-4 w-4" />
            Brought By / Informant
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              {...register('brought_by_name')}
              placeholder="Name"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="tel"
              {...register('brought_by_phone')}
              placeholder="Phone"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              {...register('brought_by_relationship')}
              placeholder="Relationship"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={submitting || !patientId}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {submitting ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Registering...
            </>
          ) : (
            <>
              <Siren className="h-4 w-4" />
              Register A&E Arrival
            </>
          )}
        </button>
      </div>
    </form>
  );
}
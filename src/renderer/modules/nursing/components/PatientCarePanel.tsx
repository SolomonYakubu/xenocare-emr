import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Heart,
  Activity,
  ClipboardList,
  TrendingUp,
  ArrowRightLeft,
  FileText,
  Stethoscope,
  User,
  Calendar,
  Phone,
  AlertTriangle,
  ChevronRight,
  Lock,
  Maximize2,
  Minimize2,
  Thermometer,
  Scale,
  Ruler,
  Droplets,
  Baby,
  Clock,
  Loader2,
  LayoutDashboard,
  ShieldAlert,
  Fingerprint,
  Users,
  History,
} from 'lucide-react';
import {
  formatDetailedAge,
  PatientDTO,
} from '../../patient-registration/dtos/patient.dto';
import { Button, Card, StatusBadge } from '../../../components/ui';
import NursingCareForm from './NursingCareForm';
import TreatmentPlanTab from './TreatmentPlanTab';
import NursingNotesTab from './NursingNotesTab';
import DoctorNotesPanel from './DoctorNotesPanel';
import ShiftHandoverTab from './ShiftHandoverTab';
import EncounterSelector from './EncounterSelector';
import ReadOnlyBanner from './ReadOnlyBanner';
import { useNursingEncounter } from '../hooks/useNursingEncounter';
import {
  NursingCareDTO,
  CreateNursingCareDTO,
  Vitals,
  TimelineEvent,
} from '../dtos/nursing.dto';
import { getVitals, getClinicalTimeline } from '../api/nursing.api';
import { AncNursingEncounterAdapter } from '../../anc/components/adapters/AncNursingEncounterAdapter';
import { supabase } from '../../../api/supabaseClient';
import { UniversalOrderButton } from '../../../components/orders/UniversalOrderButton';

// Tab definition type
type PatientTab =
  | 'overview'
  | 'vitals'
  | 'notes'
  | 'interventions'
  | 'handover'
  | 'antenatal';

interface PatientCarePanelProps {
  patient: PatientDTO | null;
  encounterId: string | null;
  visitId: string | null;
  queueId: string | null;
  priority?: string;
  onClose: () => void;
  onVitalsSaved?: () => void;
  isCreatingRecord?: boolean;
  onCreateRecord: (data: CreateNursingCareDTO) => void;
  onUpdateRecord?: (data: CreateNursingCareDTO) => void;
  editingRecord?: NursingCareDTO | null;
}

// Helper to format date/time
function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Vitals Tab Content Component
function VitalsTabContent({
  encounterId,
  patientId,
  isWritable,
  isVitalsFormOpen,
  setIsVitalsFormOpen,
  handleVitalsSubmit,
  isCreatingRecord,
  patient,
  visitId,
  queueId,
  editingRecord,
  vitalsRecords,
  vitalsLoading,
}: {
  encounterId: string | null | undefined;
  patientId: string | undefined;
  isWritable: boolean;
  isVitalsFormOpen: boolean;
  setIsVitalsFormOpen: (open: boolean) => void;
  handleVitalsSubmit: (data: CreateNursingCareDTO) => Promise<void>;
  isCreatingRecord: boolean;
  patient: PatientDTO;
  visitId: string | null;
  queueId: string | null;
  editingRecord?: NursingCareDTO | null;
  vitalsRecords: Vitals[] | undefined;
  vitalsLoading: boolean;
}) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header with Record Button */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-serif font-bold text-slate-800">
            Vital Signs & Measurements
          </h3>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">
            {vitalsRecords?.length || 0} Clinical Observations recorded
          </p>
        </div>
        <Button
          variant="primary"
          icon={isWritable ? Heart : Lock}
          onClick={() => setIsVitalsFormOpen(true)}
          disabled={!isWritable}
          className="rounded-xl shadow-lg shadow-emerald-100"
          title={
            !isWritable
              ? 'Cannot record vitals for closed encounters'
              : undefined
          }
        >
          {isWritable ? 'Record New Vitals' : 'View Only Mode'}
        </Button>
      </div>

      {/* Vitals Records */}
      {vitalsLoading ? (
        <Card>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-700" />
          </div>
        </Card>
      ) : vitalsRecords && vitalsRecords.length > 0 ? (
        <div className="space-y-4">
          {vitalsRecords.map((vitals, idx) => (
            <Card key={vitals.vitals_id || idx}>
              <div className="space-y-4">
                {/* Vitals Header */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-lg ${vitals.is_critical ? 'bg-red-100' : 'bg-green-100'}`}
                    >
                      <Heart
                        className={`h-5 w-5 ${vitals.is_critical ? 'text-red-600' : 'text-green-600'}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Vitals Record #{vitalsRecords.length - idx}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDateTime(vitals.date_recorded)}
                      </p>
                    </div>
                  </div>
                  {vitals.is_critical && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Critical
                    </span>
                  )}
                </div>

                {/* Vitals Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {vitals.blood_pressure_systolic &&
                    vitals.blood_pressure_diastolic && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <Heart size={12} />
                          Blood Pressure
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          {vitals.blood_pressure_systolic}/
                          {vitals.blood_pressure_diastolic}
                          <span className="text-sm text-gray-500 ml-1">
                            mmHg
                          </span>
                        </p>
                      </div>
                    )}
                  {vitals.pulse && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Activity size={12} />
                        Pulse Rate
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.pulse}
                        <span className="text-sm text-gray-500 ml-1">bpm</span>
                      </p>
                    </div>
                  )}
                  {vitals.temperature && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Thermometer size={12} />
                        Temperature
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.temperature}
                        <span className="text-sm text-gray-500 ml-1">°C</span>
                      </p>
                    </div>
                  )}
                  {vitals.respiratory_rate && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Activity size={12} />
                        Respiratory Rate
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.respiratory_rate}
                        <span className="text-sm text-gray-500 ml-1">/min</span>
                      </p>
                    </div>
                  )}
                  {vitals.oxygen_saturation && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Activity size={12} />
                        SpO2
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.oxygen_saturation}
                        <span className="text-sm text-gray-500 ml-1">%</span>
                      </p>
                    </div>
                  )}
                  {vitals.weight && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Scale size={12} />
                        Weight
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.weight}
                        <span className="text-sm text-gray-500 ml-1">kg</span>
                      </p>
                    </div>
                  )}
                  {vitals.height && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Ruler size={12} />
                        Height
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.height}
                        <span className="text-sm text-gray-500 ml-1">cm</span>
                      </p>
                    </div>
                  )}
                  {vitals.bmi && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Scale size={12} />
                        BMI
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.bmi}
                        <span className="text-sm text-gray-500 ml-1">
                          kg/m²
                        </span>
                      </p>
                    </div>
                  )}
                  {vitals.blood_glucose && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Droplets size={12} />
                        Blood Glucose
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {vitals.blood_glucose}
                        <span className="text-sm text-gray-500 ml-1">
                          mg/dL
                        </span>
                      </p>
                    </div>
                  )}
                  {vitals.pain_level !== null &&
                    vitals.pain_level !== undefined && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <AlertTriangle size={12} />
                          Pain Level
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          {vitals.pain_level}
                          <span className="text-sm text-gray-500 ml-1">
                            /10
                          </span>
                        </p>
                      </div>
                    )}
                </div>

                {/* Notes if available */}
                {vitals.notes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800">Notes:</p>
                    <p className="text-sm text-amber-700">{vitals.notes}</p>
                  </div>
                )}

                {/* Recorded by */}
                {vitals.nurse && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-200">
                    <User size={12} />
                    <span>
                      Recorded by: {vitals.nurse.first_name}{' '}
                      {vitals.nurse.last_name}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No Vital Signs Recorded</p>
            <p className="text-sm mt-1">
              {isWritable
                ? 'Click "Record Vitals" to capture vital signs for this encounter'
                : 'No vital signs have been recorded for this encounter'}
            </p>
          </div>
        </Card>
      )}

      {/* Vitals Form Modal - Only available for writable encounters */}
      {isWritable && (
        <NursingCareForm
          isOpen={isVitalsFormOpen}
          onClose={() => setIsVitalsFormOpen(false)}
          onSubmit={handleVitalsSubmit}
          isLoading={isCreatingRecord}
          preselectedPatient={patient}
          visitId={visitId}
          queueId={queueId}
          encounterId={encounterId}
          editingRecord={editingRecord}
        />
      )}
    </div>
  );
}

// Overview Tab Content Component
function OverviewTabContent({
  patient,
  currentEncounter,
  latestVitals,
  timeline = [],
  timelineLoading = false,
}: {
  patient: PatientDTO;
  currentEncounter: any;
  latestVitals: any | null;
  timeline?: TimelineEvent[];
  timelineLoading?: boolean;
}) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Vitals Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Heart size={20} className="text-red-600" />
              </div>
              <h4 className="font-bold text-gray-900">Latest Vitals</h4>
            </div>
            {latestVitals && (
              <span
                className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  latestVitals.is_critical
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {latestVitals.is_critical ? 'Review Required' : 'Stable'}
              </span>
            )}
          </div>

          {latestVitals ? (
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block">
                  Blood Pressure
                </span>
                <span className="font-mono text-lg font-bold text-gray-800">
                  {latestVitals.blood_pressure_systolic}/
                  {latestVitals.blood_pressure_diastolic}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block">
                  Pulse Rate
                </span>
                <span className="font-mono text-lg font-bold text-gray-800">
                  {latestVitals.pulse}{' '}
                  <small className="text-xs font-sans text-gray-400 uppercase tracking-normal">
                    bpm
                  </small>
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block">
                  Temperature
                </span>
                <span className="font-mono text-lg font-bold text-gray-800">
                  {latestVitals.temperature}°C
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block">
                  SpO2
                </span>
                <span className="font-mono text-lg font-bold text-gray-800">
                  {latestVitals.oxygen_saturation}%
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-gray-50 flex items-center gap-2">
                <Clock size={12} className="text-gray-400" />
                <span className="text-xs text-gray-400 italic">
                  Last taken: {formatDateTime(latestVitals.date_recorded)}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="text-xs text-gray-400">No vitals recorded yet</p>
            </div>
          )}
        </div>

        {/* Encounter Context Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Activity size={20} className="text-blue-600" />
            </div>
            <h4 className="font-bold text-gray-900">Encounter Info</h4>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group">
              <Fingerprint className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              <div>
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block leading-none mb-1">
                  Encounter ID
                </span>
                <span className="font-mono text-sm font-semibold text-gray-700">
                  {currentEncounter?.encounter_number ||
                    `#${currentEncounter?.id?.slice(0, 8)}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group">
              <Calendar className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              <div>
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest block leading-none mb-1">
                  Visit Type
                </span>
                <span className="text-sm font-bold text-gray-700 uppercase tracking-tight">
                  {currentEncounter?.visit_type || 'General OPD'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Alerts Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-50 rounded-lg">
              <ShieldAlert size={20} className="text-amber-600" />
            </div>
            <h4 className="font-bold text-gray-900">Patient Alerts</h4>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-600" />
                <span className="text-xs uppercase font-bold text-red-600 tracking-widest">
                  Allergies
                </span>
              </div>
              <p className="text-sm font-bold text-red-900">
                {patient.known_allergies?.length
                  ? patient.known_allergies.join(', ')
                  : (patient as { no_known_allergies?: boolean })
                        .no_known_allergies
                    ? 'No Known Allergies'
                    : 'Allergy status not recorded'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-gray-400" />
                <span className="text-xs uppercase font-bold text-gray-400 tracking-widest">
                  Next of Kin
                </span>
              </div>
              <p className="text-xs text-gray-700 font-medium">
                {patient.nok_name || 'Not provided'} •{' '}
                {patient.nok_phone || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Section - Full Width Clinical Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex items-center justify-between">
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <History size={18} className="text-blue-600" />
            Recent Clinical Timeline
          </h4>
          <button className="text-xs font-bold text-blue-600 uppercase tracking-widest hover:underline">
            View Full Timeline
          </button>
        </div>
        <div className="p-6">
          {timelineLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Loader2 size={32} className="animate-spin mb-3 text-blue-500" />
              <p className="text-xs font-semibold uppercase tracking-widest animate-pulse">
                Loading Timeline...
              </p>
            </div>
          ) : timeline.length > 0 ? (
            <div className="relative pl-4 sm:pl-0 space-y-6">
              {/* Vertical Line */}
              <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-slate-200 ml-1.5 sm:ml-[108px] hidden sm:block" />

              {timeline.map((event, idx) => (
                <div
                  key={event.id || idx}
                  className="relative flex flex-col sm:flex-row gap-4 items-start group"
                >
                  {/* Time */}
                  <div className="sm:w-[100px] sm:text-right pt-0.5 shrink-0 z-10 ml-8 sm:ml-0">
                    <span className="text-xs font-bold text-slate-700 block">
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-xs text-slate-400 font-medium uppercase">
                      {new Date(event.timestamp).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Dot */}
                  <div
                    className={`
                    absolute left-0 sm:static sm:ml-0 top-1 sm:top-0
                    w-4 h-4 rounded-full border-2 border-white ring-2 z-10 shrink-0 mt-0.5
                    ${
                      event.category === 'consultation'
                        ? 'bg-blue-500 ring-blue-100'
                        : event.category === 'ward_round'
                          ? 'bg-indigo-500 ring-indigo-100'
                          : event.category === 'nursing_note'
                            ? 'bg-emerald-500 ring-emerald-100'
                            : event.category === 'vital'
                              ? 'bg-red-500 ring-red-100'
                              : event.category === 'nutrition_plan'
                                ? 'bg-lime-500 ring-lime-100'
                                : event.category === 'nutrition_session'
                                  ? 'bg-teal-500 ring-teal-100'
                                  : event.category === 'nutrition_order'
                                    ? 'bg-fuchsia-500 ring-fuchsia-100'
                                    : event.category === 'lab'
                                      ? 'bg-purple-500 ring-purple-100'
                                      : event.category === 'pharmacy'
                                        ? 'bg-amber-500 ring-amber-100'
                                        : event.category === 'radiology'
                                          ? 'bg-cyan-500 ring-cyan-100'
                                          : event.category === 'procedure'
                                            ? 'bg-rose-500 ring-rose-100'
                                            : event.category === 'medication'
                                              ? 'bg-orange-500 ring-orange-100'
                                              : 'bg-slate-500 ring-slate-100'
                    }
                  `}
                  />

                  {/* Content Card */}
                  <div className="flex-1 w-full bg-slate-50 rounded-lg p-3 border border-slate-100 group-hover:border-slate-300 group-hover:bg-blue-50/30 transition-all">
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className={`text-xs uppercase font-black tracking-wider px-1.5 py-0.5 rounded
                        ${
                          event.category === 'consultation'
                            ? 'bg-blue-100 text-blue-700'
                            : event.category === 'ward_round'
                              ? 'bg-indigo-100 text-indigo-700'
                              : event.category === 'nursing_note'
                                ? 'bg-emerald-100 text-emerald-700'
                                : event.category === 'vital'
                                  ? 'bg-red-100 text-red-700'
                                  : event.category === 'nutrition_plan'
                                    ? 'bg-lime-100 text-lime-700'
                                    : event.category === 'nutrition_session'
                                      ? 'bg-teal-100 text-teal-700'
                                      : event.category === 'nutrition_order'
                                        ? 'bg-fuchsia-100 text-fuchsia-700'
                                        : event.category === 'lab'
                                          ? 'bg-purple-100 text-purple-700'
                                          : event.category === 'pharmacy'
                                            ? 'bg-amber-100 text-amber-700'
                                            : event.category === 'radiology'
                                              ? 'bg-cyan-100 text-cyan-700'
                                              : event.category === 'procedure'
                                                ? 'bg-rose-100 text-rose-700'
                                                : event.category ===
                                                    'medication'
                                                  ? 'bg-orange-100 text-orange-700'
                                                  : 'bg-slate-100 text-slate-700'
                        }
                      `}
                      >
                        {event.title}
                      </span>
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <User size={10} />
                        {event.author}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <History size={48} className="mb-4 opacity-20" />
              <p className="text-sm">No clinical activity recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientCarePanel({
  patient,
  encounterId,
  visitId,
  queueId,
  priority = 'Normal',
  onClose,
  onVitalsSaved,
  isCreatingRecord = false,
  onCreateRecord,
  onUpdateRecord,
  editingRecord,
}: PatientCarePanelProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PatientTab>('overview');
  const [isVitalsFormOpen, setIsVitalsFormOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Use nursing encounter hook for encounter state management
  const {
    currentEncounter,
    patientEncounters,
    activeEncounter,
    isWritable,
    isHistorical,
    selectEncounter,
    selectActiveEncounter,
    isLoading: encounterLoading,
  } = useNursingEncounter({
    patientId: patient?.id || '',
    encounterId,
    autoSelectActive: true,
  });

  if (!patient) return null;

  const patientName = `${patient.first_name} ${patient.surname || ''}`.trim();
  // Always use patient.id (UUID) for database queries - patient.patient_id is VARCHAR (patient number)
  const patientUuid = patient.id;
  // Keep patient_id for display purposes if needed
  const patientDisplayId = patient.patient_id || patient.id;

  // Use the selected encounter ID from the hook
  const selectedEncounterId = currentEncounter?.id || encounterId;

  // Dynamically build tabs
  const patientTabs: {
    id: PatientTab;
    label: string;
    icon: React.ElementType;
    color: string;
    description: string;
  }[] = [
    {
      id: 'overview',
      label: 'Summary',
      icon: LayoutDashboard,
      color: 'blue',
      description: 'At a glance',
    },
    {
      id: 'vitals',
      label: 'Care & Vitals',
      icon: Heart,
      color: 'red',
      description: 'Measurements',
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: FileText,
      color: 'amber',
      description: 'Documentation',
    },
    {
      id: 'interventions',
      label: 'Interventions',
      icon: ClipboardList,
      color: 'emerald',
      description: 'Orders & Plans',
    },
    {
      id: 'handover',
      label: 'Handover',
      icon: ArrowRightLeft,
      color: 'purple',
      description: 'Shift Change',
    },
  ];

  const isAntenatalEncounter =
    currentEncounter?.visit_type === 'Antenatal' ||
    String(currentEncounter?.chief_complaint || '')
      .toLowerCase()
      .includes('antenatal') ||
    String((currentEncounter as any)?.clinic?.clinic_name || '')
      .toLowerCase()
      .includes('antenatal') ||
    String((currentEncounter as any)?.department_name || '')
      .toLowerCase()
      .includes('gynaec');

  if (isAntenatalEncounter) {
    patientTabs.splice(1, 0, {
      id: 'antenatal',
      label: 'Antenatal Care',
      icon: Baby,
      color: 'teal',
      description: 'Obstetric Assessment',
    });
  }

  // Fetch vitals for this encounter (Moved up for Overview visibility)
  const { data: vitalsRecords, isLoading: vitalsLoading } = useQuery({
    queryKey: ['encounter-vitals-global', selectedEncounterId],
    queryFn: () =>
      getVitals({ encounter_id: selectedEncounterId || undefined }),
    enabled: !!selectedEncounterId,
  });

  // Fetch clinical timeline
  const { data: timelineEvents, isLoading: timelineLoading } = useQuery({
    queryKey: ['clinical-timeline', selectedEncounterId],
    queryFn: () => getClinicalTimeline(selectedEncounterId || ''),
    enabled: !!selectedEncounterId,
  });

  useEffect(() => {
    if (!selectedEncounterId) return;

    const invalidateTimeline = () => {
      queryClient.invalidateQueries({
        queryKey: ['clinical-timeline', selectedEncounterId],
      });
    };

    const timelineRealtimeChannel = supabase
      .channel(`nursing-care-timeline-${selectedEncounterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'specialty_careplans',
          filter: `encounter_id=eq.${selectedEncounterId}`,
        },
        invalidateTimeline,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'careplan_sessions',
        },
        invalidateTimeline,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lab_requests',
          filter: `encounter_id=eq.${selectedEncounterId}`,
        },
        invalidateTimeline,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(timelineRealtimeChannel);
    };
  }, [queryClient, selectedEncounterId]);

  const handleVitalsSubmit = async (data: CreateNursingCareDTO) => {
    onCreateRecord(data);
    setIsVitalsFormOpen(false);
    onVitalsSaved?.();
  };

  const getPriorityBadgeClass = () => {
    switch (priority) {
      case 'Emergency':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'Urgent':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel - Centered Modal */}
      <div
        className={`relative w-full bg-slate-50 shadow-2xl flex overflow-hidden rounded-xl animate-fade-in-scale transition-all duration-300 ${
          isExpanded ? 'max-w-[98vw] h-[95vh]' : 'max-w-6xl h-[85vh]'
        }`}
      >
        {/* SIDE NAVIGATION */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          {/* Brand/Role Indicator */}
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
              <Activity size={20} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none uppercase">
                Nursing Care
              </h1>
              <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mt-1">
                Portal v2.0
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1">
            {patientTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    size={18}
                    className={
                      isActive
                        ? 'text-emerald-400'
                        : 'text-slate-400 group-hover:text-slate-900'
                    }
                  />
                  <div className="text-left">
                    <p className="text-sm font-bold leading-none">
                      {tab.label}
                    </p>
                    <p
                      className={`text-xs mt-1 font-medium ${isActive ? 'text-slate-400' : 'text-slate-400'}`}
                    >
                      {tab.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-100">
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              <X size={14} />
              Close Portal
            </button>
          </div>
        </div>

        {/* MAIN BODY */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
          {/* HEADER - Classy Document Style */}
          <header className="bg-white px-8 py-5 border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center font-serif text-2xl font-bold text-slate-400 border border-slate-200 shadow-inner">
                  {patient.first_name?.charAt(0)}
                  {patient.surname?.charAt(0)}
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-lg ${getPriorityBadgeClass()} border-2 border-white flex items-center justify-center shadow-sm`}
                >
                  <Activity size={12} />
                </div>
              </div>

              {/* Bio Info */}
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
                    {patientName}
                  </h2>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-mono rounded border border-slate-200">
                    EMR: {patient.emr_number || patientDisplayId?.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <User size={12} className="text-slate-400" />
                    <span>{patient.gender || 'Not specified'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-200 mx-1" />
                    <Calendar size={12} className="text-slate-400" />
                    <span>{formatDetailedAge(patient.date_of_birth)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Toolbar */}
            <div className="flex items-center gap-3">
              <div className="mr-6 px-6 border-r border-slate-100 hidden md:block">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">
                  Category
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                    {patient.patient_category || 'Private'}
                  </span>
                </div>
              </div>

              {/* Unified Order Button */}
              {encounterId && (
                <UniversalOrderButton
                  encounterId={encounterId}
                  patientId={patient.emr_number || patientDisplayId || ''}
                  patientName={patientName}
                  patientEmrNumber={patient.emr_number || undefined}
                  encounterType="OPD"
                />
              )}

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all"
                title={isExpanded ? 'Restore' : 'Fullscreen'}
              >
                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>

              <Button
                variant="primary"
                icon={ChevronRight}
                onClick={() =>
                  navigate(
                    `/medical-records/${patient?.patient_id || patientUuid}`,
                  )
                }
                className="h-11 px-6 rounded-xl shadow-lg shadow-emerald-100 ml-2"
              >
                Full Medical Records
              </Button>
            </div>
          </header>

          {/* MAIN SCROLLABLE CONTENT */}
          <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-7xl mx-auto">
              {/* Encounter & Status Bar */}
              <div className="grid grid-cols-12 gap-6 mb-8">
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-1">
                    <EncounterSelector
                      encounters={patientEncounters}
                      currentEncounterId={selectedEncounterId || null}
                      activeEncounterId={activeEncounter?.id || null}
                      onEncounterChange={selectEncounter}
                      isLoading={encounterLoading}
                    />
                  </div>

                  {!isWritable && currentEncounter && (
                    <ReadOnlyBanner
                      encounterStatus={currentEncounter.status}
                      encounterDate={currentEncounter.created_at}
                      onSwitchToActive={selectActiveEncounter}
                      hasActiveEncounter={!!activeEncounter}
                      variant="full"
                    />
                  )}
                </div>

                <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-center shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Clinical Protocol
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 italic">
                      Auto-sync active
                    </span>
                    <StatusBadge
                      variant={isWritable ? 'success' : 'warning'}
                      status={
                        isWritable ? 'Writable Access' : 'Read-Only Access'
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Content */}
              <div className="space-y-8">
                {activeTab === 'overview' && (
                  <OverviewTabContent
                    patient={patient}
                    currentEncounter={currentEncounter}
                    latestVitals={vitalsRecords?.[0] || null}
                    timeline={timelineEvents}
                    timelineLoading={timelineLoading}
                  />
                )}

                {activeTab === 'antenatal' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h3 className="text-xl font-serif font-bold text-slate-800 mb-6">
                      Antenatal Care Assessment
                    </h3>
                    <AncNursingEncounterAdapter
                      encounterId={selectedEncounterId || encounterId || ''}
                    />
                  </div>
                )}

                {activeTab === 'vitals' && (
                  <VitalsTabContent
                    encounterId={selectedEncounterId || encounterId}
                    patientId={patientUuid}
                    isWritable={isWritable}
                    isVitalsFormOpen={isVitalsFormOpen}
                    setIsVitalsFormOpen={setIsVitalsFormOpen}
                    handleVitalsSubmit={handleVitalsSubmit}
                    isCreatingRecord={isCreatingRecord}
                    patient={patient}
                    visitId={visitId}
                    queueId={queueId}
                    editingRecord={editingRecord}
                    vitalsRecords={vitalsRecords}
                    vitalsLoading={vitalsLoading}
                  />
                )}

                {activeTab === 'notes' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Doctor's Consultation - Full Width */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Stethoscope size={18} className="text-blue-500" />
                          <h3 className="text-lg font-serif font-bold text-slate-800">
                            Doctor's Consultation Notes
                          </h3>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded tracking-tighter">
                          PHYSICIAN NOTES
                        </span>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 overflow-y-auto min-h-[400px] p-6">
                        <DoctorNotesPanel
                          encounterId={selectedEncounterId || ''}
                          patientId={patientUuid || ''}
                          patientName={patientName}
                        />
                      </div>
                    </div>

                    {/* Additional Nursing Notes Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={18} className="text-emerald-500" />
                          <h3 className="text-lg font-serif font-bold text-slate-800">
                            All Nursing Documentation
                          </h3>
                        </div>
                        <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-1 rounded tracking-tighter">
                          FULL CARE LOG
                        </span>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 overflow-y-auto min-h-[300px] p-6">
                        <NursingNotesTab
                          encounterId={selectedEncounterId || undefined}
                          patientId={patientUuid || undefined}
                          patientName={patientName}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'interventions' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <TreatmentPlanTab
                      encounterId={selectedEncounterId || undefined}
                      patientId={patientUuid || undefined}
                    />
                  </div>
                )}

                {activeTab === 'handover' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <ShiftHandoverTab
                      encounterId={selectedEncounterId || ''}
                      patientId={patientUuid || ''}
                      patientName={patientName}
                    />
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* New Simplified Footer */}
          <footer className="bg-white border-t border-slate-200 px-8 py-3 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Secure Session</span>
              </div>
              <span>Terminal: {patient.emr_number || 'EMR-SYSTEM'}</span>
            </div>
            <div>{/* Footer text removed */}</div>
          </footer>
        </div>
      </div>
    </div>
  );
}

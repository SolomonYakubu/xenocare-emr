/**
 * Shift Handover Component
 *
 * For nursing continuity across shifts.
 * ALL handover records are tied to the patient's encounter.
 *
 * CRITICAL: No handover can exist without an encounter_id
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  Plus,
  Edit,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Pill,
  Activity,
  Droplets,
  Shield,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
  Sun,
  Sunset,
  Moon,
  ClipboardCheck,
  Bell,
  X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Textarea, Card, EmptyState } from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import { supabase } from '../../../api/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';

// XenoCare Logo
// =============================================================================
// Types - All tied to encounter_id
// =============================================================================

interface ShiftHandoverProps {
  encounterId: string; // REQUIRED - Cannot render without encounter
  patientId: string; // REQUIRED - For reference
  patientName?: string;
}

interface ShiftHandover {
  handover_id: string;
  encounter_id: string; // FK to visits - REQUIRED
  patient_id: string; // FK to patients - REQUIRED
  handover_date: string;

  // Shift info
  outgoing_shift: 'morning' | 'afternoon' | 'night';
  incoming_shift: 'morning' | 'afternoon' | 'night';

  // Patient status
  patient_status: string;
  consciousness_level: string | null;
  mobility_status: string | null;

  // Critical info
  pending_tasks: string[];
  special_instructions: string | null;
  isolation_precautions: string | null;
  fall_risk_level: string | null;

  // Medications & Investigations
  medication_due: string[];
  investigations_pending: string[];

  // Vitals
  last_vitals: Record<string, any> | null;
  vitals_trend: string | null;

  // IV/Lines
  iv_access: string[];
  drains_catheters: string[];

  // Nutrition
  diet_type: string | null;
  feeding_route: string | null;
  last_meal_time: string | null;

  // Concerns
  concerns: string | null;
  follow_up_actions: string | null;

  // Staff
  outgoing_nurse_id: string;
  incoming_nurse_id: string | null;
  handover_time: string;

  // Acknowledgment
  is_acknowledged: boolean;
  acknowledged_at: string | null;

  created_at: string;

  // Joined data
  outgoing_nurse?: {
    first_name: string;
    last_name: string;
  };
  incoming_nurse?: {
    first_name: string;
    last_name: string;
  };
}

interface CreateShiftHandoverDTO {
  encounter_id: string; // REQUIRED
  patient_id: string; // REQUIRED
  handover_date: string;
  outgoing_shift: string;
  incoming_shift: string;
  patient_status: string;
  consciousness_level?: string;
  mobility_status?: string;
  pending_tasks?: string[];
  special_instructions?: string;
  isolation_precautions?: string;
  fall_risk_level?: string;
  medication_due?: string[];
  investigations_pending?: string[];
  last_vitals?: Record<string, any>;
  vitals_trend?: string;
  iv_access?: string[];
  drains_catheters?: string[];
  diet_type?: string;
  feeding_route?: string;
  last_meal_time?: string;
  concerns?: string;
  follow_up_actions?: string;
  outgoing_nurse_id: string;
}

const SHIFTS = [
  { value: 'morning', label: 'Morning (7AM - 3PM)', icon: Sun },
  { value: 'afternoon', label: 'Afternoon (3PM - 11PM)', icon: Sunset },
  { value: 'night', label: 'Night (11PM - 7AM)', icon: Moon },
] as const;

const CONSCIOUSNESS_LEVELS = [
  'Alert & Oriented',
  'Drowsy but responsive',
  'Confused',
  'Lethargic',
  'Unresponsive',
] as const;

const MOBILITY_STATUS = [
  'Ambulatory',
  'Ambulatory with assistance',
  'Wheelchair',
  'Bed-bound',
  'Immobile',
] as const;

const FALL_RISK_LEVELS = ['Low', 'Moderate', 'High'] as const;

const FEEDING_ROUTES = ['Oral', 'NGT', 'PEG', 'TPN', 'NPO'] as const;

// =============================================================================
// API Functions - All require encounter_id
// =============================================================================

// Helper to ensure array type (handles TEXT vs JSONB columns)
const ensureArray = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If it's a plain string, split by newlines or return as single item
      return value.trim() ? value.split('\n').filter(Boolean) : [];
    }
  }
  return [];
};

async function fetchShiftHandovers(
  encounterId: string,
): Promise<ShiftHandover[]> {
  if (!encounterId) {
    console.warn('[ShiftHandover] Cannot fetch without encounter_id');
    return [];
  }

  const { data, error } = await supabase
    .from('shift_handovers')
    .select(
      `
      *,
      outgoing_nurse:outgoing_nurse_id(first_name, last_name),
      incoming_nurse:incoming_nurse_id(first_name, last_name)
    `,
    )
    .eq('encounter_id', encounterId)
    .order('handover_time', { ascending: false });

  if (error) {
    console.error('Error fetching shift handovers:', error);
    return [];
  }

  return (data || []).map((item) => ({
    ...item,
    outgoing_nurse: Array.isArray(item.outgoing_nurse)
      ? item.outgoing_nurse[0]
      : item.outgoing_nurse,
    incoming_nurse: Array.isArray(item.incoming_nurse)
      ? item.incoming_nurse[0]
      : item.incoming_nurse,
    pending_tasks: ensureArray(item.pending_tasks),
    medication_due: ensureArray(item.medication_due),
    investigations_pending: ensureArray(item.investigations_pending),
    iv_access: ensureArray(item.iv_access),
    drains_catheters: ensureArray(item.drains_catheters),
  }));
}

// Fetch ALL shift handovers for a patient (across all encounters)
async function fetchPatientHandoverHistory(
  patientId: string,
): Promise<
  (ShiftHandover & { visit?: { visit_type?: string; created_at?: string } })[]
> {
  if (!patientId) {
    console.warn(
      '[ShiftHandover] Cannot fetch patient history without patient_id',
    );
    return [];
  }

  const { data, error } = await supabase
    .from('shift_handovers')
    .select(
      `
      *,
      outgoing_nurse:outgoing_nurse_id(first_name, last_name),
      incoming_nurse:incoming_nurse_id(first_name, last_name),
      visit:encounter_id(visit_type, created_at)
    `,
    )
    .eq('patient_id', patientId)
    .order('handover_time', { ascending: false })
    .limit(100); // Limit history to last 100 handovers

  if (error) {
    console.error('Error fetching patient handover history:', error);
    return [];
  }

  return (data || []).map((item) => ({
    ...item,
    outgoing_nurse: Array.isArray(item.outgoing_nurse)
      ? item.outgoing_nurse[0]
      : item.outgoing_nurse,
    incoming_nurse: Array.isArray(item.incoming_nurse)
      ? item.incoming_nurse[0]
      : item.incoming_nurse,
    visit: Array.isArray(item.visit) ? item.visit[0] : item.visit,
    pending_tasks: ensureArray(item.pending_tasks),
    medication_due: ensureArray(item.medication_due),
    investigations_pending: ensureArray(item.investigations_pending),
    iv_access: ensureArray(item.iv_access),
    drains_catheters: ensureArray(item.drains_catheters),
  }));
}

// Helper to get staff UUID from auth user id
async function getStaffUuidFromUser(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Failed to get staff UUID:', error);
    return null;
  }
  return data.id;
}

async function createShiftHandover(
  data: CreateShiftHandoverDTO,
): Promise<ShiftHandover | null> {
  // VALIDATION: Require encounter_id
  if (!data.encounter_id) {
    throw new Error('encounter_id is required for all shift handovers');
  }
  if (!data.patient_id) {
    throw new Error('patient_id is required for all shift handovers');
  }

  // Look up staff UUID if outgoing_nurse_id looks like an auth user id
  if (data.outgoing_nurse_id) {
    // Try to get staff record by user_id first
    const staffUuid = await getStaffUuidFromUser(data.outgoing_nurse_id);
    if (staffUuid) {
      data.outgoing_nurse_id = staffUuid;
    }
    // If not found, assume it's already a valid staff.id
  }

  const { data: result, error } = await supabase
    .from('shift_handovers')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('Error creating shift handover:', error);
    throw error;
  }

  return result;
}

async function acknowledgeHandover(
  handoverId: string,
  nurseId: string,
): Promise<void> {
  // Convert auth user ID to staff UUID
  let staffUuid = nurseId;
  const lookupResult = await getStaffUuidFromUser(nurseId);
  if (lookupResult) {
    staffUuid = lookupResult;
  }

  const { error } = await supabase
    .from('shift_handovers')
    .update({
      incoming_nurse_id: staffUuid,
      is_acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('handover_id', handoverId);

  if (error) {
    console.error('Error acknowledging handover:', error);
    throw error;
  }
}

// =============================================================================
// Shift Handover Card Component
// =============================================================================

function ShiftHandoverCard({
  handover,
  onAcknowledge,
  currentUserId,
}: {
  handover: ShiftHandover;
  onAcknowledge: (id: string) => void;
  currentUserId?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getShiftIcon = (shift: string) => {
    switch (shift) {
      case 'morning':
        return Sun;
      case 'afternoon':
        return Sunset;
      case 'night':
        return Moon;
      default:
        return Clock;
    }
  };

  const OutgoingIcon = getShiftIcon(handover.outgoing_shift);
  const IncomingIcon = getShiftIcon(handover.incoming_shift);

  const canAcknowledge =
    !handover.is_acknowledged && currentUserId !== handover.outgoing_nurse_id;

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden ${
        handover.is_acknowledged ? 'border-green-200' : 'border-amber-300'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          {/* Shift Transition */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-lg">
              <OutgoingIcon className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700 capitalize">
                {handover.outgoing_shift}
              </span>
            </div>
            <ArrowRightLeft className="h-4 w-4 text-gray-400" />
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-lg">
              <IncomingIcon className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700 capitalize">
                {handover.incoming_shift}
              </span>
            </div>
          </div>

          {/* Date/Time */}
          <div className="text-sm text-gray-600">
            {new Date(handover.handover_time).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>

          {/* Status */}
          {handover.is_acknowledged ? (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Acknowledged
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium animate-pulse">
              <Bell className="h-3 w-3" />
              Pending Acknowledgment
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {canAcknowledge && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(handover.handover_id);
              }}
            >
              <ClipboardCheck className="h-4 w-4 mr-1" />
              Acknowledge
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
          {/* Staff Info */}
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">From:</span>
              <span className="font-medium">
                {handover.outgoing_nurse
                  ? `${handover.outgoing_nurse.first_name} ${handover.outgoing_nurse.last_name}`
                  : 'Unknown'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">To:</span>
              <span className="font-medium">
                {handover.incoming_nurse
                  ? `${handover.incoming_nurse.first_name} ${handover.incoming_nurse.last_name}`
                  : 'Pending'}
              </span>
            </div>
          </div>

          {/* Patient Status */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <h5 className="text-xs font-semibold text-blue-700 uppercase mb-2">
              Patient Status
            </h5>
            <p className="text-sm text-gray-700">{handover.patient_status}</p>
            <div className="flex gap-4 mt-2 text-xs">
              {handover.consciousness_level && (
                <span className="text-gray-600">
                  <strong>Consciousness:</strong> {handover.consciousness_level}
                </span>
              )}
              {handover.mobility_status && (
                <span className="text-gray-600">
                  <strong>Mobility:</strong> {handover.mobility_status}
                </span>
              )}
              {handover.fall_risk_level && (
                <span
                  className={`font-medium ${
                    handover.fall_risk_level === 'High'
                      ? 'text-red-600'
                      : handover.fall_risk_level === 'Moderate'
                        ? 'text-amber-600'
                        : 'text-green-600'
                  }`}
                >
                  <strong>Fall Risk:</strong> {handover.fall_risk_level}
                </span>
              )}
            </div>
          </div>

          {/* Critical Information */}
          {(handover.special_instructions ||
            handover.isolation_precautions) && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h5 className="text-xs font-semibold text-red-700 uppercase">
                  Critical Information
                </h5>
              </div>
              {handover.special_instructions && (
                <p className="text-sm text-gray-700 mb-1">
                  <strong>Special Instructions:</strong>{' '}
                  {handover.special_instructions}
                </p>
              )}
              {handover.isolation_precautions && (
                <p className="text-sm text-gray-700">
                  <strong>Isolation:</strong> {handover.isolation_precautions}
                </p>
              )}
            </div>
          )}

          {/* Pending Tasks */}
          {handover.pending_tasks && handover.pending_tasks.length > 0 && (
            <div className="bg-amber-50 p-3 rounded-lg">
              <h5 className="text-xs font-semibold text-amber-700 uppercase mb-2">
                Pending Tasks
              </h5>
              <ul className="space-y-1">
                {handover.pending_tasks.map((task, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Circle className="h-3 w-3 text-amber-500 mt-1 flex-shrink-0" />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Medications Due */}
          {handover.medication_due && handover.medication_due.length > 0 && (
            <div className="bg-pink-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Pill className="h-4 w-4 text-pink-600" />
                <h5 className="text-xs font-semibold text-pink-700 uppercase">
                  Medications Due
                </h5>
              </div>
              <ul className="space-y-1">
                {handover.medication_due.map((med, idx) => (
                  <li key={idx} className="text-sm text-gray-700">
                    • {med}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Investigations Pending */}
          {handover.investigations_pending &&
            handover.investigations_pending.length > 0 && (
              <div className="bg-purple-50 p-3 rounded-lg">
                <h5 className="text-xs font-semibold text-purple-700 uppercase mb-2">
                  Investigations Pending
                </h5>
                <ul className="space-y-1">
                  {handover.investigations_pending.map((inv, idx) => (
                    <li key={idx} className="text-sm text-gray-700">
                      • {inv}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* IV Access & Lines */}
          {((handover.iv_access && handover.iv_access.length > 0) ||
            (handover.drains_catheters &&
              handover.drains_catheters.length > 0)) && (
            <div className="grid grid-cols-2 gap-3">
              {handover.iv_access && handover.iv_access.length > 0 && (
                <div className="bg-cyan-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="h-4 w-4 text-cyan-600" />
                    <h5 className="text-xs font-semibold text-cyan-700 uppercase">
                      IV Access
                    </h5>
                  </div>
                  <ul className="space-y-1">
                    {handover.iv_access.map((iv, idx) => (
                      <li key={idx} className="text-sm text-gray-700">
                        • {iv}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {handover.drains_catheters &&
                handover.drains_catheters.length > 0 && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h5 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                      Drains/Catheters
                    </h5>
                    <ul className="space-y-1">
                      {handover.drains_catheters.map((dc, idx) => (
                        <li key={idx} className="text-sm text-gray-700">
                          • {dc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {/* Nutrition */}
          {(handover.diet_type || handover.feeding_route) && (
            <div className="bg-green-50 p-3 rounded-lg">
              <h5 className="text-xs font-semibold text-green-700 uppercase mb-2">
                Nutrition
              </h5>
              <div className="flex gap-4 text-sm">
                {handover.diet_type && (
                  <span>
                    <strong>Diet:</strong> {handover.diet_type}
                  </span>
                )}
                {handover.feeding_route && (
                  <span>
                    <strong>Route:</strong> {handover.feeding_route}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Concerns & Follow-up */}
          {(handover.concerns || handover.follow_up_actions) && (
            <div className="bg-gray-100 p-3 rounded-lg">
              {handover.concerns && (
                <div className="mb-2">
                  <h5 className="text-xs font-semibold text-gray-700 uppercase mb-1">
                    Nursing Concerns
                  </h5>
                  <p className="text-sm text-gray-700">{handover.concerns}</p>
                </div>
              )}
              {handover.follow_up_actions && (
                <div>
                  <h5 className="text-xs font-semibold text-gray-700 uppercase mb-1">
                    Follow-up Actions
                  </h5>
                  <p className="text-sm text-gray-700">
                    {handover.follow_up_actions}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Acknowledgment Info */}
          {handover.is_acknowledged && handover.acknowledged_at && (
            <div className="text-xs text-gray-500 pt-2 border-t flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Acknowledged at{' '}
              {new Date(handover.acknowledged_at).toLocaleString('en-GB')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Shift Handover Form Component
// =============================================================================

interface ShiftHandoverFormProps {
  isOpen: boolean;
  onClose: () => void;
  encounterId: string; // REQUIRED
  patientId: string; // REQUIRED
  onSuccess: () => void;
}

function ShiftHandoverForm({
  isOpen,
  onClose,
  encounterId,
  patientId,
  onSuccess,
}: ShiftHandoverFormProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Determine current shift based on time
  const getCurrentShift = () => {
    const hour = new Date().getHours();
    if (hour >= 7 && hour < 15) return 'morning';
    if (hour >= 15 && hour < 23) return 'afternoon';
    return 'night';
  };

  const getNextShift = (current: string) => {
    if (current === 'morning') return 'afternoon';
    if (current === 'afternoon') return 'night';
    return 'morning';
  };

  const currentShift = getCurrentShift();

  const [formData, setFormData] = useState({
    handover_date: new Date().toISOString().split('T')[0],
    outgoing_shift: currentShift,
    incoming_shift: getNextShift(currentShift),
    patient_status: '',
    consciousness_level: '',
    mobility_status: '',
    pending_tasks: [] as string[],
    special_instructions: '',
    isolation_precautions: '',
    fall_risk_level: '',
    medication_due: [] as string[],
    investigations_pending: [] as string[],
    vitals_trend: '',
    iv_access: [] as string[],
    drains_catheters: [] as string[],
    diet_type: '',
    feeding_route: '',
    concerns: '',
    follow_up_actions: '',
  });

  const [newTask, setNewTask] = useState('');
  const [newMed, setNewMed] = useState('');
  const [newInv, setNewInv] = useState('');
  const [newIV, setNewIV] = useState('');
  const [newDrain, setNewDrain] = useState('');

  const createMutation = useMutation({
    mutationFn: createShiftHandover,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['shift-handovers', encounterId],
      });
      showToast({
        type: 'success',
        title: 'Success',
        message: 'Shift handover created successfully',
      });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to create shift handover',
      });
      console.error('Error creating shift handover:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // CRITICAL: Validate encounter_id
    if (!encounterId) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Cannot create handover without an active encounter',
      });
      return;
    }

    if (!formData.patient_status) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Patient status is required',
      });
      return;
    }

    const handoverData: CreateShiftHandoverDTO = {
      encounter_id: encounterId, // REQUIRED
      patient_id: patientId, // REQUIRED
      handover_date: formData.handover_date,
      outgoing_shift: formData.outgoing_shift,
      incoming_shift: formData.incoming_shift,
      patient_status: formData.patient_status,
      consciousness_level: formData.consciousness_level || undefined,
      mobility_status: formData.mobility_status || undefined,
      pending_tasks:
        formData.pending_tasks.length > 0 ? formData.pending_tasks : undefined,
      special_instructions: formData.special_instructions || undefined,
      isolation_precautions: formData.isolation_precautions || undefined,
      fall_risk_level: formData.fall_risk_level || undefined,
      medication_due:
        formData.medication_due.length > 0
          ? formData.medication_due
          : undefined,
      investigations_pending:
        formData.investigations_pending.length > 0
          ? formData.investigations_pending
          : undefined,
      vitals_trend: formData.vitals_trend || undefined,
      iv_access: formData.iv_access.length > 0 ? formData.iv_access : undefined,
      drains_catheters:
        formData.drains_catheters.length > 0
          ? formData.drains_catheters
          : undefined,
      diet_type: formData.diet_type || undefined,
      feeding_route: formData.feeding_route || undefined,
      concerns: formData.concerns || undefined,
      follow_up_actions: formData.follow_up_actions || undefined,
      outgoing_nurse_id: user?.id || '',
    };

    createMutation.mutate(handoverData);
  };

  // Helper to add items to arrays
  const addToArray = (
    field: string,
    value: string,
    setter: (v: string) => void,
  ) => {
    if (!value.trim()) return;
    setFormData((prev) => ({
      ...prev,
      [field]: [...(prev as any)[field], value.trim()],
    }));
    setter('');
  };

  const removeFromArray = (field: string, index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev as any)[field].filter((_: any, i: number) => i !== index),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container - Centered */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-xl w-full max-w-5xl transform transition-all max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with NDC Branding */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                
                <div>
                  <h2 className="text-xl font-bold text-white">
                    New Shift Handover
                  </h2>
                  <p className="text-blue-100 text-sm">
                    XenoCare - Nursing Shift Handover
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Form Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            <form
              id="shift-handover-form"
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {/* Encounter Reference Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-blue-700 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Linked to Encounter:</span>
                  <code className="bg-blue-100 px-2 py-0.5 rounded text-xs">
                    {encounterId.slice(0, 8)}...
                  </code>
                </div>
              </div>

              {/* Shift Selection */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.handover_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        handover_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Outgoing Shift
                  </label>
                  <select
                    value={formData.outgoing_shift}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        outgoing_shift: e.target.value,
                        incoming_shift: getNextShift(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {SHIFTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Incoming Shift
                  </label>
                  <select
                    value={formData.incoming_shift}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        incoming_shift: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {SHIFTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Patient Status */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Patient Status</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Status *
                  </label>
                  <Textarea
                    value={formData.patient_status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        patient_status: e.target.value,
                      })
                    }
                    placeholder="Brief summary of patient's current condition..."
                    rows={2}
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Consciousness
                    </label>
                    <select
                      value={formData.consciousness_level}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          consciousness_level: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select...</option>
                      {CONSCIOUSNESS_LEVELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobility
                    </label>
                    <select
                      value={formData.mobility_status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mobility_status: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select...</option>
                      {MOBILITY_STATUS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fall Risk
                    </label>
                    <select
                      value={formData.fall_risk_level}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          fall_risk_level: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select...</option>
                      {FALL_RISK_LEVELS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Critical Information */}
              <div className="space-y-4 bg-red-50 p-4 rounded-lg">
                <h4 className="font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Information
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Special Instructions
                  </label>
                  <Textarea
                    value={formData.special_instructions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        special_instructions: e.target.value,
                      })
                    }
                    placeholder="Any critical instructions for incoming nurse..."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Isolation Precautions
                  </label>
                  <input
                    type="text"
                    value={formData.isolation_precautions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isolation_precautions: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Contact precautions, Airborne precautions..."
                  />
                </div>
              </div>

              {/* Pending Tasks */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Pending Tasks
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      (e.preventDefault(),
                      addToArray('pending_tasks', newTask, setNewTask))
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Add a task..."
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      addToArray('pending_tasks', newTask, setNewTask)
                    }
                  >
                    Add
                  </Button>
                </div>
                {formData.pending_tasks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.pending_tasks.map((task, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-sm"
                      >
                        {task}
                        <button
                          type="button"
                          onClick={() => removeFromArray('pending_tasks', idx)}
                          className="hover:text-amber-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Medications Due */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Medications Due
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMed}
                    onChange={(e) => setNewMed(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      (e.preventDefault(),
                      addToArray('medication_due', newMed, setNewMed))
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Amlodipine 5mg at 8PM..."
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      addToArray('medication_due', newMed, setNewMed)
                    }
                  >
                    Add
                  </Button>
                </div>
                {formData.medication_due.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.medication_due.map((med, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 rounded text-sm"
                      >
                        {med}
                        <button
                          type="button"
                          onClick={() => removeFromArray('medication_due', idx)}
                          className="hover:text-pink-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Nutrition */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diet Type
                  </label>
                  <input
                    type="text"
                    value={formData.diet_type}
                    onChange={(e) =>
                      setFormData({ ...formData, diet_type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Low sodium, Diabetic diet..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Feeding Route
                  </label>
                  <select
                    value={formData.feeding_route}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        feeding_route: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    {FEEDING_ROUTES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Concerns & Follow-up */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nursing Concerns
                  </label>
                  <Textarea
                    value={formData.concerns}
                    onChange={(e) =>
                      setFormData({ ...formData, concerns: e.target.value })
                    }
                    placeholder="Any concerns about the patient..."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Follow-up Actions
                  </label>
                  <Textarea
                    value={formData.follow_up_actions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        follow_up_actions: e.target.value,
                      })
                    }
                    placeholder="Actions for incoming shift to take..."
                    rows={2}
                  />
                </div>
              </div>
            </form>
          </div>

          {/* Footer with Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              form="shift-handover-form"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Handover
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function ShiftHandoverTab({
  encounterId,
  patientId,
  patientName,
}: ShiftHandoverProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'encounter' | 'history'>(
    'encounter',
  );

  // Fetch handovers for this encounter
  const {
    data: handovers,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['shift-handovers', encounterId],
    queryFn: () => fetchShiftHandovers(encounterId),
    enabled: !!encounterId && viewMode === 'encounter',
  });

  // Fetch ALL handovers for this patient (history view)
  const { data: historyHandovers, isLoading: historyLoading } = useQuery({
    queryKey: ['shift-handovers-history', patientId],
    queryFn: () => fetchPatientHandoverHistory(patientId),
    enabled: !!patientId && viewMode === 'history',
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (handoverId: string) =>
      acknowledgeHandover(handoverId, user?.id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['shift-handovers', encounterId],
      });
      showToast({
        type: 'success',
        title: 'Success',
        message: 'Handover acknowledged',
      });
    },
    onError: () => {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to acknowledge handover',
      });
    },
  });

  // CRITICAL: Cannot render without encounter
  if (!encounterId) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-amber-700 bg-amber-50 p-4 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-medium">No Encounter Selected</p>
            <p className="text-sm">
              Select a patient with an active encounter to view or create shift
              handovers.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const displayHandovers =
    viewMode === 'encounter' ? handovers : historyHandovers;
  const isLoadingHandovers =
    viewMode === 'encounter' ? isLoading : historyLoading;

  // Count pending acknowledgments (only for current encounter view)
  const pendingCount =
    viewMode === 'encounter'
      ? handovers?.filter((h) => !h.is_acknowledged).length || 0
      : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-purple-600" />
            Shift Handovers
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                {pendingCount} pending
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-500">
            {patientName
              ? `Patient: ${patientName}`
              : 'Nursing shift handover documentation'}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Handover
        </Button>
      </div>

      {/* View Mode Toggle */}
      <div className="bg-white border border-gray-200 rounded-lg p-1 inline-flex">
        <button
          onClick={() => setViewMode('encounter')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'encounter'
              ? 'bg-purple-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          This Encounter
        </button>
        <button
          onClick={() => setViewMode('history')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'history'
              ? 'bg-purple-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Patient History
        </button>
      </div>

      {/* Context Banner */}
      {viewMode === 'encounter' ? (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-purple-700">
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
            <span>
              Showing handovers for <strong>current encounter only</strong>:
            </span>
            <code className="bg-white px-2 py-0.5 rounded border text-xs">
              {encounterId.slice(0, 8)}...
            </code>
          </div>
        </div>
      ) : (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-indigo-700">
            <Clock className="h-4 w-4 text-indigo-500" />
            <span>
              Showing <strong>all shift handovers</strong> across all encounters
              for this patient
            </span>
          </div>
        </div>
      )}

      {/* Handovers List */}
      {isLoadingHandovers ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 text-purple-600 animate-spin" />
        </div>
      ) : displayHandovers && displayHandovers.length > 0 ? (
        <div className="space-y-3">
          {displayHandovers.map((handover) => (
            <div key={handover.handover_id} className="relative">
              {/* History mode: Show encounter info */}
              {viewMode === 'history' && (handover as any).visit && (
                <div className="mb-1 ml-4 text-xs text-gray-500 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-gray-100 rounded">
                    {(handover as any).visit?.visit_type || 'Visit'}
                  </span>
                  <span>Encounter: {handover.encounter_id.slice(0, 8)}...</span>
                  {handover.encounter_id === encounterId && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                      Current
                    </span>
                  )}
                </div>
              )}
              <ShiftHandoverCard
                handover={handover}
                onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                currentUserId={user?.id}
              />
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-8">
          <EmptyState
            title={
              viewMode === 'encounter'
                ? 'No Shift Handovers'
                : 'No History Found'
            }
            description={
              viewMode === 'encounter'
                ? 'No shift handovers have been recorded for this encounter yet.'
                : "No shift handovers found in this patient's history."
            }
          />
        </Card>
      )}

      {/* Form Modal */}
      <ShiftHandoverForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        encounterId={encounterId}
        patientId={patientId}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

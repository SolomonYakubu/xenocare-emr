import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  TrendingUp,
  Clock,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  CalendarPlus,
} from 'lucide-react';
import PatientList from './components/PatientList';
import PatientForm from './components/PatientForm';
import PatientDetail from './components/PatientDetail';
import {
  useCreatePatient,
  useUpdatePatient,
  usePatientStats,
  usePatientSubscription,
} from './hooks/usePatient';
import {
  PatientDTO,
  CreatePatientDTO,
  UpdatePatientDTO,
} from './dtos/patient.dto';
import { useToast } from '../../components/ui/Toast';
import { useTimeTheme } from '../../hooks/useTimeTheme';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/FormElements';
import { EncounterForm } from '../encounter/components';
import { InlineGuidance } from '../../components/guidance/InlineGuidance';

// XenoCare Logo
export default function PatientRegistration() {
  // Enable real-time updates
  usePatientSubscription();

  // State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientDTO | null>(
    null,
  );
  const [editingPatient, setEditingPatient] = useState<PatientDTO | null>(null);
  const [formPreset, setFormPreset] =
    useState<Partial<CreatePatientDTO> | null>(null);

  // Post-registration encounter prompt
  const [showEncounterPrompt, setShowEncounterPrompt] = useState(false);
  const [newlyCreatedPatient, setNewlyCreatedPatient] =
    useState<PatientDTO | null>(null);

  // Encounter form modal (opens directly without navigation)
  const [isEncounterFormOpen, setIsEncounterFormOpen] = useState(false);

  // Toast
  const { showToast } = useToast();

  // Mutations
  const createMutation = useCreatePatient();
  const updateMutation = useUpdatePatient();
  const { data: stats } = usePatientStats();

  // Handlers
  const handleNewPatient = () => {
    setEditingPatient(null);
    setFormPreset(null);
    setIsFormOpen(true);
  };

  const handleViewPatient = (patient: PatientDTO) => {
    setSelectedPatient(patient);
    setIsDetailOpen(true);
  };

  const handleEditPatient = (patient: PatientDTO) => {
    setEditingPatient(patient);
    setFormPreset(null);
    setIsFormOpen(true);
    setIsDetailOpen(false);
  };

  const handleAddDependent = (principal: PatientDTO) => {
    setEditingPatient(null);
    setFormPreset({
      patient_type: 'Dependent',
      // Use principal.id (UUID) since principal_id references patients(id)
      principal_id: principal.id,
      patient_category: principal.patient_category ?? undefined,
      insurance_type: principal.insurance_type ?? undefined,
      // Inherit address/contact fields from principal
      state_of_origin: principal.state_of_origin ?? undefined,
      lga: principal.lga ?? undefined,
      residential_address: principal.residential_address ?? undefined,
      contact_phone: principal.contact_phone ?? undefined,
      nationality: principal.nationality ?? 'Nigerian',
      // Inherit surname (family name)
      surname: principal.surname ?? undefined,
    });
    setIsFormOpen(true);
    setIsDetailOpen(false);
  };

  const handleEditFromDetail = () => {
    if (selectedPatient) {
      handleEditPatient(selectedPatient);
    }
  };

  const handleFormSubmit = async (
    data: CreatePatientDTO | UpdatePatientDTO,
  ): Promise<PatientDTO> => {
    const isUpdate = 'patient_id' in data;

    showToast({
      type: 'info',
      title: isUpdate ? 'Updating in Background' : 'Registering in Background',
      message: 'You can continue working while we sync this record.',
    });

    if (isUpdate) {
      return updateMutation
        .mutateAsync(data)
        .then((result) => {
          showToast({
            type: 'success',
            title: 'Patient Updated',
            message: 'Patient record updated successfully',
          });
          return result;
        })
        .catch((error) => {
          showToast({
            type: 'error',
            title: 'Update Failed',
            message: 'Failed to update patient record',
          });
          throw error;
        });
    }

    return createMutation
      .mutateAsync(data)
      .then((result) => {
        showToast({
          type: 'success',
          title: 'Patient Registered',
          message: 'New patient registered successfully',
        });

        // Show encounter creation prompt for new patients
        setNewlyCreatedPatient(result);
        setShowEncounterPrompt(true);
        return result;
      })
      .catch((error) => {
        showToast({
          type: 'error',
          title: 'Registration Failed',
          message: 'Failed to save patient record',
        });
        throw error;
      });
  };

  const handleCreateEncounter = () => {
    if (newlyCreatedPatient) {
      // Open encounter form modal directly (no navigation)
      setShowEncounterPrompt(false);
      setIsEncounterFormOpen(true);
    }
  };

  const handleSkipEncounter = () => {
    setShowEncounterPrompt(false);
    setNewlyCreatedPatient(null);
  };

  const handleEncounterFormClose = () => {
    setIsEncounterFormOpen(false);
    setNewlyCreatedPatient(null);
  };

  const handleEncounterFormSuccess = () => {
    setIsEncounterFormOpen(false);
    setNewlyCreatedPatient(null);
    showToast({
      type: 'success',
      title: 'Encounter Created',
      message: 'Patient encounter created successfully',
    });
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingPatient(null);
    setFormPreset(null);
  };

  const handleDetailClose = () => {
    setIsDetailOpen(false);
    setSelectedPatient(null);
  };

  // Get time-based theme
  const {
    timeOfDay,
    greeting,
    colors: themeColors,
    isNightMode,
  } = useTimeTheme();

  // Get time icon based on time of day
  const TimeIcon = useMemo(() => {
    switch (timeOfDay) {
      case 'morning':
        return Sunrise;
      case 'afternoon':
        return Sun;
      case 'evening':
        return Sunset;
      case 'night':
        return Moon;
      default:
        return Sun;
    }
  }, [timeOfDay]);

  // Dynamic header gradient based on time
  const headerGradient = useMemo(() => {
    return `bg-gradient-to-r ${themeColors.header.gradient}`;
  }, [themeColors]);

  return (
    <div
      className={`space-y-6 sm:space-y-8 ${isNightMode ? 'text-slate-100' : ''}`}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
              Patient registration
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Find an existing patient or register a new one.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewPatient}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#E9783F] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#D96A36]"
          >
            <UserPlus className="h-4 w-4" />
            Register new patient
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
          {[
            { label: 'Total patients', value: stats?.total },
            { label: 'Active', value: stats?.active },
            { label: 'Today', value: stats?.registeredToday },
            { label: 'This month', value: stats?.registeredThisMonth },
          ].map((card) => (
            <div key={card.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {card.label}
              </dt>
              <dd className="font-display text-xl font-bold tabular-nums text-slate-900">
                {card.value?.toLocaleString() || '0'}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Patient List */}
      <PatientList
        onNewPatient={handleNewPatient}
        onViewPatient={handleViewPatient}
        onEditPatient={handleEditPatient}
        onCreateEncounter={(patient) => {
          setNewlyCreatedPatient(patient);
          setIsEncounterFormOpen(true);
        }}
      />

      {/* Patient Form (Create/Edit) */}
      <PatientForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        onCreateDependent={(data) => createMutation.mutateAsync(data)}
        patient={editingPatient}
        preset={formPreset || undefined}
        onOpenDependentForPrincipal={handleAddDependent}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Patient Detail View */}
      <PatientDetail
        isOpen={isDetailOpen}
        onClose={handleDetailClose}
        patient={selectedPatient}
        onEdit={handleEditFromDetail}
        onCreateEncounter={() => {
          if (selectedPatient) {
            setNewlyCreatedPatient(selectedPatient);
            setIsDetailOpen(false);
            setIsEncounterFormOpen(true);
          }
        }}
      />

      {/* Encounter Creation Prompt Modal */}
      <Modal
        isOpen={showEncounterPrompt}
        onClose={handleSkipEncounter}
        title="Create Encounter?"
        size="sm"
      >
        <div className="py-2 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-900/20 ring-4 ring-emerald-100">
            <CalendarPlus className="h-8 w-8 text-white" strokeWidth={2.25} />
          </div>
          <h3 className="mb-2 text-lg font-semibold tracking-tight text-slate-900">
            Patient registered successfully
          </h3>
          <p className="mb-6 text-sm leading-relaxed text-slate-600">
            Start a visit now for{' '}
            <span className="font-semibold text-slate-800">
              {newlyCreatedPatient?.first_name} {newlyCreatedPatient?.surname}
            </span>
            ?
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <Button
              variant="outline"
              onClick={handleSkipEncounter}
              className="w-full sm:w-auto"
            >
              Skip for now
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateEncounter}
              className="w-full sm:w-auto"
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              Create encounter
            </Button>
          </div>
        </div>
      </Modal>

      {/* Encounter Form Modal - Opens directly without navigation */}
      <EncounterForm
        isOpen={isEncounterFormOpen}
        onClose={handleEncounterFormClose}
        onSuccess={handleEncounterFormSuccess}
        preSelectedPatient={
          newlyCreatedPatient
            ? {
                id: newlyCreatedPatient.id || '',
                patient_id: newlyCreatedPatient.patient_id,
                first_name: newlyCreatedPatient.first_name,
                last_name: newlyCreatedPatient.surname,
                emr_number: newlyCreatedPatient.emr_number || undefined,
                date_of_birth: newlyCreatedPatient.date_of_birth || undefined,
                phone: newlyCreatedPatient.contact_phone || undefined,
                service_number: newlyCreatedPatient.service_number || undefined,
                patient_category:
                  newlyCreatedPatient.patient_category || undefined,
                insurance_type: newlyCreatedPatient.insurance_type || undefined,
                nhis_patient_source:
                  newlyCreatedPatient.nhis_patient_source || undefined,
              }
            : undefined
        }
      />
    </div>
  );
}

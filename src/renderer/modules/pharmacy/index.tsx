import React, { useEffect, useMemo, useState } from 'react';
import {
  Pill,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Package,
  BarChart3,
  Layers,
  BookOpen,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  ClipboardList,
  History,
  Shield,
  DollarSign,
  Bot,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button, Card, Tabs } from '../../components/ui';
import { CommandStatCard } from '../../components/dashboard';
import { ConfirmDialog } from '../../components/ui/Modal';
import PrescriptionList from './components/PrescriptionList';
import DispenseForm from './components/DispenseForm';
import BatchManagement from './components/BatchManagement';
import InventoryDashboard from './components/InventoryDashboard';
import BatchDispenseModal from './components/BatchDispenseModal';
import DrugCatalogueList from './components/DrugCatalogueList';
import DrugFormModal, { DrugFormData } from './components/DrugFormModal';
import ReadyToDispenseList, {
  DispenseEncounterGroup,
} from './components/ReadyToDispenseList';
import EncounterDispenseModal, {
  DispenseItem,
} from './components/EncounterDispenseModal';
import { ApprovedRequestsHistory } from '../billing/components/ApprovedRequestsHistory';
import DispenseHistoryTab from './components/DispenseHistoryTab';
import PharmacyFinancials from './components/PharmacyFinancials';
import PharmacyAuditTrail from './components/PharmacyAuditTrail';
import PrescriptionDetailModal from './components/PrescriptionDetailModal';
import { AIChatPanel } from '../ai-assistant/components/AIChatPanel';
import {
  usePrescriptions,
  usePharmacyStats,
  useDispenseMedication,
  useDispenseMedicationWithBatch,
  useCancelPrescription,
  useDeletePrescription,
  useDeletePrescriptionsBatch,
  useLowStockDrugs,
  usePharmacyInventoryStats,
  useCreateDrug,
  useUpdateDrugCatalogue,
  usePharmacySubscription,
} from './hooks/usePharmacy';
import { getDispensableBatches } from './api/pharmacy.api';
import {
  PrescriptionDTO,
  PrescriptionStatus,
  DrugDTO,
  getStockLevelColor,
  BatchDispenseDTO,
  CreateDrugDTO,
  UpdateDrugDTO,
} from './dtos/pharmacy.dto';
import {
  useTransitionEncounter,
  useActiveEncounters,
} from '../../lib/workflow';
import { checkServicePaymentStatus } from '../../lib/workflow/payment-gating';
import { usePaymentStatusForOrders } from '../billing/hooks/useBillingOrders';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTimeTheme } from '../../hooks/useTimeTheme';
import { NhisApprovalStatus } from '../../types/database.types';
import { createScopedLogger } from '../../utils/logger';

const log = createScopedLogger('PharmacyModule');

// XenoCare Logo
// =============================================================================
// Component
// =============================================================================

export default function Pharmacy() {
  // Enable real-time updates
  usePharmacySubscription();

  // Auth context for current user
  const { user, staff } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState('prescriptions');
  const [prescriptionSubTab, setPrescriptionSubTab] = useState<
    'all' | 'dispense_history'
  >('all');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PrescriptionStatus | ''>('');
  const [selectedPrescription, setSelectedPrescription] =
    useState<PrescriptionDTO | null>(null);
  const [selectedPrescriptions, setSelectedPrescriptions] = useState<
    PrescriptionDTO[]
  >([]);
  const [isDispenseFormOpen, setIsDispenseFormOpen] = useState(false);
  const [isBatchSelectOpen, setIsBatchSelectOpen] = useState(false);
  const [pendingDispenseData, setPendingDispenseData] = useState<{
    prescription: PrescriptionDTO;
    quantity: number;
    notes?: string;
  } | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<PrescriptionDTO | null>(
    null,
  );
  const [isAIDashboardOpen, setIsAIDashboardOpen] = useState(false);
  const [aiSelectedPatientId, setAiSelectedPatientId] = useState<string>('');

  // Dispense Encounter State (for Ready to Process tab)
  const [selectedDispenseGroup, setSelectedDispenseGroup] =
    useState<DispenseEncounterGroup | null>(null);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [isBatchDispensing, setIsBatchDispensing] = useState(false);

  // Drug Catalogue State
  const [isDrugFormOpen, setIsDrugFormOpen] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<DrugDTO | null>(null);
  const [drugDetailView, setDrugDetailView] = useState<DrugDTO | null>(null);

  // Prescription Detail Modal State (for Dispense History)
  const [isPrescriptionDetailOpen, setIsPrescriptionDetailOpen] =
    useState(false);

  const { showToast } = useToast();
  const [nhisBlockingModal, setNhisBlockingModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'warning' | 'error';
  }>({ isOpen: false, title: '', message: '', variant: 'warning' });

  // Queries
  const { data: prescriptionsData, isLoading } = usePrescriptions({
    page,
    limit: 10,
    status: statusFilter || undefined,
  });

  const { data: stats } = usePharmacyStats();
  const { data: lowStockDrugs } = useLowStockDrugs();
  const { data: inventoryStats } = usePharmacyInventoryStats();
  const { data: activeEncounters } = useActiveEncounters();
  const prescriptionIds = useMemo(
    () =>
      (prescriptionsData?.data || [])
        .map((rx) => rx.prescription_id)
        .filter(Boolean),
    [prescriptionsData],
  );
  const { data: paymentStatusData } = usePaymentStatusForOrders(
    prescriptionIds,
    'pharmacy',
  );
  const paymentStatusMap = useMemo(
    () => paymentStatusData || {},
    [paymentStatusData],
  );

  // Filter prescriptions for "Ready to Process" tab
  // Only show prescriptions that are dispensable AND have verified payment
  const readyToProcessPrescriptions = useMemo(() => {
    const allPrescriptions = prescriptionsData?.data || [];
    return allPrescriptions.filter((rx) => {
      // Check if prescription is in a dispensable status
      const isDispensable =
        rx.status === 'Accepted' ||
        rx.status === 'Pending' ||
        rx.status === 'Partial';

      if (!isDispensable) return false;

      // Check if payment is verified
      const paymentInfo = paymentStatusMap[rx.prescription_id];
      const paymentStatus = paymentInfo?.payment_status;
      const isPaid =
        paymentStatus === 'Paid' ||
        paymentStatus === 'Paid_NHIS' ||
        paymentStatus === 'Paid_Retainership' ||
        paymentStatus === 'Waived';

      return isPaid;
    });
  }, [prescriptionsData?.data, paymentStatusMap]);

  const pharmacyAiPatients = useMemo(() => {
    const source =
      readyToProcessPrescriptions.length > 0
        ? readyToProcessPrescriptions
        : prescriptionsData?.data || [];

    const byPatient = new Map<
      string,
      {
        patientId: string;
        patientName: string;
        emrNumber: string;
        prescription: PrescriptionDTO;
      }
    >();

    source.forEach((rx) => {
      const patientId =
        (rx.patient as { id?: string } | undefined)?.id || rx.patient_id;
      if (!patientId || byPatient.has(patientId)) return;

      const patientName =
        `${rx.patient?.first_name || ''} ${rx.patient?.surname || ''}`.trim() ||
        'Unknown Patient';
      const emrNumber =
        rx.patient?.emr_number || rx.patient?.patient_id || rx.patient_id;

      byPatient.set(patientId, {
        patientId,
        patientName,
        emrNumber,
        prescription: rx,
      });
    });

    return Array.from(byPatient.values());
  }, [readyToProcessPrescriptions, prescriptionsData?.data]);

  const selectedAiPatient = useMemo(
    () =>
      pharmacyAiPatients.find(
        (patient) => patient.patientId === aiSelectedPatientId,
      ) || null,
    [pharmacyAiPatients, aiSelectedPatientId],
  );

  useEffect(() => {
    if (!aiSelectedPatientId) return;
    const stillVisible = pharmacyAiPatients.some(
      (patient) => patient.patientId === aiSelectedPatientId,
    );
    if (!stillVisible) {
      setAiSelectedPatientId('');
    }
  }, [pharmacyAiPatients, aiSelectedPatientId]);

  // Mutations
  const dispenseMedication = useDispenseMedication();
  const dispenseMedicationWithBatch = useDispenseMedicationWithBatch();
  const cancelPrescription = useCancelPrescription();
  const deletePrescription = useDeletePrescription();
  const deletePrescriptionsBatch = useDeletePrescriptionsBatch();
  const transitionEncounter = useTransitionEncounter();
  const createDrug = useCreateDrug();
  const updateDrugCatalogue = useUpdateDrugCatalogue();

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    prescription_id: string;
    drug_name: string;
  }>({ open: false, prescription_id: '', drug_name: '' });
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{
    open: boolean;
    prescriptionIds: string[];
  }>({ open: false, prescriptionIds: [] });

  // Handlers
  const handleViewPrescription = (prescription: PrescriptionDTO) => {
    setSelectedPrescription(prescription);
    setIsPrescriptionDetailOpen(true);
  };

  // Dispense encounter group handler (for Ready to Process tab)
  const handleSelectDispenseEncounter = (group: DispenseEncounterGroup) => {
    setSelectedDispenseGroup(group);
    setIsDispenseModalOpen(true);
  };

  const ensurePaymentBeforeAction = async (
    prescription: PrescriptionDTO,
    actionLabel: string,
  ): Promise<boolean> => {
    // Try visit_id first, then fall back to encounter_id
    const visitId = prescription.visit_id || prescription.encounter_id || '';

    // If no visit ID but we have prescription_id, still check by source_record_id
    if (!visitId && !prescription.prescription_id) {
      showToast({
        type: 'error',
        title: 'Missing visit',
        message: 'Unable to locate the visit for this prescription.',
      });
      return false;
    }

    try {
      const result = await checkServicePaymentStatus(
        visitId,
        'Pharmacy',
        prescription.prescription_id,
      );
      if (!result.canProceed) {
        showToast({
          type: 'error',
          title: 'Payment required',
          message:
            result.reason ||
            `Payment must be completed before you can ${actionLabel}.`,
        });
        return false;
      }

      return true;
    } catch (error) {
      log.error('Failed to verify payment status:', error);
      showToast({
        type: 'error',
        title: 'Payment check failed',
        message: 'Unable to verify billing order. Please try again.',
      });
      return false;
    }
  };

  /**
   * NHIS Pre-Authorization Enforcement
   * Medications marked with requires_nhis_authorization=true must be approved
   * by NHIS desk before they can be dispensed
   *
   * Provisional approvals allow the patient to proceed to the next stage,
   * but actual dispensing is BLOCKED until official authorization code is entered.
   */
  const ensureNhisApprovalBeforeAction = (
    prescription: PrescriptionDTO,
    actionLabel: string,
  ): boolean => {
    const nhisStatus = (prescription as any).nhis_approval_status as
      | NhisApprovalStatus
      | undefined;

    // If no NHIS status field or status is 'not_required' or 'approved', allow action
    if (
      !nhisStatus ||
      nhisStatus === 'not_required' ||
      nhisStatus === 'approved'
    ) {
      return true;
    }

    if (nhisStatus === 'provisional') {
      setNhisBlockingModal({
        isOpen: true,
        title: 'NHIS Authorization Code Pending',
        message: `Cannot ${actionLabel} - This medication has provisional NHIS approval but the official authorization code has not been entered yet. The NHIS desk must enter the official code before dispensing is allowed.`,
        variant: 'warning',
      });
      return false;
    }

    if (nhisStatus === 'pending') {
      showToast({
        type: 'warning',
        title: 'NHIS Approval Required',
        message: `This medication requires NHIS desk approval before you can ${actionLabel}. The request is pending verification in the NHIS Specialty Referral Approvals queue.`,
      });
      return false;
    }

    if (nhisStatus === 'rejected') {
      showToast({
        type: 'error',
        title: 'NHIS Approval Rejected',
        message: `NHIS desk has rejected this medication request. You cannot ${actionLabel}.`,
      });
      return false;
    }

    if (nhisStatus === 'expired') {
      showToast({
        type: 'error',
        title: 'NHIS Approval Expired',
        message: `The NHIS approval for this medication has expired. Please request a new authorization before proceeding.`,
      });
      return false;
    }

    return true;
  };

  const handleDispense = async (prescription: PrescriptionDTO) => {
    // Check NHIS approval first (synchronous check)
    if (!ensureNhisApprovalBeforeAction(prescription, 'dispense medications'))
      return;

    const canProceed = await ensurePaymentBeforeAction(
      prescription,
      'dispense medications',
    );
    if (!canProceed) return;
    setSelectedPrescription(prescription);
    setSelectedPrescriptions([prescription]);
    setIsDispenseFormOpen(true);
  };

  // Handle batch dispensing all selected prescriptions at once (one-click dispense)
  const handleDispenseAll = async (items: DispenseItem[]) => {
    if (items.length === 0) return;

    // Check NHIS approval for all items
    for (const item of items) {
      if (
        !ensureNhisApprovalBeforeAction(
          item.prescription,
          'dispense medications',
        )
      ) {
        return;
      }
    }

    // Check payment for the first prescription (they're all from the same encounter)
    const canProceed = await ensurePaymentBeforeAction(
      items[0].prescription,
      'dispense medications',
    );
    if (!canProceed) return;

    setIsBatchDispensing(true);

    try {
      // Dispense all prescriptions in parallel
      const dispensePromises = items.map((item) =>
        dispenseMedication.mutateAsync({
          prescription_id: item.prescription.prescription_id,
          quantity_to_dispense: item.quantity,
          notes: `Batch dispensed with ${items.length} other medication(s)`,
        }),
      );

      await Promise.all(dispensePromises);

      showToast({
        type: 'success',
        title: '✓ All Medications Dispensed',
        message: `Successfully dispensed ${items.length} medication(s)`,
      });

      // Close the modal after successful dispense
      setIsDispenseModalOpen(false);
      setSelectedDispenseGroup(null);

      // Check if all prescriptions for this visit are dispensed for workflow transition
      const firstPrescription = items[0].prescription;
      const visitId =
        firstPrescription.visit_id || firstPrescription.encounter_id;
      if (visitId) {
        // Transition workflow (also fire-and-forget)
        transitionEncounter.mutate({
          visit_id: visitId,
          next_stage: 'billing_final',
          notes: 'All medications dispensed',
        });
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Dispense Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to dispense some medications. Please try again.',
      });
      log.error('Failed to dispense medications:', error);
    } finally {
      setIsBatchDispensing(false);
    }
  };

  const handleCancelPrescription = (prescription: PrescriptionDTO) => {
    setCancelConfirm(prescription);
  };

  const confirmCancel = () => {
    if (cancelConfirm) {
      // FIRE-AND-FORGET: Close immediately, optimistic update handles UI
      cancelPrescription.mutate(cancelConfirm.prescription_id, {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: '✓ Cancelled',
            message: `${cancelConfirm.drug?.drug_name || 'Prescription'} has been cancelled`,
          });
        },
        onError: (error) => {
          showToast({
            type: 'error',
            title: 'Cancel Failed',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to cancel prescription',
          });
          log.error('Failed to cancel prescription:', error);
        },
      });
      setCancelConfirm(null);
    }
  };

  // Delete handlers
  const handleDeletePrescription = (prescription: PrescriptionDTO) => {
    setDeleteConfirm({
      open: true,
      prescription_id: prescription.prescription_id,
      drug_name: prescription.drug?.drug_name || 'Unknown',
    });
  };

  const confirmDelete = () => {
    if (deleteConfirm.prescription_id) {
      deletePrescription.mutate(deleteConfirm.prescription_id, {
        onSuccess: () => {
          showToast({
            type: 'success',
            title: '✓ Deleted',
            message: `${deleteConfirm.drug_name} prescription has been removed`,
          });
        },
        onError: (error) => {
          showToast({
            type: 'error',
            title: 'Delete Failed',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to delete prescription',
          });
          log.error('Failed to delete prescription:', error);
        },
      });
      setDeleteConfirm({ open: false, prescription_id: '', drug_name: '' });
    }
  };

  const handleBulkDelete = (prescriptionIds: string[]) => {
    setBulkDeleteConfirm({ open: true, prescriptionIds });
  };

  const confirmBulkDelete = () => {
    if (bulkDeleteConfirm.prescriptionIds.length > 0) {
      deletePrescriptionsBatch.mutate(bulkDeleteConfirm.prescriptionIds, {
        onSuccess: (result) => {
          showToast({
            type: 'success',
            title: '✓ Bulk Delete Complete',
            message: `${result.deleted} prescription(s) deleted${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`,
          });
        },
        onError: (error) => {
          showToast({
            type: 'error',
            title: 'Bulk Delete Failed',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to delete prescriptions',
          });
          log.error('Failed to delete prescriptions:', error);
        },
      });
      setBulkDeleteConfirm({ open: false, prescriptionIds: [] });
    }
  };

  // Legacy dispense handler (fallback if batch modal is cancelled)
  const handleLegacyDispenseSubmit = async (
    quantity: number,
    notes?: string,
    prescriptionOverride?: PrescriptionDTO,
  ) => {
    const prescriptionToUse = prescriptionOverride || selectedPrescription;

    if (prescriptionToUse) {
      // Check NHIS approval first (synchronous check)
      if (
        !ensureNhisApprovalBeforeAction(
          prescriptionToUse,
          'dispense medications',
        )
      )
        return;

      const canProceed = await ensurePaymentBeforeAction(
        prescriptionToUse,
        'dispense medications',
      );
      if (!canProceed) return;

      // Find remaining prescriptions in the queue after this one
      const currentIndex = selectedPrescriptions.findIndex(
        (p) => p.prescription_id === prescriptionToUse.prescription_id,
      );
      const remainingPrescriptions = selectedPrescriptions.slice(
        currentIndex + 1,
      );

      // Store the prescription before clearing state
      const prescriptionToDispense = prescriptionToUse;

      // If there are more prescriptions, move to the next one
      if (remainingPrescriptions.length > 0) {
        setSelectedPrescription(remainingPrescriptions[0]);
        setSelectedPrescriptions(remainingPrescriptions);
      } else {
        // Close form - this was the last one
        setIsDispenseFormOpen(false);
        setSelectedPrescription(null);
        setSelectedPrescriptions([]);
      }

      // FIRE-AND-FORGET: Server sync in background
      dispenseMedication.mutate(
        {
          prescription_id: prescriptionToDispense.prescription_id,
          quantity_to_dispense: quantity,
          notes,
        },
        {
          onSuccess: () => {
            showToast({
              type: 'success',
              title: '✓ Dispensed Successfully',
              message: `${prescriptionToDispense.drug?.drug_name || 'Medication'} has been dispensed${remainingPrescriptions.length > 0 ? ` (${remainingPrescriptions.length} more to go)` : ''}`,
            });

            // Check if all prescriptions for this visit are dispensed
            if (prescriptionToDispense.visit_id) {
              const visitId = prescriptionToDispense.visit_id;

              // Check for other pending prescriptions
              const otherPendingPrescriptions = prescriptionsData?.data.filter(
                (p) =>
                  p.visit_id === visitId &&
                  p.prescription_id !==
                    prescriptionToDispense.prescription_id &&
                  p.status !== 'Dispensed',
              );

              if (
                !otherPendingPrescriptions ||
                otherPendingPrescriptions.length === 0
              ) {
                // Transition workflow (also fire-and-forget)
                transitionEncounter.mutate({
                  visit_id: visitId,
                  next_stage: 'billing_final',
                  notes: 'All medications dispensed',
                });
              }
            }
          },
          onError: (error) => {
            showToast({
              type: 'error',
              title: 'Dispense Failed',
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to dispense medication. Please try again.',
            });
            log.error('Failed to dispense medication:', error);
          },
        },
      );
    }
  };

  const handleDispenseSubmit = async (quantity: number, notes?: string) => {
    if (selectedPrescription) {
      // Check NHIS approval first (synchronous check)
      if (
        !ensureNhisApprovalBeforeAction(
          selectedPrescription,
          'dispense medications',
        )
      )
        return;

      const canProceed = await ensurePaymentBeforeAction(
        selectedPrescription,
        'dispense medications',
      );
      if (!canProceed) return;

      // Check if batches exist for this drug
      const drugId =
        selectedPrescription.drug_id || selectedPrescription.drug?.drug_id;
      if (drugId) {
        try {
          const batches = await getDispensableBatches(drugId, quantity);
          if (!batches || batches.length === 0) {
            // No batches available - use legacy dispense directly
            // This skips the "Select Batches" modal which would just show "No batches"
            handleLegacyDispenseSubmit(quantity, notes, selectedPrescription);
            return;
          }
        } catch (error) {
          log.warn('Failed to check batches, falling back to modal', error);
        }
      }

      // Close dispense form and open batch selection modal
      setIsDispenseFormOpen(false);
      setPendingDispenseData({
        prescription: selectedPrescription,
        quantity,
        notes,
      });
      setIsBatchSelectOpen(true);
    }
  };

  // Handle batch selection confirmation - use FEFO batch-aware dispensing
  const handleBatchConfirm = (
    selectedBatches: Array<{
      batch_id: string;
      batch_number: string;
      quantity: number;
      expiry_date: string;
    }>,
  ) => {
    if (!pendingDispenseData) return;

    const { prescription, quantity, notes } = pendingDispenseData;

    // Find remaining prescriptions in the queue after this one
    const currentIndex = selectedPrescriptions.findIndex(
      (p) => p.prescription_id === prescription.prescription_id,
    );
    const remainingPrescriptions = selectedPrescriptions.slice(
      currentIndex + 1,
    );

    // Close batch modal
    setIsBatchSelectOpen(false);
    setPendingDispenseData(null);

    // If there are more prescriptions, move to the next one and reopen dispense form
    if (remainingPrescriptions.length > 0) {
      setSelectedPrescription(remainingPrescriptions[0]);
      setSelectedPrescriptions(remainingPrescriptions);
      setIsDispenseFormOpen(true);
    } else {
      setSelectedPrescription(null);
      setSelectedPrescriptions([]);
    }

    // Prepare batch allocations
    const batchAllocations = selectedBatches.map((b) => ({
      batch_id: b.batch_id,
      quantity: b.quantity,
    }));

    // Use batch-aware dispensing
    const dispenseData: BatchDispenseDTO = {
      prescription_id: prescription.prescription_id,
      drug_id: prescription.drug_id || prescription.drug?.drug_id || '',
      patient_id: prescription.patient_id,
      encounter_id: prescription.encounter_id || prescription.visit_id || '',
      pharmacist_id: staff?.id || '',
      quantity_to_dispense: quantity,
      batch_allocations: batchAllocations,
      notes,
    };

    dispenseMedicationWithBatch.mutate(dispenseData, {
      onSuccess: () => {
        showToast({
          type: 'success',
          title: '✓ Dispensed Successfully',
          message: `${prescription.drug?.drug_name || 'Medication'} dispensed from ${selectedBatches.length} batch(es)${remainingPrescriptions.length > 0 ? ` (${remainingPrescriptions.length} more to go)` : ''}`,
        });

        // Check if all prescriptions for this visit are dispensed
        const visitId = prescription.visit_id || prescription.encounter_id;
        if (visitId) {
          const otherPendingPrescriptions = prescriptionsData?.data.filter(
            (p) =>
              (p.visit_id === visitId || p.encounter_id === visitId) &&
              p.prescription_id !== prescription.prescription_id &&
              p.status !== 'Dispensed',
          );

          if (
            !otherPendingPrescriptions ||
            otherPendingPrescriptions.length === 0
          ) {
            // Transition workflow to final billing
            transitionEncounter.mutate({
              visit_id: visitId,
              next_stage: 'billing_final',
              notes: 'All medications dispensed',
            });
          }
        }
      },
      onError: (error) => {
        showToast({
          type: 'error',
          title: 'Dispense Failed',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to dispense medication. Please try again.',
        });
        log.error('Failed to dispense medication:', error);
      },
    });
  };

  const handleFilterChange = (status: PrescriptionStatus | '') => {
    setStatusFilter(status);
    setPage(1);
  };

  // Drug Catalogue Handlers
  const handleAddDrug = () => {
    setSelectedDrug(null);
    setIsDrugFormOpen(true);
  };

  const handleEditDrug = (drug: DrugDTO) => {
    setSelectedDrug(drug);
    setIsDrugFormOpen(true);
  };

  const handleViewDrug = (drug: DrugDTO) => {
    setDrugDetailView(drug);
    // Could open a detail modal if needed
    log.info('View drug details:', drug);
  };

  const handleManageBatches = (drug: DrugDTO) => {
    // Switch to batches tab with this drug pre-selected
    setActiveTab('batches');
    // Could pass the drug as filter context
    log.info('Manage batches for:', drug.drug_name);
  };

  const handleDrugFormSubmit = async (formData: DrugFormData) => {
    try {
      if (formData.drug_id) {
        // Update existing drug
        const updateData: UpdateDrugDTO = {
          drug_id: formData.drug_id,
          drug_code: formData.drug_code,
          drug_name: formData.drug_name,
          generic_name: formData.generic_name || undefined,
          brand_name: formData.brand_name || undefined,
          category: formData.category || undefined,
          drug_type: formData.drug_type || undefined,
          strength: formData.strength || undefined,
          manufacturer: formData.manufacturer || undefined,
          unit_of_measure: formData.unit_of_measure || undefined,
          unit_cost: formData.unit_cost || undefined,
          selling_price: formData.selling_price,
          reorder_level: formData.reorder_level,
          nhis_eligible: formData.nhis_eligible,
          nhis_price: formData.nhis_price || undefined,
          nhis_percentage: formData.nhis_percentage || 0,
          requires_prescription: formData.requires_prescription,
          is_controlled: formData.is_controlled,
          is_active: formData.is_active,
        };

        await updateDrugCatalogue.mutateAsync(updateData);
        showToast({
          type: 'success',
          title: 'Drug Updated',
          message: `${formData.drug_name} has been updated successfully`,
        });
      } else {
        // Create new drug
        const createData: CreateDrugDTO = {
          drug_code: formData.drug_code,
          drug_name: formData.drug_name,
          generic_name: formData.generic_name || undefined,
          brand_name: formData.brand_name || undefined,
          category: formData.category as any,
          drug_type: formData.drug_type as any,
          strength: formData.strength || undefined,
          manufacturer: formData.manufacturer || undefined,
          unit_of_measure: formData.unit_of_measure || undefined,
          unit_cost: formData.unit_cost || undefined,
          selling_price: formData.selling_price,
          reorder_level: formData.reorder_level,
          nhis_eligible: formData.nhis_eligible,
          nhis_price: formData.nhis_price || undefined,
          nhis_percentage: formData.nhis_percentage || 0,
          requires_prescription: formData.requires_prescription,
          is_controlled: formData.is_controlled,
          is_active: formData.is_active,
        };

        await createDrug.mutateAsync(createData);
        showToast({
          type: 'success',
          title: 'Drug Added',
          message: `${formData.drug_name} has been added to the catalogue`,
        });
      }

      setIsDrugFormOpen(false);
      setSelectedDrug(null);
    } catch (error) {
      log.error('Failed to save drug:', error);
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save drug. Please try again.',
      });
    }
  };

  const tabs = [
    { id: 'prescriptions', label: 'Prescriptions', icon: <Pill size={16} /> },
    {
      id: 'catalogue',
      label: 'Drug Catalogue',
      icon: <BookOpen size={16} />,
    },
    {
      id: 'inventory',
      label: 'Low Stock',
      icon: <Package size={16} />,
      count: lowStockDrugs?.length,
    },
    {
      id: 'batches',
      label: 'Batches',
      icon: <Layers size={16} />,
      count: inventoryStats?.expiring_30_days,
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <BarChart3 size={16} />,
    },
    {
      id: 'financials',
      label: 'Financials',
      icon: <DollarSign size={16} />,
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: <Shield size={16} />,
    },
    {
      id: 'history',
      label: 'History',
      icon: <History size={16} />,
    },
  ];

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
      className={`space-y-8 px-4 pb-10 sm:px-6 lg:px-8 ${isNightMode ? 'bg-slate-900' : 'bg-[#f9fafb]'}`}
    >
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="font-display text-xl font-bold text-slate-900">
          Pharmacy
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Dispense medicines and manage stock.
        </p>
      </div>

      <details
        className={`group rounded-xl border shadow-sm ${
          isNightMode
            ? 'border-slate-700 bg-slate-800/60'
            : 'border-slate-200 bg-white/80'
        }`}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold sm:px-5 [&::-webkit-details-marker]:hidden text-slate-800 dark:text-slate-100">
          <span className="flex items-center gap-2">
            <Bot className="h-4 w-4 opacity-80" />
            XenoCare AI Assistant
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180 dark:text-slate-400" />
        </summary>
        <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-slate-600 sm:px-5">
          <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
            Optional assistant hub — expand when you need clinical or
            documentation support.
          </p>
          <Button
            variant="outline"
            onClick={() => setIsAIDashboardOpen(true)}
            className="border-primary-600 text-primary-800 dark:border-primary-500 dark:text-primary-200"
          >
            <Bot className="h-4 w-4 mr-1" />
            Open medical AI
          </Button>
        </div>
      </details>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CommandStatCard
          label="Pending prescriptions"
          value={stats?.pending_prescriptions || 0}
          icon={Clock}
          tone="amber"
        />
        <CommandStatCard
          label="Dispensed today"
          value={stats?.dispensed_today || 0}
          icon={CheckCircle}
          tone="emerald"
        />
        <CommandStatCard
          label="Low stock SKUs"
          value={stats?.low_stock_items || 0}
          icon={AlertTriangle}
          tone="orange"
        />
        <CommandStatCard
          label="Out of stock"
          value={stats?.out_of_stock || 0}
          icon={Package}
          tone="slate"
        />
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === 'prescriptions' && (
        <>
          {/* Prescription Sub-Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setPrescriptionSubTab('all')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  prescriptionSubTab === 'all'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CheckCircle size={18} />
                Ready to Process
                {readyToProcessPrescriptions.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {readyToProcessPrescriptions.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setPrescriptionSubTab('dispense_history')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  prescriptionSubTab === 'dispense_history'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package size={18} />
                Dispense History
              </button>
            </nav>
          </div>

          {/* Ready to Process Sub-Tab */}
          {prescriptionSubTab === 'all' && (
            <>
              {/* Header */}
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Ready to Process
                    </h2>
                    <p className="text-sm text-gray-500">
                      Prescriptions grouped by encounter with verified payment -
                      ready for dispensing
                    </p>
                  </div>
                </div>
              </Card>

              {/* Grouped Prescriptions List */}
              <Card>
                <ReadyToDispenseList
                  prescriptions={readyToProcessPrescriptions}
                  isLoading={isLoading}
                  onSelectEncounter={handleSelectDispenseEncounter}
                  paymentStatusMap={paymentStatusMap}
                />
              </Card>
            </>
          )}

          {/* Dispense History Sub-Tab */}
          {prescriptionSubTab === 'dispense_history' && (
            <Card>
              <DispenseHistoryTab
                prescriptions={prescriptionsData?.data || []}
                isLoading={isLoading}
                onViewDispense={handleViewPrescription}
              />
            </Card>
          )}
        </>
      )}

      {activeTab === 'catalogue' && (
        <Card>
          <DrugCatalogueList
            onAddDrug={handleAddDrug}
            onEditDrug={handleEditDrug}
            onViewDrug={handleViewDrug}
            onManageBatches={handleManageBatches}
          />
        </Card>
      )}

      {activeTab === 'inventory' && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Low Stock Alert
          </h2>
          {lowStockDrugs && lowStockDrugs.length > 0 ? (
            <div className="space-y-3">
              {lowStockDrugs.map((drug: DrugDTO) => (
                <div
                  key={drug.drug_id}
                  className={`p-4 rounded-lg border ${
                    drug.quantity_in_stock === 0
                      ? 'bg-red-50 border-red-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {drug.drug_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {drug.strength} • {drug.drug_type} • {drug.category}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-2xl font-bold ${getStockLevelColor(drug.quantity_in_stock ?? drug.stock_quantity ?? 0, drug.reorder_level)}`}
                      >
                        {drug.quantity_in_stock ?? drug.stock_quantity ?? 0}
                      </div>
                      <div className="text-xs text-gray-500">
                        Reorder at: {drug.reorder_level}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p>All items are well stocked</p>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'batches' && (
        <Card>
          <BatchManagement showDrugColumn />
        </Card>
      )}

      {activeTab === 'dashboard' && <InventoryDashboard />}

      {activeTab === 'financials' && <PharmacyFinancials />}

      {activeTab === 'audit' && <PharmacyAuditTrail />}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <ApprovedRequestsHistory
            sourceModule="pharmacy"
            title="Pharmacy Approved Requests History"
            showModuleFilter={false}
          />
        </Card>
      )}

      {/* AI Assistant Dashboard Panel */}
      {isAIDashboardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsAIDashboardOpen(false)}
          />
          <div className="relative w-full max-w-4xl h-[82vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-primary-700 to-primary-600 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-1.5 shadow">
                  
                </div>
                <span className="text-sm font-semibold">
                  XenoCare AI Assistant
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={aiSelectedPatientId}
                  onChange={(e) => setAiSelectedPatientId(e.target.value)}
                  className="text-xs text-gray-800 rounded-md border border-white/40 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/60"
                  disabled={pharmacyAiPatients.length === 0}
                >
                  <option value="">
                    {pharmacyAiPatients.length === 0
                      ? 'All pharmacy records (no queue patients)'
                      : 'All pharmacy records (optional patient filter)'}
                  </option>
                  {pharmacyAiPatients.map((patient) => (
                    <option key={patient.patientId} value={patient.patientId}>
                      {patient.patientName} • {patient.emrNumber}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setIsAIDashboardOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/15 transition-colors"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <AIChatPanel
                key={selectedAiPatient?.patientId || 'no-patient'}
                patientId={selectedAiPatient?.patientId || null}
                patientName={selectedAiPatient?.patientName}
                emrNumber={selectedAiPatient?.emrNumber}
                facilityId={staff?.facility_id ?? ''}
                userId={staff?.id ?? ''}
                chiefComplaint={
                  selectedAiPatient?.prescription.clinical_notes ||
                  selectedAiPatient?.prescription.diagnosis?.join(', ')
                }
                visitDate={selectedAiPatient?.prescription.created_at}
                department="Pharmacy"
                assistantScope="pharmacy"
                variant="minimal"
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Dispense Form Modal */}
      <DispenseForm
        isOpen={isDispenseFormOpen}
        onClose={() => {
          setIsDispenseFormOpen(false);
          setSelectedPrescription(null);
          setSelectedPrescriptions([]);
        }}
        onSubmit={handleDispenseSubmit}
        isLoading={dispenseMedication.isPending}
        prescription={selectedPrescription}
        queueInfo={
          selectedPrescriptions.length > 1
            ? {
                currentIndex:
                  selectedPrescriptions.findIndex(
                    (p) =>
                      p.prescription_id ===
                      selectedPrescription?.prescription_id,
                  ) + 1,
                total: selectedPrescriptions.length,
              }
            : undefined
        }
      />

      {/* Batch Selection Modal (FEFO) */}
      {pendingDispenseData && (
        <BatchDispenseModal
          isOpen={isBatchSelectOpen}
          onClose={() => {
            setIsBatchSelectOpen(false);
            setPendingDispenseData(null);
          }}
          onConfirm={handleBatchConfirm}
          onLegacyDispense={() => {
            if (pendingDispenseData) {
              handleLegacyDispenseSubmit(
                pendingDispenseData.quantity,
                pendingDispenseData.notes,
                pendingDispenseData.prescription,
              );
            }
            setIsBatchSelectOpen(false);
            setPendingDispenseData(null);
          }}
          drugId={
            pendingDispenseData.prescription.drug_id ||
            pendingDispenseData.prescription.drug?.drug_id ||
            ''
          }
          drugName={
            pendingDispenseData.prescription.drug?.drug_name || 'Unknown Drug'
          }
          quantityNeeded={pendingDispenseData.quantity}
          isLoading={dispenseMedicationWithBatch.isPending}
        />
      )}

      {/* Confirm Cancel */}
      <ConfirmDialog
        isOpen={!!cancelConfirm}
        onClose={() => setCancelConfirm(null)}
        onConfirm={confirmCancel}
        title="Cancel Prescription"
        message={`Are you sure you want to cancel the prescription for "${cancelConfirm?.drug?.drug_name}"?`}
        confirmText="Cancel Prescription"
        variant="danger"
        isLoading={cancelPrescription.isPending}
      />

      {/* Confirm Delete Single */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() =>
          setDeleteConfirm({ open: false, prescription_id: '', drug_name: '' })
        }
        onConfirm={confirmDelete}
        title="Delete Prescription"
        message={`Are you sure you want to permanently delete the prescription for "${deleteConfirm.drug_name}"? This action cannot be undone.`}
        confirmText="Delete Permanently"
        variant="danger"
        isLoading={deletePrescription.isPending}
      />

      {/* Confirm Bulk Delete */}
      <ConfirmDialog
        isOpen={bulkDeleteConfirm.open}
        onClose={() =>
          setBulkDeleteConfirm({ open: false, prescriptionIds: [] })
        }
        onConfirm={confirmBulkDelete}
        title="Delete Multiple Prescriptions"
        message={`Are you sure you want to permanently delete ${bulkDeleteConfirm.prescriptionIds.length} prescription(s)? This action cannot be undone.`}
        confirmText="Delete All Selected"
        variant="danger"
        isLoading={deletePrescriptionsBatch.isPending}
      />

      {/* Drug Form Modal (Add/Edit Drug) */}
      <DrugFormModal
        isOpen={isDrugFormOpen}
        onClose={() => {
          setIsDrugFormOpen(false);
          setSelectedDrug(null);
        }}
        onSubmit={handleDrugFormSubmit}
        drug={selectedDrug}
        isLoading={createDrug.isPending || updateDrugCatalogue.isPending}
      />

      {/* NHIS Blocking Modal */}
      {nhisBlockingModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() =>
              setNhisBlockingModal({
                isOpen: false,
                title: '',
                message: '',
                variant: 'warning',
              })
            }
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start space-x-4">
                <div
                  className={`p-3 rounded-full ${nhisBlockingModal.variant === 'warning' ? 'bg-yellow-100' : 'bg-red-100'}`}
                >
                  <AlertCircle
                    className={`w-6 h-6 ${nhisBlockingModal.variant === 'warning' ? 'text-yellow-600' : 'text-red-600'}`}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {nhisBlockingModal.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {nhisBlockingModal.message}
                  </p>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button
                  variant="primary"
                  onClick={() =>
                    setNhisBlockingModal({
                      isOpen: false,
                      title: '',
                      message: '',
                      variant: 'warning',
                    })
                  }
                >
                  Understood
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Encounter Dispense Modal (for Ready to Process) */}
      <EncounterDispenseModal
        isOpen={isDispenseModalOpen}
        onClose={() => {
          setIsDispenseModalOpen(false);
          setSelectedDispenseGroup(null);
        }}
        encounterGroup={selectedDispenseGroup}
        onDispenseAll={handleDispenseAll}
        isDispensing={isBatchDispensing}
        paymentStatusMap={paymentStatusMap}
      />

      {/* Prescription Detail Modal (for Dispense History) */}
      {selectedPrescription && (
        <PrescriptionDetailModal
          isOpen={isPrescriptionDetailOpen}
          onClose={() => {
            setIsPrescriptionDetailOpen(false);
            setSelectedPrescription(null);
          }}
          prescription={selectedPrescription}
        />
      )}
    </div>
  );
}
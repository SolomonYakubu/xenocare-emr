import React, { useState, useCallback, useMemo } from 'react';
import {
  X,
  User,
  FlaskConical,
  Beaker,
  AlertTriangle,
  CheckCircle,
  Droplets,
  FileText,
  Clock,
  History,
  Shield,
} from 'lucide-react';
import { Button, ConfirmDialog } from '../../../components/ui';
import {
  LabRequestDTO,
  validateLabResultForm,
  LabResultFormErrors,
  CreateLabResultDTO,
  RESULT_STATUS,
  ResultStatus,
  getLabCategoryColor,
  getSampleTypeColor,
  LabCategory,
  SampleType,
} from '../dtos/lab.dto';
import {
  ResultTemplateType,
  LabCategoryCode,
  StructuredResult,
  createEmptyStructuredResult,
  sanitizeStructuredResultForTemplate,
  getTemplateTypeForCategory,
  LAB_CATEGORIES,
} from '../dtos/lab-templates.dto';
import { DynamicResultForm, getTemplateTypeLabel } from './templates';
import {
  formatPatientName,
  formatDetailedAge,
} from '../../patient-registration/dtos/patient.dto';
import type { LabTestCatalogue } from '../../../types/database.types';
import { useDraftRestore } from '../../../hooks/useDraftRestore';
import {
  useLabFormTemplate,
  useLabFormTemplateHistory,
  useSaveLabFormTemplate,
  useRollbackLabFormTemplate,
} from '../hooks/useLab';
import { useToast } from '../../../components/ui/Toast';

// =============================================================================
// Types
// =============================================================================

// Workflow status for result approval
type WorkflowStatus =
  | 'pending'
  | 'verified'
  | 'approved'
  | 'released'
  | 'amended';

const WORKFLOW_STATUSES: {
  value: WorkflowStatus;
  label: string;
  color: string;
}[] = [
  {
    value: 'pending',
    label: 'Pending Review',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
  {
    value: 'verified',
    label: 'Verified',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  {
    value: 'approved',
    label: 'Approved',
    color: 'bg-green-100 text-green-800 border-green-300',
  },
  {
    value: 'released',
    label: 'Released',
    color: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  {
    value: 'amended',
    label: 'Amended',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
  },
];

interface EnhancedLabResultFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EnhancedCreateLabResultDTO) => Promise<void>;
  isLoading?: boolean;
  request: LabRequestDTO | null;
  /** If true, only show the dynamic template form (for advanced entry) */
  useAdvancedMode?: boolean;
  /** Existing result for editing/amendment */
  existingResult?: {
    structured_result?: StructuredResult;
    workflow_status?: WorkflowStatus;
    version?: number;
  };
}

// Extended DTO to include structured result and workflow
export interface EnhancedCreateLabResultDTO extends CreateLabResultDTO {
  structured_result?: StructuredResult;
  result_template_type?: ResultTemplateType;
  workflow_status?: WorkflowStatus;
  is_critical?: boolean;
  collected_at?: string;
  specimen_type?: string;
  specimen_identifier?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getCategoryCode(
  category: string | null | undefined,
): LabCategoryCode | undefined {
  if (!category) return undefined;

  // Normalize category name (trim and handle case variations)
  const normalizedCategory = category.trim();

  const categoryMap: Record<string, LabCategoryCode> = {
    // Standard names
    Hematology: 'HEMATOLOGY',
    'Clinical Chemistry': 'CLINICAL_CHEMISTRY',
    'Chemical Pathology': 'CLINICAL_CHEMISTRY', // Legacy name
    Microbiology: 'MICROBIOLOGY',
    Parasitology: 'PARASITOLOGY',
    Serology: 'SEROLOGY',
    Immunology: 'SEROLOGY', // Alias
    Urinalysis: 'URINALYSIS',
    Histopathology: 'HISTOPATHOLOGY',
    'Histopathology & Cytology': 'HISTOPATHOLOGY', // Extended name
    Cytology: 'HISTOPATHOLOGY', // Alias
    Endocrinology: 'ENDOCRINOLOGY',
    Hormones: 'ENDOCRINOLOGY', // Alias
    'Hormone Panel': 'ENDOCRINOLOGY', // Alias
    Molecular: 'MOLECULAR',
    'Molecular Diagnostics': 'MOLECULAR', // Full name
    'Molecular Diagnostics & Rapid Tests': 'MOLECULAR', // Extended name
    Coagulation: 'COAGULATION',
    'Coagulation Studies': 'COAGULATION', // Extended name
    'Blood Bank': 'BLOOD_BANK',
    'Blood Bank / Transfusion Medicine': 'BLOOD_BANK', // Extended name
  };

  // Try exact match first
  if (categoryMap[normalizedCategory]) {
    return categoryMap[normalizedCategory];
  }

  // Try case-insensitive match
  const lowerCategory = normalizedCategory.toLowerCase();
  for (const [key, value] of Object.entries(categoryMap)) {
    if (key.toLowerCase() === lowerCategory) {
      return value;
    }
  }

  // Try partial match (e.g., "Hematology" in "Hematology / Blood")
  for (const [key, value] of Object.entries(categoryMap)) {
    if (
      lowerCategory.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(lowerCategory)
    ) {
      return value;
    }
  }

  console.warn(
    `Unknown lab category: "${category}", defaulting to CLINICAL_CHEMISTRY`,
  );
  return 'CLINICAL_CHEMISTRY'; // Default fallback
}

function getTestParameters(request: LabRequestDTO | null): Array<{
  name: string;
  unit?: string;
  referenceRange?: string;
  criticalLow?: number;
  criticalHigh?: number;
}> {
  // LabTestCatalogue doesn't have test_parameters - use extended request type or return empty
  // Test parameters would come from ui_schema in lab_result_template_types table
  const test = request?.test as LabTestCatalogue & {
    test_parameters?: Array<{
      name?: string;
      parameter_name?: string;
      unit?: string;
      reference_range?: string;
      normal_range?: string;
      critical_low?: number;
      critical_high?: number;
    }>;
  };

  if (!test?.test_parameters) return [];

  const params = test.test_parameters;
  if (Array.isArray(params)) {
    return params.map((p) => ({
      name: p.name || p.parameter_name || '',
      unit: p.unit,
      referenceRange: p.reference_range || p.normal_range,
      criticalLow: p.critical_low,
      criticalHigh: p.critical_high,
    }));
  }

  return [];
}

/**
 * Detect template type from test name if category mapping fails
 * This handles misclassified tests in the database
 */
function detectTemplateFromTestName(
  testName: string | undefined | null,
): ResultTemplateType | null {
  if (!testName) return null;

  const lowerName = testName.toLowerCase();

  // Urinalysis detection
  if (
    lowerName.includes('urinalysis') ||
    lowerName.includes('urine routine') ||
    lowerName.includes('urine r/e') ||
    lowerName.includes('urine analysis')
  ) {
    return 'urinalysis_checklist';
  }

  // Parasitology detection
  if (
    lowerName.includes('malaria') ||
    lowerName.includes('parasite') ||
    lowerName.includes('ova') ||
    lowerName.includes('cyst') ||
    lowerName.includes('stool microscopy') ||
    lowerName.includes('blood film')
  ) {
    return 'parasite_report';
  }

  // Culture & Sensitivity detection
  if (
    lowerName.includes('m/c/s') ||
    lowerName.includes('culture') ||
    lowerName.includes('sensitivity') ||
    lowerName.includes('c/s')
  ) {
    return 'culture_sensitivity';
  }

  // Serology / Qualitative detection
  if (
    lowerName.includes('hiv') ||
    lowerName.includes('hbsag') ||
    lowerName.includes('hcv') ||
    lowerName.includes('vdrl') ||
    lowerName.includes('widal') ||
    lowerName.includes('hepatitis') ||
    lowerName.includes('screening') ||
    lowerName.includes('antibody') ||
    lowerName.includes('antigen')
  ) {
    return 'qualitative_quantitative';
  }

  // Molecular / Rapid test detection
  if (
    lowerName.includes('pcr') ||
    lowerName.includes('genexpert') ||
    lowerName.includes('rapid') ||
    lowerName.includes('rdt') ||
    lowerName.includes('covid') ||
    lowerName.includes('viral load')
  ) {
    return 'binary_metadata';
  }

  // Histopathology detection
  if (
    lowerName.includes('histop') ||
    lowerName.includes('biopsy') ||
    lowerName.includes('cytology') ||
    lowerName.includes('pap smear') ||
    lowerName.includes('fnac') ||
    lowerName.includes('tissue')
  ) {
    return 'narrative_diagnostic';
  }

  // Hormone / Endocrinology detection
  if (
    lowerName.includes('hormone') ||
    lowerName.includes('thyroid') ||
    lowerName.includes('cortisol') ||
    lowerName.includes('tsh') ||
    lowerName.includes('testosterone') ||
    lowerName.includes('estrogen') ||
    lowerName.includes('prolactin') ||
    lowerName.includes('fsh') ||
    lowerName.includes('lh') ||
    lowerName.includes('progesterone')
  ) {
    return 'numeric_timing';
  }

  // Coagulation detection
  if (
    lowerName.includes('pt') ||
    lowerName.includes('ptt') ||
    lowerName.includes('inr') ||
    lowerName.includes('coagul') ||
    lowerName.includes('bleeding') ||
    lowerName.includes('clotting') ||
    lowerName.includes('d-dimer') ||
    lowerName.includes('fibrinogen')
  ) {
    return 'numeric_table';
  }

  return null;
}

// =============================================================================
// Component
// =============================================================================

export default function EnhancedLabResultForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  request,
  useAdvancedMode = true,
  existingResult,
}: EnhancedLabResultFormProps) {
  const { showToast } = useToast();

  // Core result fields
  const [result, setResult] = useState('');
  const [resultStatus, setResultStatus] = useState<ResultStatus>('Normal');
  const [remarks, setRemarks] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [methodology, setMethodology] = useState('');

  // Enhanced fields
  const [structuredResult, setStructuredResult] =
    useState<StructuredResult | null>(null);
  const [workflowStatus, setWorkflowStatus] =
    useState<WorkflowStatus>('pending');
  const [collectedAt, setCollectedAt] = useState('');

  const [errors, setErrors] = useState<LabResultFormErrors>({});
  const [rollbackTemplateId, setRollbackTemplateId] = useState<string>('');
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [isSaveTemplateConfirmOpen, setIsSaveTemplateConfirmOpen] =
    useState(false);
  const [templateEditorResult, setTemplateEditorResult] =
    useState<StructuredResult | null>(null);
  const [templateEditorType, setTemplateEditorType] =
    useState<ResultTemplateType>('panel_numeric');
  const [templateEditorCategoryCode, setTemplateEditorCategoryCode] = useState<
    LabCategoryCode | undefined
  >(undefined);

  const testId = request?.test_id || null;
  const { data: activeTemplate } = useLabFormTemplate(
    testId,
    isOpen && !!testId,
  );
  const { data: templateHistory = [] } = useLabFormTemplateHistory(
    testId,
    isOpen && !!testId,
  );
  const saveTemplateMutation = useSaveLabFormTemplate();
  const rollbackTemplateMutation = useRollbackLabFormTemplate();

  // ── Draft auto-save / restore ──────────────────────────────────────────
  const draftData = useMemo(
    () => ({
      result,
      remarks,
      interpretation,
      methodology,
    }),
    [result, remarks, interpretation, methodology],
  );

  const setDraftData = useCallback((d: typeof draftData) => {
    setResult(d.result);
    setRemarks(d.remarks);
    setInterpretation(d.interpretation);
    setMethodology(d.methodology);
  }, []);

  const { clearDraft } = useDraftRestore(
    `lab-result-${request?.request_id || 'new'}`,
    draftData,
    setDraftData,
    { enabled: isOpen },
  );

  // Determine template type from test category (used as initial suggestion)
  const suggestedCategoryCode = useMemo(
    () => getCategoryCode(request?.test?.category),
    [request],
  );
  const suggestedTemplateType = useMemo((): ResultTemplateType => {
    // Check if test has explicit template type (extended type)
    const test = request?.test as LabTestCatalogue & {
      result_template_type?: string;
    };
    if (test?.result_template_type) {
      return test.result_template_type as ResultTemplateType;
    }

    // Try to detect template from test name (handles miscategorized tests)
    const testName = request?.test?.test_name || '';
    const nameBasedTemplate = detectTemplateFromTestName(testName);
    if (nameBasedTemplate) {
      return nameBasedTemplate;
    }

    // Fall back to category-based template
    return getTemplateTypeForCategory(suggestedCategoryCode || 'HEMATOLOGY');
  }, [request, suggestedCategoryCode]);

  // Admin-selectable category and template type
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<
    LabCategoryCode | undefined
  >(suggestedCategoryCode);
  const [selectedTemplateType, setSelectedTemplateType] =
    useState<ResultTemplateType>(suggestedTemplateType);

  // Update selections when suggestion changes (e.g., new request selected)
  React.useEffect(() => {
    setSelectedTemplateType(suggestedTemplateType);
    setSelectedCategoryCode(suggestedCategoryCode);
  }, [suggestedTemplateType, suggestedCategoryCode]);

  const testParameters = useMemo(() => getTestParameters(request), [request]);

  // Initialize form when opened
  React.useEffect(() => {
    if (isOpen && request) {
      // Get existing lab result from request
      const labResult = request.lab_result;

      // Core fields - from the lab_result on the request
      setResult(
        labResult?.result ||
          (typeof request.result === 'object'
            ? ''
            : String(request.result || '')) ||
          '',
      );
      setResultStatus((labResult?.result_status as ResultStatus) || 'Normal');
      setRemarks(labResult?.remarks || request.result_notes || '');
      setInterpretation(labResult?.interpretation || '');
      setMethodology(labResult?.methodology || '');

      // Structured result - from existingResult prop (for enhanced mode)
      if (existingResult?.structured_result) {
        setStructuredResult(existingResult.structured_result);
      } else if (activeTemplate?.template_payload) {
        setStructuredResult(
          activeTemplate.template_payload as StructuredResult,
        );
        setSelectedTemplateType(
          activeTemplate.template_type as ResultTemplateType,
        );
      } else {
        setStructuredResult(createEmptyStructuredResult(selectedTemplateType));
      }

      // Workflow
      setWorkflowStatus(existingResult?.workflow_status || 'pending');
      setCollectedAt(new Date().toISOString().slice(0, 16));

      setErrors({});
      setRollbackTemplateId('');
      setIsTemplateEditorOpen(false);
      setIsSaveTemplateConfirmOpen(false);
    }
  }, [isOpen, request, existingResult, selectedTemplateType, activeTemplate]);

  // Handle structured result change
  const handleStructuredResultChange = useCallback(
    (value: StructuredResult) => {
      setStructuredResult(value);

      // Auto-detect critical status from structured result
      if (value && 'isCritical' in value && value.isCritical) {
        setResultStatus('Critical');
      }
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate - at minimum need structured result
    const hasStructuredResult =
      structuredResult && Object.keys(structuredResult).length > 0;
    const hasLegacyResult = result.trim().length > 0;

    if (!hasStructuredResult && !hasLegacyResult) {
      setErrors({ result: 'Please enter a result' });
      return;
    }

    if (resultStatus === 'Critical' && !remarks.trim()) {
      setErrors({
        notes:
          'Critical results require a notification and escalation note before submission.',
      });
      return;
    }

    const resultData: EnhancedCreateLabResultDTO = {
      lab_request_id: request?.request_id || '',
      result:
        result || generateResultSummary(structuredResult, selectedTemplateType),
      result_status: resultStatus,
      remarks: remarks || undefined,
      interpretation: interpretation || undefined,
      methodology: methodology || undefined,
      // Enhanced fields
      structured_result: structuredResult || undefined,
      result_template_type: selectedTemplateType,
      workflow_status: workflowStatus,
      is_critical: resultStatus === 'Critical',
      collected_at: collectedAt || undefined,
    };

    await onSubmit(resultData);
    clearDraft();
    onClose();
  };

  const handleOpenTemplateEditor = () => {
    const baseTemplate = activeTemplate?.template_payload
      ? (activeTemplate.template_payload as StructuredResult)
      : structuredResult || createEmptyStructuredResult(selectedTemplateType);

    setTemplateEditorResult(baseTemplate);
    setTemplateEditorType(
      (activeTemplate?.template_type as ResultTemplateType | undefined) ||
        selectedTemplateType,
    );
    setTemplateEditorCategoryCode(
      selectedCategoryCode || suggestedCategoryCode,
    );
    setRollbackTemplateId('');
    setIsTemplateEditorOpen(true);
  };

  const handleSaveAsTemplate = () => {
    if (!request?.test_id) {
      showToast({
        type: 'error',
        title: 'Template save failed',
        message: 'Test information is missing for this request.',
      });
      return;
    }

    if (
      !templateEditorResult ||
      Object.keys(templateEditorResult).length === 0
    ) {
      showToast({
        type: 'error',
        title: 'Template save failed',
        message:
          'Please complete the form structure before saving as template.',
      });
      return;
    }

    setIsSaveTemplateConfirmOpen(true);
  };

  const handleConfirmSaveAsTemplate = async () => {
    if (!request?.test_id) return;

    try {
      const sanitizedTemplate = sanitizeStructuredResultForTemplate(
        templateEditorResult as StructuredResult,
      );

      await saveTemplateMutation.mutateAsync({
        test_id: request.test_id,
        template_type: templateEditorType,
        template_payload: sanitizedTemplate as unknown as Record<
          string,
          unknown
        >,
        source_request_id: request.request_id,
        change_reason: 'Saved from template editor modal',
      });

      setSelectedTemplateType(templateEditorType);
      setSelectedCategoryCode(templateEditorCategoryCode);
      setIsTemplateEditorOpen(false);
      setIsSaveTemplateConfirmOpen(false);

      showToast({
        type: 'success',
        title: 'Template saved',
        message:
          'This form layout is now the default for subsequent entries of this test.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Template save failed',
        message:
          error instanceof Error ? error.message : 'Unable to save template.',
      });
    }
  };

  const handleRollbackTemplate = async () => {
    if (!request?.test_id || !rollbackTemplateId) {
      return;
    }

    const confirmed = window.confirm(
      'Roll back active template to the selected version? This affects newly opened forms for this test.',
    );

    if (!confirmed) {
      return;
    }

    try {
      await rollbackTemplateMutation.mutateAsync({
        test_id: request.test_id,
        template_id: rollbackTemplateId,
        rollback_reason: 'Manual rollback from lab result form',
      });

      showToast({
        type: 'success',
        title: 'Template rolled back',
        message: 'Selected template version is now active for new forms.',
      });

      setRollbackTemplateId('');
      setIsTemplateEditorOpen(false);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Rollback failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to roll back template.',
      });
    }
  };

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="relative bg-gray-50 rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* EMR Header with NDC Branding */}
          <div className="bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600">
              <div className="flex items-center gap-4">
                <div className="border-l border-white/30 pl-4">
                  <h1 className="text-white font-bold text-lg tracking-wide">
                    XENOCARE
                  </h1>
                  <p className="text-green-100 text-xs font-medium">
                    Medical Centre - Laboratory Result Entry
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-4">
                  <p className="text-white text-sm font-medium">
                    REQ #{request.request_id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-green-100 text-xs">
                    {new Date().toLocaleDateString('en-NG', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto bg-white"
          >
            <div className="p-6 space-y-5">
              {/* Patient & Test Info */}
              <div className="grid grid-cols-2 gap-5">
                {/* Patient Info Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Patient</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold shadow">
                      {request.patient?.first_name?.charAt(0)}
                      {request.patient?.surname?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {request.patient
                          ? formatPatientName(request.patient)
                          : 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {request.patient?.gender} •{' '}
                        {request.patient?.date_of_birth
                          ? formatDetailedAge(request.patient.date_of_birth)
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Test Info Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <FlaskConical className="h-4 w-4 text-purple-600" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Laboratory Test
                    </h3>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {request.test?.category && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getLabCategoryColor(
                            request.test.category as LabCategory,
                          )}`}
                        >
                          {request.test.category}
                        </span>
                      )}
                      {request.test?.sample_type && (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${getSampleTypeColor(
                            request.test.sample_type as SampleType,
                          )}`}
                        >
                          <Droplets className="h-3 w-3 inline mr-1" />
                          {request.test.sample_type}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">
                      {request.test?.test_name}
                    </p>
                    {request.test?.normal_range && (
                      <p className="text-xs text-green-600 mt-1">
                        Normal: {request.test.normal_range}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Collection Time & Workflow Status */}
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Collection Date/Time
                  </label>
                  <input
                    type="datetime-local"
                    value={collectedAt}
                    onChange={(e) => setCollectedAt(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-colors"
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Shield className="h-4 w-4 inline mr-1" />
                    Workflow Status
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {WORKFLOW_STATUSES.map(({ value, label, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setWorkflowStatus(value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          workflowStatus === value
                            ? color
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Result Entry Section */}
              {useAdvancedMode && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-100 rounded-xl">
                        <Beaker className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Test Result
                        </h3>
                        <p className="text-xs text-gray-500">
                          Select the appropriate result form template
                        </p>
                      </div>
                    </div>
                    {existingResult?.version && existingResult.version > 1 && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full flex items-center gap-1">
                        <History className="h-3 w-3" />
                        Version {existingResult.version}
                      </span>
                    )}
                  </div>

                  {/* Category & Template Type Selectors */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Category Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lab Category
                      </label>
                      <select
                        value={selectedCategoryCode || ''}
                        onChange={(e) => {
                          const newCategory = e.target.value as LabCategoryCode;
                          setSelectedCategoryCode(newCategory);
                          // Optionally update template to match category's default
                          if (newCategory && LAB_CATEGORIES[newCategory]) {
                            setSelectedTemplateType(
                              LAB_CATEGORIES[newCategory].resultTemplateType,
                            );
                            setStructuredResult(null);
                          }
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 bg-white text-gray-900"
                      >
                        {Object.values(LAB_CATEGORIES)
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((cat) => (
                            <option key={cat.code} value={cat.code}>
                              {cat.displayName}
                            </option>
                          ))}
                      </select>
                      {suggestedCategoryCode !== selectedCategoryCode &&
                        suggestedCategoryCode && (
                          <p className="mt-1 text-xs text-amber-600">
                            Original category:{' '}
                            {LAB_CATEGORIES[suggestedCategoryCode]?.displayName}
                          </p>
                        )}
                    </div>

                    {/* Template Type Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Result Form Template
                      </label>
                      <select
                        value={selectedTemplateType}
                        onChange={(e) => {
                          setSelectedTemplateType(
                            e.target.value as ResultTemplateType,
                          );
                          setStructuredResult(null); // Reset result when template changes
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 bg-white text-gray-900"
                      >
                        <option value="numeric_table">
                          Numeric Table (CBC, LFT, RFT, Lipid Panel)
                        </option>
                        <option value="panel_numeric">
                          Panel Numeric (Multi-panel tests)
                        </option>
                        <option value="urinalysis_checklist">
                          Urinalysis Checklist (Physical, Chemical, Microscopy)
                        </option>
                        <option value="culture_sensitivity">
                          Culture & Sensitivity (Microbiology)
                        </option>
                        <option value="parasite_report">
                          Parasite Report (Malaria, Stool MCS)
                        </option>
                        <option value="qualitative_quantitative">
                          Qualitative/Quantitative (HIV, HBsAg, Pregnancy)
                        </option>
                        <option value="narrative_diagnostic">
                          Narrative Diagnostic (Histopathology, Cytology)
                        </option>
                        <option value="numeric_timing">
                          Numeric with Timing (OGTT, Glucose Tolerance)
                        </option>
                        <option value="binary_metadata">
                          Binary with Metadata (Blood Group, Genotype)
                        </option>
                      </select>
                      {suggestedTemplateType !== selectedTemplateType && (
                        <p className="mt-1 text-xs text-amber-600">
                          Suggested:{' '}
                          {getTemplateTypeLabel(suggestedTemplateType)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="text-xs text-indigo-900">
                        <p className="font-semibold">Template Defaults</p>
                        <p>
                          Active version: {activeTemplate?.version || 0}. Use
                          template editor to manage default form layout for this
                          test.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleOpenTemplateEditor}
                        >
                          Edit Form Template
                        </Button>
                      </div>
                    </div>
                  </div>

                  <DynamicResultForm
                    templateType={selectedTemplateType}
                    categoryCode={selectedCategoryCode}
                    value={structuredResult}
                    onChange={handleStructuredResultChange}
                    testName={request.test?.test_name}
                    unit={request.test?.unit || undefined}
                    referenceRange={request.test?.normal_range || undefined}
                    testParameters={testParameters}
                    readOnly={false}
                  />
                </div>
              )}

              {/* Clinical Interpretation & Notes - Only show for templates that need it */}
              {/* Hide for: narrative_diagnostic (has own sections), binary_metadata (simple result) */}
              {selectedTemplateType !== 'narrative_diagnostic' &&
                selectedTemplateType !== 'binary_metadata' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                      <div className="p-2.5 bg-blue-100 rounded-xl">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Clinical Interpretation & Notes
                        </h3>
                        <p className="text-xs text-gray-500">
                          Add interpretation, methodology, and any additional
                          observations
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Interpretation - show for all except qualitative_quantitative (straightforward result) */}
                      {selectedTemplateType !== 'qualitative_quantitative' && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Clinical Interpretation{' '}
                            <span className="text-gray-400 font-normal">
                              (How should the physician interpret these
                              results?)
                            </span>
                          </label>
                          <textarea
                            value={interpretation}
                            onChange={(e) => setInterpretation(e.target.value)}
                            rows={3}
                            placeholder={
                              selectedTemplateType === 'numeric_table' ||
                              selectedTemplateType === 'panel_numeric'
                                ? 'e.g., Results suggest iron deficiency anemia. Recommend further evaluation with serum ferritin and TIBC...'
                                : selectedTemplateType === 'culture_sensitivity'
                                  ? 'e.g., Growth of E. coli sensitive to commonly used antibiotics. Consider oral antibiotic therapy...'
                                  : selectedTemplateType === 'parasite_report'
                                    ? 'e.g., Malaria parasite detected. Recommend immediate treatment with artemisinin-based combination therapy...'
                                    : selectedTemplateType ===
                                        'urinalysis_checklist'
                                      ? 'e.g., Findings consistent with urinary tract infection. Recommend urine culture if not already done...'
                                      : 'Enter clinical interpretation of the results...'
                            }
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-colors"
                          />
                        </div>
                      )}

                      {/* Methodology - show for numeric tests only */}
                      {(selectedTemplateType === 'numeric_table' ||
                        selectedTemplateType === 'panel_numeric' ||
                        selectedTemplateType === 'numeric_timing' ||
                        selectedTemplateType === 'urinalysis_checklist') && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Test Methodology{' '}
                            <span className="text-gray-400 font-normal">
                              (Method/Equipment used)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={methodology}
                            onChange={(e) => setMethodology(e.target.value)}
                            placeholder={
                              selectedTemplateType === 'urinalysis_checklist'
                                ? 'e.g., Dipstick analysis, Microscopy (400x), Automated urine analyzer...'
                                : 'e.g., Automated hematology analyzer (Sysmex XN-1000), ELISA, Spectrophotometry...'
                            }
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-colors"
                          />
                        </div>
                      )}

                      {/* Remarks / Notes - show for all in this section */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Additional Remarks{' '}
                          <span className="text-gray-400 font-normal">
                            (Sample quality, limitations, recommendations)
                          </span>
                        </label>
                        <textarea
                          value={remarks}
                          onChange={(e) => {
                            setRemarks(e.target.value);
                            setErrors((prev) => ({
                              ...prev,
                              notes: undefined,
                            }));
                          }}
                          rows={2}
                          placeholder={
                            selectedTemplateType === 'culture_sensitivity'
                              ? 'e.g., Specimen quality adequate. Mixed growth - suggest repeat if clinically indicated...'
                              : selectedTemplateType === 'parasite_report'
                                ? 'e.g., Thick and thin films examined. Repeat in 12-24 hours if clinical suspicion remains high...'
                                : 'e.g., Sample slightly hemolyzed. Suggest repeat if clinically indicated. Patient was fasting for 12 hours...'
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 transition-colors"
                        />
                        {errors.notes && (
                          <p className="mt-2 text-sm text-red-600">
                            {errors.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {/* Result Status - LAST */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                  <div className="p-2.5 bg-orange-100 rounded-xl">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Result Status
                    </h3>
                    <p className="text-xs text-gray-500">
                      Indicate if the result is normal, abnormal, or critical
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {RESULT_STATUS.map((status) => (
                    <label
                      key={status}
                      className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                        resultStatus === status
                          ? status === 'Critical'
                            ? 'bg-red-50 border-red-400'
                            : status === 'Abnormal'
                              ? 'bg-orange-50 border-orange-400'
                              : 'bg-green-50 border-green-400'
                          : 'bg-gray-50 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resultStatus"
                        value={status}
                        checked={resultStatus === status}
                        onChange={(e) =>
                          setResultStatus(e.target.value as ResultStatus)
                        }
                        className="h-4 w-4 text-primary-700 focus:ring-primary-700"
                      />
                      <div className="flex items-center gap-2">
                        {status === 'Normal' && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        {status === 'Abnormal' && (
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                        )}
                        {status === 'Critical' && (
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        )}
                        <span
                          className={`font-semibold ${
                            resultStatus === status
                              ? status === 'Critical'
                                ? 'text-red-700'
                                : status === 'Abnormal'
                                  ? 'text-orange-700'
                                  : 'text-green-700'
                              : 'text-gray-700'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

                {resultStatus === 'Critical' && (
                  <div className="mt-4 p-4 bg-red-100 rounded-xl border border-red-300 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">
                        Critical Result Alert
                      </p>
                      <p className="text-sm text-red-700">
                        This result will be flagged as critical. Document who
                        was notified and the escalation steps taken in
                        Additional Remarks before saving.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>

          {/* Footer with Actions */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>Result will be timestamped upon submission</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={isLoading}
                  onClick={handleSubmit}
                  className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-[#007538] text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save Result
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isTemplateEditorOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsTemplateEditorOpen(false)}
          />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Edit Form Template
                </h3>
                <p className="text-xs text-gray-500">
                  Changes saved here become default for newly opened forms of
                  this test.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplateEditorOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lab Category
                  </label>
                  <select
                    value={templateEditorCategoryCode || ''}
                    onChange={(e) => {
                      const nextCategory = e.target.value as LabCategoryCode;
                      setTemplateEditorCategoryCode(nextCategory);
                      if (nextCategory && LAB_CATEGORIES[nextCategory]) {
                        const mappedType =
                          LAB_CATEGORIES[nextCategory].resultTemplateType;
                        setTemplateEditorType(mappedType);
                        setTemplateEditorResult(
                          createEmptyStructuredResult(mappedType),
                        );
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 bg-white text-gray-900"
                  >
                    {Object.values(LAB_CATEGORIES)
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((cat) => (
                        <option key={cat.code} value={cat.code}>
                          {cat.displayName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Result Form Template
                  </label>
                  <select
                    value={templateEditorType}
                    onChange={(e) => {
                      const nextType = e.target.value as ResultTemplateType;
                      setTemplateEditorType(nextType);
                      setTemplateEditorResult(
                        createEmptyStructuredResult(nextType),
                      );
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-700 focus:border-primary-700 bg-white text-gray-900"
                  >
                    <option value="numeric_table">
                      Numeric Table (CBC, LFT, RFT, Lipid Panel)
                    </option>
                    <option value="panel_numeric">
                      Panel Numeric (Multi-panel tests)
                    </option>
                    <option value="urinalysis_checklist">
                      Urinalysis Checklist (Physical, Chemical, Microscopy)
                    </option>
                    <option value="culture_sensitivity">
                      Culture & Sensitivity (Microbiology)
                    </option>
                    <option value="parasite_report">
                      Parasite Report (Malaria, Stool MCS)
                    </option>
                    <option value="qualitative_quantitative">
                      Qualitative/Quantitative (HIV, HBsAg, Pregnancy)
                    </option>
                    <option value="narrative_diagnostic">
                      Narrative Diagnostic (Histopathology, Cytology)
                    </option>
                    <option value="numeric_timing">
                      Numeric with Timing (OGTT, Glucose Tolerance)
                    </option>
                    <option value="binary_metadata">
                      Binary with Metadata (Blood Group, Genotype)
                    </option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-indigo-900">
                    Active version: {activeTemplate?.version || 0}. Select older
                    versions to rollback if needed.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={rollbackTemplateId}
                      onChange={(e) => setRollbackTemplateId(e.target.value)}
                      className="px-3 py-2 border border-indigo-200 rounded-lg text-xs bg-white"
                    >
                      <option value="">Select version to rollback</option>
                      {templateHistory
                        .filter((item) => !item.is_active)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            Version {item.version}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleRollbackTemplate}
                      disabled={
                        !rollbackTemplateId ||
                        rollbackTemplateMutation.isPending
                      }
                    >
                      {rollbackTemplateMutation.isPending
                        ? 'Rolling Back...'
                        : 'Rollback'}
                    </Button>
                  </div>
                </div>
              </div>

              <DynamicResultForm
                templateType={templateEditorType}
                categoryCode={templateEditorCategoryCode}
                value={templateEditorResult}
                onChange={(value) => setTemplateEditorResult(value)}
                testName={request.test?.test_name}
                unit={request.test?.unit || undefined}
                referenceRange={request.test?.normal_range || undefined}
                testParameters={testParameters}
                readOnly={false}
              />
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsTemplateEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveAsTemplate}
                disabled={saveTemplateMutation.isPending}
              >
                {saveTemplateMutation.isPending
                  ? 'Saving Template...'
                  : 'Save Template Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={isSaveTemplateConfirmOpen}
        onClose={() => setIsSaveTemplateConfirmOpen(false)}
        onConfirm={handleConfirmSaveAsTemplate}
        title="Save Template Changes"
        message={
          <span>
            Save this form structure as the default template for this test? This
            applies to newly opened forms only.
          </span>
        }
        confirmText="Save Template"
        cancelText="Cancel"
        variant="info"
        isLoading={saveTemplateMutation.isPending}
        zIndexClass="z-[90]"
      />
    </div>
  );
}

// =============================================================================
// Helper: Generate Result Summary from Structured Data
// =============================================================================

function generateResultSummary(
  structuredResult: StructuredResult | null,
  templateType: ResultTemplateType,
): string {
  if (!structuredResult) return '';

  switch (templateType) {
    case 'numeric_table':
    case 'panel_numeric': {
      const result = structuredResult as any;
      if (result.parameters && Array.isArray(result.parameters)) {
        const abnormal = result.parameters.filter(
          (p: any) => p.flag && p.flag !== 'Normal',
        );
        if (abnormal.length > 0) {
          return `${abnormal.length} parameter(s) abnormal: ${abnormal.map((p: any) => `${p.name || p.parameter} (${p.flag})`).join(', ')}`;
        }
        return 'All parameters within normal limits';
      }
      return '';
    }

    case 'culture_sensitivity': {
      const result = structuredResult as any;
      if (result.cultureResults && result.cultureResults.length > 0) {
        const organisms = result.cultureResults
          .map((c: any) => c.organismName)
          .filter(Boolean);
        if (organisms.length > 0) {
          return `Growth: ${organisms.join(', ')}`;
        }
      }
      return result.noGrowth ? 'No growth after 48 hours' : '';
    }

    case 'parasite_report': {
      const result = structuredResult as any;
      if (result.detected && result.parasitesFound?.length > 0) {
        return `Positive for: ${result.parasitesFound.map((p: any) => `${p.species} (${p.density})`).join(', ')}`;
      }
      return result.detected === false ? 'No parasites seen' : '';
    }

    case 'qualitative_quantitative': {
      const result = structuredResult as any;
      return result.qualitativeResult || '';
    }

    case 'urinalysis_checklist': {
      const result = structuredResult as any;
      const findings: string[] = [];
      if (result.chemicalExamination) {
        const chem = result.chemicalExamination;
        if (chem.protein && chem.protein !== 'Negative')
          findings.push(`Protein: ${chem.protein}`);
        if (chem.glucose && chem.glucose !== 'Negative')
          findings.push(`Glucose: ${chem.glucose}`);
        if (chem.blood && chem.blood !== 'Negative')
          findings.push(`Blood: ${chem.blood}`);
      }
      return findings.length > 0
        ? findings.join('; ')
        : 'Urinalysis within normal limits';
    }

    case 'narrative_diagnostic': {
      const result = structuredResult as any;
      return result.diagnosis || '';
    }

    case 'binary_metadata': {
      const result = structuredResult as any;
      if (result.detected === true) return 'DETECTED';
      if (result.detected === false) return 'NOT DETECTED';
      return 'INDETERMINATE';
    }

    default:
      return '';
  }
}

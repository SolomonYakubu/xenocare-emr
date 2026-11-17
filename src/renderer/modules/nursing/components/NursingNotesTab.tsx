/**
 * Nursing Reports Tab Component
 *
 * Allows nurses to view, create, and manage nursing reports
 * for patients who have been attended to by doctors (consultants).
 *
 * NOTE: Nurses can add reports WITHOUT requiring a treatment plan.
 * A patient only needs to have a consultation record.
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Clock,
  User,
  Filter,
  RefreshCw,
  X,
  Save,
  Stethoscope,
  Activity,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  Select,
  Textarea,
  Card,
  StatusBadge,
  EmptyState,
} from '../../../components/ui';
import { useToast } from '../../../components/ui/Toast';
import NotesTimeline, { TimelineNote } from './NotesTimeline';

import {
  getNursingNotes,
  getNursingNotesByEncounter,
  createNursingNote,
  updateNursingNote,
  deleteNursingNote,
  getNursingNotesStats,
} from '../api/nursing-notes.api';
import { getEncounterDetails } from '../../clinical-consultation/api/medical-records.api';
import {
  INTERVENTION_CATEGORIES,
  InterventionCategory,
  InterventionItem,
  getInterventionLabel,
  getCategoryColor,
  getCategoryIcon,
  getCategoryForIntervention,
} from '../config/intervention-codes.config';
import {
  NursingNoteDTO,
  CreateNursingNoteDTO,
  NursingNoteFilters,
  NURSING_NOTE_TYPES,
  NursingNoteType,
  PATIENT_CONDITIONS,
  PatientCondition,
  SHIFT_TYPES,
  ShiftType,
  getNoteTypeColor,
  getNoteTypeLabel,
  getConditionColor,
  getCurrentShift,
} from '../dtos/nursing-notes.dto';
import { createMultipleInterventions } from '../api/nursing-interventions.api';
import { formatPatientName } from '../../patient-registration/dtos/patient.dto';

// XenoCare Logo
// =============================================================================
// Types
// =============================================================================

interface NursingNotesTabProps {
  encounterId?: string;
  patientId?: string;
  patientName?: string;
  hideHeader?: boolean;
  compact?: boolean;
  hideStats?: boolean; // New prop to hide statistics
}

// Custom intervention type for dynamically added interventions
interface CustomIntervention {
  code: string;
  label: string;
  categoryCode: string;
}

interface NoteFormData {
  note_type: NursingNoteType;
  title: string;
  content: string;
  patient_condition?: PatientCondition;
  pain_level?: number;
  interventions_performed?: string;
  selected_interventions: Set<string>; // Set of intervention codes
  custom_interventions: CustomIntervention[]; // Dynamically added interventions
  patient_response?: string;
  follow_up_required: boolean;
  follow_up_notes?: string;
  shift: ShiftType;
  is_critical: boolean;
  requires_doctor_review: boolean;
}

// =============================================================================
// Inline Intervention Selector Component (Searchable + Add Custom)
// =============================================================================

interface InlineInterventionSelectorProps {
  selectedCodes: Set<string>;
  onToggle: (code: string, categoryCode: string) => void;
  customInterventions: CustomIntervention[];
  onAddCustomIntervention: (intervention: CustomIntervention) => void;
}

function InlineInterventionSelector({
  selectedCodes,
  onToggle,
  customInterventions,
  onAddCustomIntervention,
}: InlineInterventionSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [newInterventionText, setNewInterventionText] = useState('');
  const [selectedCategoryForNew, setSelectedCategoryForNew] =
    useState<string>('');
  const [showAddNew, setShowAddNew] = useState(false);

  // Merge built-in categories with custom interventions
  const categoriesWithCustom = React.useMemo(() => {
    const merged = INTERVENTION_CATEGORIES.map((cat) => ({
      ...cat,
      items: [
        ...cat.items,
        ...customInterventions
          .filter((ci) => ci.categoryCode === cat.categoryCode)
          .map((ci) => ({ code: ci.code, label: ci.label })),
      ],
    }));
    return merged;
  }, [customInterventions]);

  // Filter categories and items based on search
  const filteredCategories = React.useMemo(() => {
    if (!searchQuery.trim()) return categoriesWithCustom;

    const query = searchQuery.toLowerCase();
    return categoriesWithCustom
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.code.toLowerCase().includes(query),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categoriesWithCustom, searchQuery]);

  const toggleCategory = (categoryCode: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryCode)) {
        next.delete(categoryCode);
      } else {
        next.add(categoryCode);
      }
      return next;
    });
  };

  // Auto-expand categories with search results
  React.useEffect(() => {
    if (searchQuery.trim()) {
      const matchingCategories = filteredCategories.map((c) => c.categoryCode);
      setExpandedCategories(new Set(matchingCategories));
    }
  }, [searchQuery, filteredCategories]);

  // Handle adding new custom intervention
  const handleAddNewIntervention = () => {
    if (!newInterventionText.trim()) return;

    const code = `CUSTOM_${Date.now()}_${newInterventionText.toUpperCase().replace(/\s+/g, '_').substring(0, 20)}`;
    const categoryCode = selectedCategoryForNew || 'OTHER';

    onAddCustomIntervention({
      code,
      label: newInterventionText.trim(),
      categoryCode,
    });

    // Auto-select the new intervention
    onToggle(code, categoryCode);

    // Reset form
    setNewInterventionText('');
    setSelectedCategoryForNew('');
    setShowAddNew(false);
  };

  // Get selected intervention labels for display
  const getSelectedLabel = (code: string): string => {
    // Check built-in interventions
    for (const cat of INTERVENTION_CATEGORIES) {
      const item = cat.items.find((i) => i.code === code);
      if (item) return item.label;
    }
    // Check custom interventions
    const custom = customInterventions.find((ci) => ci.code === code);
    if (custom) return custom.label;
    return code;
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="🔍 Search interventions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 pl-10 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Selected interventions pills */}
      {selectedCodes.size > 0 && (
        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
              ✓ {selectedCodes.size} Selected
            </span>
            <button
              type="button"
              onClick={() => {
                Array.from(selectedCodes).forEach((code) => onToggle(code, ''));
              }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(selectedCodes).map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-white rounded-full border border-blue-200 text-blue-700 shadow-sm hover:shadow transition-shadow"
              >
                {getSelectedLabel(code)}
                <button
                  type="button"
                  onClick={() => onToggle(code, '')}
                  className="text-blue-400 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add New Intervention */}
      {!showAddNew ? (
        <button
          type="button"
          onClick={() => setShowAddNew(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border border-dashed border-blue-300 transition-colors"
        >
          <Plus size={16} />
          Add Custom Intervention
        </button>
      ) : (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-amber-800">
              Add New Intervention
            </span>
            <button
              type="button"
              onClick={() => {
                setShowAddNew(false);
                setNewInterventionText('');
                setSelectedCategoryForNew('');
              }}
              className="text-amber-500 hover:text-amber-700"
            >
              <X size={16} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Enter intervention name..."
            value={newInterventionText}
            onChange={(e) => setNewInterventionText(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            autoFocus
          />
          <select
            value={selectedCategoryForNew}
            onChange={(e) => setSelectedCategoryForNew(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white"
          >
            <option value="">Select category (or leave for Other)</option>
            {INTERVENTION_CATEGORIES.map((cat) => (
              <option key={cat.categoryCode} value={cat.categoryCode}>
                {cat.icon} {cat.category}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddNewIntervention}
            disabled={!newInterventionText.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Intervention
          </button>
        </div>
      )}

      {/* Category list */}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {filteredCategories.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-sm">
              No interventions found for "{searchQuery}"
            </p>
            <button
              type="button"
              onClick={() => {
                setNewInterventionText(searchQuery);
                setShowAddNew(true);
              }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add "{searchQuery}" as custom intervention
            </button>
          </div>
        ) : (
          filteredCategories.map((category) => {
            const isExpanded = expandedCategories.has(category.categoryCode);
            const selectedInCategory = category.items.filter((item) =>
              selectedCodes.has(item.code),
            ).length;

            return (
              <div
                key={category.categoryCode}
                className="border-b border-gray-100 last:border-b-0"
              >
                {/* Category header */}
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all ${
                    selectedInCategory > 0
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => toggleCategory(category.categoryCode)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{category.icon}</span>
                    <span className="font-medium text-gray-800">
                      {category.category}
                    </span>
                    {selectedInCategory > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full">
                        {selectedInCategory}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {category.items.length}
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={18} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Items */}
                {isExpanded && (
                  <div className="px-4 py-2 space-y-1 bg-white">
                    {category.items.map((item) => {
                      const isSelected = selectedCodes.has(item.code);
                      const isCustom = item.code.startsWith('CUSTOM_');

                      return (
                        <label
                          key={item.code}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-100 text-blue-800 shadow-sm'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              onToggle(item.code, category.categoryCode)
                            }
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className="flex-1 text-sm">{item.label}</span>
                          {isCustom && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-600 rounded">
                              Custom
                            </span>
                          )}
                          {isSelected && (
                            <svg
                              className="w-4 h-4 text-blue-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Note Card Component
// =============================================================================

interface NoteCardProps {
  note: NursingNoteDTO;
  onEdit: (note: NursingNoteDTO) => void;
  onDelete: (id: string) => void;
}

function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const [showFullContent, setShowFullContent] = useState(false);
  const isLongContent = note.content.length > 200;

  return (
    <div
      className={`p-4 rounded-lg border ${note.is_critical ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Note type badge */}
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getNoteTypeColor(note.note_type)}`}
          >
            {getNoteTypeLabel(note.note_type)}
          </span>

          <div className="flex-1">
            {/* Title */}
            {note.title && (
              <h4 className="font-medium text-gray-900">{note.title}</h4>
            )}

            {/* Condition & Pain */}
            <div className="flex items-center gap-3 mt-1">
              {note.patient_condition && (
                <span
                  className={`px-2 py-0.5 rounded text-xs ${getConditionColor(note.patient_condition)}`}
                >
                  {note.patient_condition}
                </span>
              )}
              {note.pain_level !== null && note.pain_level !== undefined && (
                <span className="text-xs text-gray-500">
                  Pain: {note.pain_level}/10
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {note.is_critical && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <AlertTriangle size={12} className="inline mr-1" />
              Critical
            </span>
          )}
          {note.requires_doctor_review && !note.doctor_reviewed_at && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Needs Review
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-3">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {showFullContent || !isLongContent
            ? note.content
            : `${note.content.substring(0, 200)}...`}
        </p>
        {isLongContent && (
          <button
            className="text-sm text-blue-600 hover:text-blue-700 mt-1"
            onClick={() => setShowFullContent(!showFullContent)}
          >
            {showFullContent ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Interventions & Response */}
      {note.interventions_performed && (
        <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
          <span className="font-medium text-blue-700">Interventions:</span>
          <span className="text-blue-600 ml-1">
            {note.interventions_performed}
          </span>
        </div>
      )}

      {note.patient_response && (
        <div className="mt-2 p-2 bg-green-50 rounded text-sm">
          <span className="font-medium text-green-700">Patient Response:</span>
          <span className="text-green-600 ml-1">{note.patient_response}</span>
        </div>
      )}

      {/* Follow-up */}
      {note.follow_up_required && note.follow_up_notes && (
        <div className="mt-2 p-2 bg-amber-50 rounded text-sm">
          <span className="font-medium text-amber-700">
            Follow-up Required:
          </span>
          <span className="text-amber-600 ml-1">{note.follow_up_notes}</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <User size={12} />
            {note.recorder?.first_name} {note.recorder?.last_name}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {new Date(note.created_at).toLocaleString()}
          </span>
          {note.shift && (
            <span>
              {note.shift === 'Morning' && '🌅'}
              {note.shift === 'Afternoon' && '☀️'}
              {note.shift === 'Night' && '🌙'}
              {note.shift}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
            onClick={() => onEdit(note)}
            title="Edit note"
          >
            <Edit size={14} />
          </button>
          <button
            className="p-1 text-gray-400 hover:text-red-600 rounded"
            onClick={() => onDelete(note.id)}
            title="Delete note"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Note Form Component
// =============================================================================

interface NoteFormSubmitData {
  noteData: CreateNursingNoteDTO;
  selectedInterventionCodes: string[];
  customInterventions: CustomIntervention[];
  shift: ShiftType;
}

interface NoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NoteFormSubmitData) => void;
  isSubmitting: boolean;
  encounterId?: string;
  patientId?: string;
  editingNote?: NursingNoteDTO | null;
}

function NoteForm({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  encounterId,
  patientId,
  editingNote,
}: NoteFormProps) {
  // Query: Encounter Details for Vitals
  const { data: encounterDetails } = useQuery({
    queryKey: ['encounter', encounterId],
    queryFn: () => getEncounterDetails(encounterId!),
    enabled: !!encounterId && isOpen,
  });

  const [formData, setFormData] = useState<NoteFormData>({
    note_type: 'Progress_Note',
    title: '',
    content: '',
    patient_condition: undefined,
    pain_level: undefined,
    interventions_performed: '',
    selected_interventions: new Set<string>(),
    custom_interventions: [],
    patient_response: '',
    follow_up_required: false,
    follow_up_notes: '',
    shift: getCurrentShift(),
    is_critical: false,
    requires_doctor_review: false,
  });

  // Reset form when opening/editing
  React.useEffect(() => {
    if (isOpen) {
      if (editingNote) {
        setFormData({
          note_type: editingNote.note_type,
          title: editingNote.title || '',
          content: editingNote.content,
          patient_condition: editingNote.patient_condition || undefined,
          pain_level: editingNote.pain_level || undefined,
          interventions_performed: editingNote.interventions_performed || '',
          selected_interventions: new Set<string>(),
          custom_interventions: [],
          patient_response: editingNote.patient_response || '',
          follow_up_required: editingNote.follow_up_required,
          follow_up_notes: editingNote.follow_up_notes || '',
          shift: (editingNote.shift as ShiftType) || getCurrentShift(),
          is_critical: editingNote.is_critical,
          requires_doctor_review: editingNote.requires_doctor_review,
        });
      } else {
        setFormData({
          note_type: 'Progress_Note',
          title: '',
          content: '',
          patient_condition: undefined,
          pain_level: undefined,
          interventions_performed: '',
          selected_interventions: new Set<string>(),
          custom_interventions: [],
          patient_response: '',
          follow_up_required: false,
          follow_up_notes: '',
          shift: getCurrentShift(),
          is_critical: false,
          requires_doctor_review: false,
        });
      }
    }
  }, [isOpen, editingNote]);

  // Handle adding custom intervention
  const handleAddCustomIntervention = (intervention: CustomIntervention) => {
    setFormData((prev) => ({
      ...prev,
      custom_interventions: [...prev.custom_interventions, intervention],
    }));
  };

  // Handle intervention toggle
  const handleInterventionToggle = (code: string, categoryCode: string) => {
    setFormData((prev) => {
      const newSet = new Set(prev.selected_interventions);
      if (newSet.has(code)) {
        newSet.delete(code);
        if (code === 'OTHER_CUSTOM') {
          return {
            ...prev,
            selected_interventions: newSet,
            custom_intervention: '',
          };
        }
      } else {
        newSet.add(code);
      }
      return { ...prev, selected_interventions: newSet };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!encounterId || !patientId) {
      return;
    }

    // Build interventions string from selected codes
    let interventionsText = formData.interventions_performed || '';
    if (formData.selected_interventions.size > 0) {
      const selectedLabels = Array.from(formData.selected_interventions).map(
        (code) => {
          // Check if it's a custom intervention
          const customIntv = formData.custom_interventions.find(
            (ci) => ci.code === code,
          );
          if (customIntv) {
            return customIntv.label;
          }
          return getInterventionLabel(code);
        },
      );
      interventionsText = selectedLabels.join(', ');
    }

    const noteData: CreateNursingNoteDTO = {
      encounter_id: encounterId,
      patient_id: patientId,
      note_type: formData.note_type,
      title: formData.title || undefined,
      content: formData.content,
      patient_condition: formData.patient_condition,
      pain_level: formData.pain_level,
      interventions_performed: interventionsText || undefined,
      patient_response: formData.patient_response || undefined,
      follow_up_required: formData.follow_up_required,
      follow_up_notes: formData.follow_up_notes || undefined,
      shift: formData.shift,
      is_critical: formData.is_critical,
      requires_doctor_review: formData.requires_doctor_review,
    };

    // Pass both the note data AND the intervention codes for bulk saving
    onSubmit({
      noteData,
      selectedInterventionCodes: Array.from(formData.selected_interventions),
      customInterventions: formData.custom_interventions,
      shift: formData.shift,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container - Full Screen */}
      <div className="flex min-h-full items-center justify-center p-2">
        <div
          className="relative bg-white rounded-lg shadow-2xl w-full max-w-[96vw] transform transition-all h-[96vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with NDC Branding */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingNote ? 'Edit Nursing Report' : 'Add Nursing Report'}
                  </h2>
                  <p className="text-blue-100 text-xs">
                    XenoCare - Nursing Documentation
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
              id="nursing-report-form"
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Latest Vitals Display */}
              {encounterDetails?.vitals && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <h4 className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase mb-2">
                    <Activity size={14} className="text-primary-700" />
                    Latest Vitals from Encounter
                  </h4>
                  <div className="grid grid-cols-6 gap-3 text-sm">
                    {encounterDetails.vitals.blood_pressure && (
                      <div>
                        <span className="text-slate-500 text-xs block">BP</span>
                        <span className="font-semibold">
                          {typeof encounterDetails.vitals.blood_pressure ===
                            'object' &&
                          'systolic' in encounterDetails.vitals.blood_pressure
                            ? `${encounterDetails.vitals.blood_pressure.systolic}/${encounterDetails.vitals.blood_pressure.diastolic}`
                            : (encounterDetails.vitals
                                .blood_pressure as string)}
                        </span>
                      </div>
                    )}
                    {encounterDetails.vitals.heart_rate && (
                      <div>
                        <span className="text-slate-500 text-xs block">
                          Heart Rate
                        </span>
                        <span className="font-semibold">
                          {encounterDetails.vitals.heart_rate} bpm
                        </span>
                      </div>
                    )}
                    {encounterDetails.vitals.respiratory_rate && (
                      <div>
                        <span className="text-slate-500 text-xs block">
                          Resp. Rate
                        </span>
                        <span className="font-semibold">
                          {encounterDetails.vitals.respiratory_rate} min
                        </span>
                      </div>
                    )}
                    {encounterDetails.vitals.temperature && (
                      <div>
                        <span className="text-slate-500 text-xs block">
                          Temp
                        </span>
                        <span className="font-semibold">
                          {encounterDetails.vitals.temperature}°C
                        </span>
                      </div>
                    )}
                    {encounterDetails.vitals.oxygen_saturation && (
                      <div>
                        <span className="text-slate-500 text-xs block">
                          SpO2
                        </span>
                        <span className="font-semibold">
                          {encounterDetails.vitals.oxygen_saturation}%
                        </span>
                      </div>
                    )}
                    {encounterDetails.vitals.weight && (
                      <div>
                        <span className="text-slate-500 text-xs block">
                          Weight
                        </span>
                        <span className="font-semibold">
                          {encounterDetails.vitals.weight}kg
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Note Type & Title - side by side */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Type *
                  </label>
                  <Select
                    value={formData.note_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        note_type: e.target.value as NursingNoteType,
                      })
                    }
                    required
                  >
                    {NURSING_NOTE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {getNoteTypeLabel(type)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title (Optional)
                  </label>
                  <Input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Brief title for the note..."
                  />
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note Content *
                </label>
                <Textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  placeholder="Enter detailed nursing observations..."
                  rows={6}
                  required
                />
              </div>

              {/* Patient Condition, Pain Level & Shift - 3 columns */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Condition
                  </label>
                  <Select
                    value={formData.patient_condition || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        patient_condition:
                          (e.target.value as PatientCondition) || undefined,
                      })
                    }
                  >
                    <option value="">Select condition...</option>
                    {PATIENT_CONDITIONS.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pain Level (0-10)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={formData.pain_level ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pain_level: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="0-10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shift
                  </label>
                  <Select
                    value={formData.shift}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shift: e.target.value as ShiftType,
                      })
                    }
                  >
                    {SHIFT_TYPES.map((shift) => (
                      <option key={shift} value={shift}>
                        {shift === 'Morning' && '\u{1F305} '}
                        {shift === 'Afternoon' && '\u2600\uFE0F '}
                        {shift === 'Night' && '\u{1F319} '}
                        {shift}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Interventions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Activity size={16} className="inline mr-1" />
                  Interventions Performed
                </label>
                <InlineInterventionSelector
                  selectedCodes={formData.selected_interventions}
                  onToggle={handleInterventionToggle}
                  customInterventions={formData.custom_interventions}
                  onAddCustomIntervention={handleAddCustomIntervention}
                />
              </div>

              {/* Patient Response & Follow-up side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Response
                  </label>
                  <Textarea
                    value={formData.patient_response}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        patient_response: e.target.value,
                      })
                    }
                    placeholder="Document patient's response to care..."
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.follow_up_required}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          follow_up_required: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Follow-up Required
                    </span>
                  </label>

                  {formData.follow_up_required && (
                    <Textarea
                      value={formData.follow_up_notes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          follow_up_notes: e.target.value,
                        })
                      }
                      placeholder="Specify follow-up actions needed..."
                      rows={2}
                    />
                  )}
                </div>
              </div>

              {/* Flags */}
              <div className="flex items-center gap-6 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700">Flags:</h4>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_critical}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_critical: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    <AlertTriangle
                      size={14}
                      className="inline mr-1 text-red-500"
                    />
                    Mark as Critical
                  </span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.requires_doctor_review}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        requires_doctor_review: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    <Stethoscope
                      size={14}
                      className="inline mr-1 text-amber-500"
                    />
                    Requires Doctor Review
                  </span>
                </label>
              </div>
            </form>
          </div>

          {/* Footer with Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-3 border-t bg-gray-50 flex-shrink-0">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              icon={X}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="nursing-report-form"
              variant="primary"
              disabled={isSubmitting || !formData.content}
              icon={Save}
            >
              {isSubmitting
                ? 'Saving...'
                : editingNote
                  ? 'Update Note'
                  : 'Save Note'}
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

export default function NursingNotesTab({
  encounterId,
  patientId,
  patientName,
  hideHeader = false,
  compact = false,
  hideStats = false,
}: NursingNotesTabProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NursingNoteDTO | null>(null);
  const [noteTypeFilter, setNoteTypeFilter] = useState<NursingNoteType | ''>(
    '',
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Query: Get nursing notes
  const {
    data: notesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['nursing-notes', encounterId, patientId],
    queryFn: async () => {
      const filters: NursingNoteFilters = {
        limit: 50,
      };
      if (encounterId) {
        filters.encounter_id = encounterId;
      } else if (patientId) {
        filters.patient_id = patientId;
      }
      return getNursingNotes(filters);
    },
    staleTime: 30000,
  });

  // Query: Get stats
  const { data: stats } = useQuery({
    queryKey: ['nursing-notes-stats'],
    queryFn: getNursingNotesStats,
    staleTime: 60000,
  });

  // Query: Get encounter details for vitals
  const { data: encounterDetails } = useQuery({
    queryKey: ['encounter', encounterId],
    queryFn: () => getEncounterDetails(encounterId!),
    enabled: !!encounterId && isFormOpen,
  });

  // Mutation: Create note
  const createMutation = useMutation({
    mutationFn: createNursingNote,
    onSuccess: () => {
      showToast({
        type: 'success',
        title: 'Report Saved',
        message: 'Nursing report created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      queryClient.invalidateQueries({ queryKey: ['clinical-timeline'] });
      setIsFormOpen(false);
    },
    onError: (error: Error) => {
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to create note',
      });
    },
  });

  // Mutation: Update note
  const updateMutation = useMutation({
    mutationFn: updateNursingNote,
    onSuccess: () => {
      showToast({
        type: 'success',
        title: 'Report Updated',
        message: 'Nursing report updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      queryClient.invalidateQueries({ queryKey: ['clinical-timeline'] });
      setIsFormOpen(false);
      setEditingNote(null);
    },
    onError: (error: Error) => {
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to update note',
      });
    },
  });

  // Mutation: Delete note
  const deleteMutation = useMutation({
    mutationFn: deleteNursingNote,
    onSuccess: () => {
      showToast({
        type: 'success',
        title: 'Report Deleted',
        message: 'Nursing report deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      queryClient.invalidateQueries({ queryKey: ['clinical-timeline'] });
    },
    onError: (error: Error) => {
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to delete note',
      });
    },
  });

  const handleSubmit = async (submitData: NoteFormSubmitData) => {
    const { noteData, selectedInterventionCodes, customInterventions, shift } =
      submitData;

    if (editingNote) {
      updateMutation.mutate({
        id: editingNote.id,
        note_type: noteData.note_type,
        title: noteData.title,
        content: noteData.content,
        patient_condition: noteData.patient_condition,
        pain_level: noteData.pain_level,
        interventions_performed: noteData.interventions_performed,
        patient_response: noteData.patient_response,
        follow_up_required: noteData.follow_up_required,
        follow_up_notes: noteData.follow_up_notes,
        is_critical: noteData.is_critical,
        requires_doctor_review: noteData.requires_doctor_review,
      });
    } else {
      // First, create the nursing note
      createMutation.mutate(noteData, {
        onSuccess: async () => {
          // Then, also save interventions to the nursing_interventions table for charts
          if (
            selectedInterventionCodes.length > 0 &&
            encounterId &&
            patientId
          ) {
            try {
              const interventions = selectedInterventionCodes.map((code) => {
                const customIntv = customInterventions.find(
                  (ci) => ci.code === code,
                );
                const category = getCategoryForIntervention(code);
                return {
                  intervention_code: code,
                  category_code: category?.categoryCode || 'OTHER',
                  custom_description: customIntv?.label || undefined,
                };
              });

              await createMultipleInterventions({
                encounter_id: encounterId,
                patient_id: patientId,
                shift,
                interventions,
              });

              // Invalidate intervention charts cache
              queryClient.invalidateQueries({
                queryKey: ['nursing-interventions', encounterId],
              });
            } catch (error) {
              console.error('Failed to save intervention records:', error);
              // Don't show error toast - the note was saved successfully
            }
          }
        },
      });
    }
  };

  const handleEdit = (note: NursingNoteDTO) => {
    setEditingNote(note);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (
      window.confirm('Are you sure you want to delete this nursing report?')
    ) {
      deleteMutation.mutate(id);
    }
  };

  // Filter notes
  const filteredNotes = (notesData?.data || []).filter((note) => {
    if (noteTypeFilter && note.note_type !== noteTypeFilter) return false;
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const matchesTitle = note.title?.toLowerCase().includes(search);
      const matchesContent = note.content.toLowerCase().includes(search);
      if (!matchesTitle && !matchesContent) return false;
    }
    return true;
  });

  const canAddNote = encounterId && patientId;

  // Print nursing notes report
  const handlePrintNursingReport = () => {
    // Build logo as base64 for HTML
    let logoBase64 = '';
    try {
      logoBase64 = '';
    } catch (e) {
      console.warn('Could not load XenoCare logo for print');
    }

    const reportDate = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nursing Report - ${patientName || 'Patient'}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
    }
    .action-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #006838 0%, #008C45 100%);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .action-bar-title {
      color: white;
      font-size: 14pt;
      font-weight: 600;
    }
    .action-buttons {
      display: flex;
      gap: 10px;
    }
    .action-btn {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 10pt;
      font-weight: 500;
      transition: all 0.2s;
    }
    .print-btn {
      background: white;
      color: #006838;
    }
    .print-btn:hover {
      background: #f0f0f0;
    }
    .close-btn {
      background: rgba(255,255,255,0.2);
      color: white;
    }
    .close-btn:hover {
      background: rgba(255,255,255,0.3);
    }
    .container {
      max-width: 210mm;
      margin: 80px auto 20px;
      padding: 0 10mm;
    }
    @media print {
      .action-bar {
        display: none !important;
      }
      .container {
        margin: 0 auto;
        padding: 0;
      }
    }
    .header {
      text-align: center;
      padding-bottom: 15px;
      border-bottom: 3px solid #006838;
      margin-bottom: 20px;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 10px;
    }
    .logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .hospital-name {
      font-size: 18pt;
      font-weight: bold;
      color: #006838;
      margin-bottom: 3px;
    }
    .hospital-subtitle {
      font-size: 10pt;
      color: #555;
    }
    .report-title {
      font-size: 14pt;
      font-weight: bold;
      color: #006838;
      text-align: center;
      margin: 15px 0;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 5px;
    }
    .patient-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding: 12px;
      background: #f0f9f4;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #006838;
    }
    .info-item {
      display: flex;
      gap: 8px;
    }
    .info-label {
      font-weight: 600;
      color: #006838;
      min-width: 80px;
    }
    .info-value {
      color: #333;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      color: #006838;
      padding: 8px 12px;
      background: #e8f5e9;
      border-left: 4px solid #006838;
      margin-bottom: 10px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .stat-card {
      padding: 12px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-card.total { background: #f8f9fa; border: 1px solid #dee2e6; }
    .stat-card.today { background: #e3f2fd; border: 1px solid #90caf9; }
    .stat-card.critical { background: #ffebee; border: 1px solid #ef9a9a; }
    .stat-card.pending { background: #fff8e1; border: 1px solid #ffe082; }
    .stat-value {
      font-size: 18pt;
      font-weight: bold;
    }
    .stat-card.total .stat-value { color: #333; }
    .stat-card.today .stat-value { color: #1976d2; }
    .stat-card.critical .stat-value { color: #c62828; }
    .stat-card.pending .stat-value { color: #f57c00; }
    .stat-label {
      font-size: 9pt;
      color: #666;
    }
    .note-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .note-card.critical {
      border-color: #ef9a9a;
      background: #fff5f5;
    }
    .note-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }
    .note-type {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 9pt;
      font-weight: 500;
    }
    .note-type.progress { background: #e3f2fd; color: #1565c0; }
    .note-type.assessment { background: #f3e5f5; color: #7b1fa2; }
    .note-type.intervention { background: #e8f5e9; color: #2e7d32; }
    .note-type.observation { background: #fff3e0; color: #ef6c00; }
    .note-type.medication { background: #fce4ec; color: #c2185b; }
    .note-type.procedure { background: #e1f5fe; color: #0277bd; }
    .note-type.handover { background: #f1f8e9; color: #558b2f; }
    .note-type.critical_alert { background: #ffebee; color: #c62828; }
    .note-badges {
      display: flex;
      gap: 6px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 8pt;
      font-weight: 500;
    }
    .badge.critical { background: #ffcdd2; color: #c62828; }
    .badge.review { background: #ffe0b2; color: #ef6c00; }
    .badge.condition { background: #e0e0e0; color: #424242; }
    .note-title {
      font-weight: 600;
      font-size: 11pt;
      color: #333;
      margin-bottom: 5px;
    }
    .note-content {
      font-size: 10pt;
      color: #555;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .note-details {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #ddd;
    }
    .detail-box {
      background: #f8f9fa;
      padding: 8px 10px;
      border-radius: 5px;
      margin-bottom: 6px;
      font-size: 10pt;
    }
    .detail-box.intervention { background: #e3f2fd; }
    .detail-box.response { background: #e8f5e9; }
    .detail-box.followup { background: #fff8e1; }
    .detail-label {
      font-weight: 600;
      color: #006838;
    }
    .note-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #eee;
      font-size: 9pt;
      color: #888;
    }
    .footer-info {
      display: flex;
      gap: 15px;
    }
    .signature-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .signature-block {
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin: 40px 20px 5px;
    }
    .signature-label {
      font-size: 10pt;
      color: #555;
    }
    .signature-sublabel {
      font-size: 9pt;
      color: #888;
    }
    .page-footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #006838;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    .no-notes {
      text-align: center;
      padding: 40px;
      color: #888;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <span class="action-bar-title">Nursing Report - ${patientName || 'Patient'}</span>
    <div class="action-buttons">
      <button class="action-btn print-btn" onclick="window.print()">🖨️ Print Report</button>
      <button class="action-btn close-btn" onclick="window.close()">✕ Close</button>
    </div>
  </div>

  <div class="container">
    <div class="header">
      <div class="logo">
        ${logoBase64 ? `<img src="${logoBase64}" alt="XenoCare Logo">` : '<div style="width:80px;height:80px;background:#006838;border-radius:50%;"></div>'}
      </div>
      <div class="hospital-name">XENOCARE</div>
      <div class="hospital-subtitle">XenoCare</div>
    </div>

    <div class="report-title">
      NURSING CARE REPORT
    </div>

    <div class="patient-info">
      <div class="info-item">
        <span class="info-label">Patient:</span>
        <span class="info-value">${patientName || 'N/A'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Report Date:</span>
        <span class="info-value">${reportDate}</span>
      </div>
      ${
        encounterId
          ? `
      <div class="info-item">
        <span class="info-label">Encounter:</span>
        <span class="info-value">${encounterId.substring(0, 8).toUpperCase()}</span>
      </div>
      `
          : ''
      }
      <div class="info-item">
        <span class="info-label">Total Notes:</span>
        <span class="info-value">${filteredNotes.length}</span>
      </div>
    </div>

    <!-- Statistics -->
    <div class="stats-grid">
      <div class="stat-card total">
        <div class="stat-value">${notesData?.total || 0}</div>
        <div class="stat-label">Total Reports</div>
      </div>
      <div class="stat-card today">
        <div class="stat-value">${stats?.notes_today || 0}</div>
        <div class="stat-label">Today</div>
      </div>
      <div class="stat-card critical">
        <div class="stat-value">${stats?.critical_notes || 0}</div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-value">${stats?.pending_review || 0}</div>
        <div class="stat-label">Pending Review</div>
      </div>
    </div>

    <!-- Nursing Notes -->
    <div class="section">
      <div class="section-title">Nursing Notes & Observations</div>
      ${
        filteredNotes.length > 0
          ? filteredNotes
              .map(
                (note) => `
        <div class="note-card ${note.is_critical ? 'critical' : ''}">
          <div class="note-header">
            <div>
              <span class="note-type ${note.note_type.toLowerCase()}">${getNoteTypeLabel(note.note_type)}</span>
              ${note.patient_condition ? `<span class="badge condition" style="margin-left: 8px;">${note.patient_condition}</span>` : ''}
              ${note.pain_level !== null && note.pain_level !== undefined ? `<span class="badge condition" style="margin-left: 8px;">Pain: ${note.pain_level}/10</span>` : ''}
            </div>
            <div class="note-badges">
              ${note.is_critical ? '<span class="badge critical">⚠ Critical</span>' : ''}
              ${note.requires_doctor_review && !note.doctor_reviewed_at ? '<span class="badge review">Needs Review</span>' : ''}
            </div>
          </div>
          ${note.title ? `<div class="note-title">${note.title}</div>` : ''}
          <div class="note-content">${note.content}</div>
          ${
            note.interventions_performed ||
            note.patient_response ||
            (note.follow_up_required && note.follow_up_notes)
              ? `
          <div class="note-details">
            ${
              note.interventions_performed
                ? `
            <div class="detail-box intervention">
              <span class="detail-label">Interventions:</span> ${note.interventions_performed}
            </div>
            `
                : ''
            }
            ${
              note.patient_response
                ? `
            <div class="detail-box response">
              <span class="detail-label">Patient Response:</span> ${note.patient_response}
            </div>
            `
                : ''
            }
            ${
              note.follow_up_required && note.follow_up_notes
                ? `
            <div class="detail-box followup">
              <span class="detail-label">Follow-up Required:</span> ${note.follow_up_notes}
            </div>
            `
                : ''
            }
          </div>
          `
              : ''
          }
          <div class="note-footer">
            <div class="footer-info">
              <span>👤 ${note.recorder?.first_name || ''} ${note.recorder?.last_name || ''}</span>
              <span>🕐 ${new Date(note.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              ${note.shift ? `<span>${note.shift === 'Morning' ? '🌅' : note.shift === 'Afternoon' ? '☀️' : '🌙'} ${note.shift}</span>` : ''}
            </div>
          </div>
        </div>
      `,
              )
              .join('')
          : `
        <div class="no-notes">
          No nursing notes found for this patient/encounter.
        </div>
      `
      }
    </div>

    <!-- Signatures -->
    <div class="signature-section">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">Reviewing Nurse</div>
        <div class="signature-sublabel">Signature / Date</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">Head Nurse / Supervisor</div>
        <div class="signature-sublabel">Signature / Date</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="page-footer">
      <strong>XenoCare</strong> | XenoCare<br>
      This is an official medical document. Handle with confidentiality.<br>
      Generated: ${reportDate}
    </div>
  </div>
</body>
</html>
    `;

    // Open in new window for printing
    if (window.electron?.html?.saveAndOpen) {
      const filename = `nursing_report_${patientName?.replace(/\s+/g, '_') || 'patient'}_${new Date().toISOString().split('T')[0]}.html`;
      window.electron.html.saveAndOpen(filename, htmlContent);
    } else {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      }
    }
  };

  return (
    <div className={`space-y-4 ${compact ? 'p-0' : ''}`}>
      {/* Header */}
      {!hideHeader && (
        <div
          className={`flex items-center justify-between ${compact ? 'mb-2' : ''}`}
        >
          {!compact && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Nursing Reports
              </h2>
              <p className="text-sm text-gray-500">
                {patientName
                  ? `Reports for ${patientName}`
                  : 'Document observations and progress reports'}
              </p>
            </div>
          )}
          <div
            className={`flex items-center gap-2 ${compact ? 'w-full justify-end' : ''}`}
          >
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => refetch()}
              disabled={isLoading}
              className={
                compact
                  ? 'rounded-lg text-xs font-bold uppercase tracking-wider'
                  : ''
              }
            >
              Refresh
            </Button>
            {canAddNote && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingNote(null);
                  setIsFormOpen(true);
                }}
                className={
                  compact
                    ? 'rounded-lg text-xs font-bold uppercase tracking-wider'
                    : ''
                }
              >
                Add Report
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!hideStats && (
        <div
          className={`grid ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-4'} gap-4`}
        >
          <div
            className={`${compact ? 'p-3' : 'p-4'} bg-white rounded-xl border border-gray-100 shadow-sm`}
          >
            <p
              className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-slate-800`}
            >
              {notesData?.total || 0}
            </p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Total
            </p>
          </div>
          <div
            className={`${compact ? 'p-3' : 'p-4'} bg-blue-50/50 rounded-xl border border-blue-100 shadow-sm`}
          >
            <p
              className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-blue-600`}
            >
              {stats?.notes_today || 0}
            </p>
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">
              Today
            </p>
          </div>
          <div
            className={`${compact ? 'p-3' : 'p-4'} bg-red-50/50 rounded-xl border border-red-100 shadow-sm`}
          >
            <p
              className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-red-600`}
            >
              {stats?.critical_notes || 0}
            </p>
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest">
              Critical
            </p>
          </div>
          <div
            className={`${compact ? 'p-3' : 'p-4'} bg-amber-50/50 rounded-xl border border-amber-100 shadow-sm`}
          >
            <p
              className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-amber-600`}
            >
              {stats?.pending_review || 0}
            </p>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              Pending
            </p>
          </div>
        </div>
      )}

      {/* No encounter/patient selected warning */}
      {!encounterId && !patientId && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-700 text-sm">
            <AlertTriangle size={16} className="inline mr-2" />
            Select a patient who has been attended to by a consultant to add
            nursing reports.
          </p>
        </div>
      )}

      {/* Filters */}
      <div
        className={`flex flex-col md:flex-row items-center gap-4 ${compact ? 'bg-slate-50/50 p-3 rounded-xl border border-slate-100' : ''}`}
      >
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-gray-400" />
          <Select
            value={noteTypeFilter}
            onChange={(e) =>
              setNoteTypeFilter(e.target.value as NursingNoteType | '')
            }
            className={`${compact ? 'h-9 text-xs' : 'w-48'} w-full md:w-48`}
          >
            <option value="">All Types</option>
            {NURSING_NOTE_TYPES.map((type) => (
              <option key={type} value={type}>
                {getNoteTypeLabel(type)}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative w-full">
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${compact ? 'h-9 text-xs pl-8' : 'w-64'}`}
          />
          {compact && (
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </div>
          )}
        </div>
      </div>

      {/* Notes Timeline View */}
      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading nursing reports...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={compact ? '' : 'No Nursing Reports'}
          description={
            encounterId || patientId
              ? 'No reports found for this session'
              : 'Select a patient to view reports'
          }
          action={
            canAddNote ? (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => {
                  setEditingNote(null);
                  setIsFormOpen(true);
                }}
              >
                Add First Report
              </Button>
            ) : undefined
          }
        />
      ) : (
        <NotesTimeline
          notes={filteredNotes.map(
            (note): TimelineNote => ({
              id: note.id,
              type: 'nursing',
              timestamp: note.created_at,
              title: note.title || getNoteTypeLabel(note.note_type),
              note_type: note.note_type,
              author: note.recorder
                ? {
                    first_name: note.recorder.first_name,
                    last_name: note.recorder.last_name,
                    role: 'Nurse',
                  }
                : undefined,
              content: note.content,
              patient_condition: note.patient_condition || undefined,
              is_critical: note.is_critical || false,
              shift: note.shift as
                | 'morning'
                | 'afternoon'
                | 'night'
                | undefined,
              interventions_performed:
                note.interventions_performed || undefined,
              patient_response: note.patient_response || undefined,
              pain_level: note.pain_level,
              follow_up_required: note.follow_up_required || false,
              follow_up_notes: note.follow_up_notes || undefined,
              requires_doctor_review: note.requires_doctor_review || false,
              doctor_reviewed_at: note.doctor_reviewed_at || undefined,
              raw: note,
            }),
          )}
          title={compact ? undefined : 'Nursing Notes Timeline'}
          emptyMessage="No nursing reports have been documented yet."
          showDateHeaders
          onNoteEdit={(note) => {
            if (note.raw) {
              handleEdit(note.raw as NursingNoteDTO);
            }
          }}
          onNoteDelete={(note) => {
            if (note.raw) {
              handleDelete((note.raw as NursingNoteDTO).id);
            }
          }}
        />
      )}

      {/* Note Form */}
      <NoteForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingNote(null);
        }}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        encounterId={encounterId}
        patientId={patientId}
        editingNote={editingNote}
      />
    </div>
  );
}

import React, { useState } from 'react';
import {
  X,
  Save,
  Pill,
  User,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Minus,
  Plus,
  AlertTriangle,
  Info,
  Printer,
  ClipboardCheck,
  Edit3,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Button, Input, Textarea } from '../../../components/ui';
import { useTimeTheme } from '../../../hooks/useTimeTheme';
import {
  PrescriptionDTO,
  validateDispenseForm,
  DispenseFormErrors,
  formatPrescriptionDetails,
  getStockLevelColor,
  getDrugCategoryColor,
  getDrugTypeColor,
  DISPENSE_STATUS,
  DispenseStatusType,
} from '../dtos/pharmacy.dto';
import {
  formatPatientName,
  formatDetailedAge,
} from '../../patient-registration/dtos/patient.dto';

// =============================================================================
// Types
// =============================================================================

interface DispenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (quantity: number, notes?: string) => Promise<void>;
  isLoading?: boolean;
  prescription: PrescriptionDTO | null;
  queueInfo?: {
    currentIndex: number;
    total: number;
  };
}

// =============================================================================
// Component
// =============================================================================

export default function DispenseForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  prescription,
  queueInfo,
}: DispenseFormProps) {
  const { isNightMode } = useTimeTheme();
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [dosageInstructions, setDosageInstructions] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isEditingDosage, setIsEditingDosage] = useState(false);
  const [errors, setErrors] = useState<DispenseFormErrors>({});

  React.useEffect(() => {
    if (isOpen && prescription) {
      const remaining =
        prescription.quantity_prescribed -
        (prescription.quantity_dispensed || 0);
      const available = prescription.drug?.quantity_in_stock || 0;
      setQuantity(Math.min(remaining, available));
      setNotes('');
      setDosageInstructions(formatPrescriptionDetails(prescription));
      setSpecialInstructions(prescription.special_instructions || '');
      setIsEditingDosage(false);
      setErrors({});
    }
  }, [isOpen, prescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prescription) return;

    const available = prescription.drug?.quantity_in_stock || 0;
    const validationErrors = validateDispenseForm(
      quantity,
      available,
      prescription.quantity_prescribed,
      prescription.quantity_dispensed || 0,
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    await onSubmit(quantity, notes || undefined);
    onClose();
  };

  const incrementQuantity = () => {
    const remaining = prescription
      ? prescription.quantity_prescribed -
        (prescription.quantity_dispensed || 0)
      : 0;
    const available = prescription?.drug?.quantity_in_stock || 0;
    const max = Math.min(remaining, available);
    if (quantity < max) setQuantity(quantity + 1);
  };

  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  if (!isOpen || !prescription) return null;

  const remaining =
    prescription.quantity_prescribed - (prescription.quantity_dispensed || 0);
  const available = prescription.drug?.quantity_in_stock || 0;
  const isOutOfStock = available === 0;
  const isLowStock =
    available > 0 && available <= (prescription.drug?.reorder_level || 10);
  const canDispense = available > 0 && quantity > 0 && quantity <= remaining;

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
          className={`relative ${isNightMode ? 'bg-slate-800' : 'bg-gray-50'} rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border ${isNightMode ? 'border-slate-700' : 'border-gray-200'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* EMR Header with NDC Branding */}
          <div className="bg-white border-b border-gray-200 flex-shrink-0">
            {/* Top Bar with Logo and Title */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600">
              <div className="flex items-center gap-4">
                <div className="border-l border-white/30 pl-4">
                  <h1 className="text-white font-bold text-lg tracking-wide">
                    XENOCARE
                  </h1>
                  <p className="text-green-100 text-xs font-medium">
                    Medical Centre - Pharmacy Dispensing
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-4">
                  <p className="text-white text-sm font-medium">
                    DISPENSE MEDICATION
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

          {/* Form Content */}
          <form
            id="dispense-form"
            onSubmit={handleSubmit}
            className={`flex-1 overflow-y-auto ${isNightMode ? 'bg-slate-800' : 'bg-white'}`}
          >
            <div className="p-6 space-y-5">
              {/* Queue Progress Indicator */}
              {queueInfo && queueInfo.total > 1 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">
                        Dispensing {queueInfo.currentIndex} of {queueInfo.total}{' '}
                        medications
                      </span>
                    </div>
                    <span className="text-sm text-blue-600">
                      {queueInfo.total - queueInfo.currentIndex} remaining
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(queueInfo.currentIndex / queueInfo.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Patient Information Section */}
              <div
                className={`${isNightMode ? 'bg-slate-700' : 'bg-white'} rounded-xl border ${isNightMode ? 'border-slate-600' : 'border-gray-200'} p-5 shadow-sm`}
              >
                <div
                  className={`flex items-center gap-3 mb-4 pb-3 border-b ${isNightMode ? 'border-slate-600' : 'border-gray-100'}`}
                >
                  <div className="p-2.5 bg-blue-100 rounded-xl">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3
                      className={`text-base font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                    >
                      Patient Information
                    </h3>
                    <p className="text-xs text-gray-500">
                      Prescription recipient details
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {prescription.patient?.first_name?.charAt(0)}
                    {prescription.patient?.surname?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4
                      className={`text-lg font-semibold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                    >
                      {prescription.patient
                        ? formatPatientName(prescription.patient)
                        : 'Unknown Patient'}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{prescription.patient?.gender || 'N/A'}</span>
                      <span>•</span>
                      <span>
                        {prescription.patient?.date_of_birth
                          ? `${formatDetailedAge(prescription.patient.date_of_birth)}`
                          : 'N/A'}
                      </span>
                      <span>•</span>
                      <span>
                        {prescription.patient?.contact_phone || 'No phone'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Medication Details Section */}
              <div
                className={`${isNightMode ? 'bg-slate-700' : 'bg-white'} rounded-xl border ${isNightMode ? 'border-slate-600' : 'border-gray-200'} p-5 shadow-sm`}
              >
                <div
                  className={`flex items-center gap-3 mb-4 pb-3 border-b ${isNightMode ? 'border-slate-600' : 'border-gray-100'}`}
                >
                  <div className="p-2.5 bg-purple-100 rounded-xl">
                    <Pill className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3
                      className={`text-base font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                    >
                      Medication Details
                    </h3>
                    <p className="text-xs text-gray-500">
                      Drug information and dosage instructions
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                    <div>
                      <h4
                        className={`font-bold ${isNightMode ? 'text-slate-900' : 'text-gray-900'} text-lg`}
                      >
                        {prescription.drug?.drug_name}
                      </h4>
                      {prescription.drug?.brand_name && (
                        <p className="text-sm text-purple-600 font-medium">
                          Brand: {prescription.drug.brand_name}
                        </p>
                      )}
                      <p className="text-sm text-purple-700 font-medium mt-0.5">
                        {prescription.drug?.strength} •{' '}
                        {prescription.drug?.dosage_form ||
                          prescription.drug?.formulation}
                      </p>
                    </div>
                    <div className="text-right space-y-1.5">
                      {prescription.drug?.category && (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDrugCategoryColor(prescription.drug.category as any)}`}
                        >
                          {prescription.drug.category}
                        </span>
                      )}
                      {prescription.drug?.drug_type && (
                        <span
                          className={`block inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDrugTypeColor(prescription.drug.drug_type as any)}`}
                        >
                          {prescription.drug.drug_type}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                            Dosage Instructions
                          </p>
                          {!isEditingDosage ? (
                            <button
                              type="button"
                              onClick={() => setIsEditingDosage(true)}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setDosageInstructions(
                                    formatPrescriptionDetails(prescription),
                                  );
                                  setSpecialInstructions(
                                    prescription.special_instructions || '',
                                  );
                                  setIsEditingDosage(false);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditingDosage(false)}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 hover:text-green-900 hover:bg-green-100 rounded-lg transition-colors"
                              >
                                <Check className="h-3 w-3" />
                                Done
                              </button>
                            </div>
                          )}
                        </div>

                        {!isEditingDosage ? (
                          <>
                            <p className="text-sm text-amber-900 font-medium">
                              {dosageInstructions}
                            </p>
                            {specialInstructions && (
                              <p className="text-xs text-amber-700 mt-2 italic">
                                Note: {specialInstructions}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-amber-700 mb-1">
                                Main Instructions
                              </label>
                              <textarea
                                value={dosageInstructions}
                                onChange={(e) =>
                                  setDosageInstructions(e.target.value)
                                }
                                rows={2}
                                className="w-full px-3 py-2 text-sm border-2 border-amber-300 rounded-lg bg-white focus:ring-0 focus:border-amber-500 resize-none"
                                placeholder="Enter dosage instructions..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-amber-700 mb-1">
                                Special Instructions (Optional)
                              </label>
                              <textarea
                                value={specialInstructions}
                                onChange={(e) =>
                                  setSpecialInstructions(e.target.value)
                                }
                                rows={2}
                                className="w-full px-3 py-2 text-sm border-2 border-amber-300 rounded-lg bg-white focus:ring-0 focus:border-amber-500 resize-none"
                                placeholder="Any special notes or warnings..."
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantity Summary Section */}
              <div
                className={`${isNightMode ? 'bg-slate-700' : 'bg-white'} rounded-xl border ${isNightMode ? 'border-slate-600' : 'border-gray-200'} p-5 shadow-sm`}
              >
                <div
                  className={`flex items-center gap-3 mb-4 pb-3 border-b ${isNightMode ? 'border-slate-600' : 'border-gray-100'}`}
                >
                  <div className="p-2.5 bg-emerald-100 rounded-xl">
                    <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3
                      className={`text-base font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                    >
                      Prescription Status
                    </h3>
                    <p className="text-xs text-gray-500">
                      Quantity tracking and stock availability
                    </p>
                  </div>
                </div>

                {/* Quantity Cards */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white text-center shadow-md">
                    <div className="text-3xl font-bold">
                      {prescription.quantity_prescribed}
                    </div>
                    <div className="text-xs text-blue-100 uppercase tracking-wider mt-1">
                      Prescribed
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl text-white text-center shadow-md">
                    <div className="text-3xl font-bold">
                      {prescription.quantity_dispensed || 0}
                    </div>
                    <div className="text-xs text-green-100 uppercase tracking-wider mt-1">
                      Dispensed
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl text-white text-center shadow-md">
                    <div className="text-3xl font-bold">{remaining}</div>
                    <div className="text-xs text-orange-100 uppercase tracking-wider mt-1">
                      Remaining
                    </div>
                  </div>
                  <div
                    className={`p-4 rounded-xl text-white text-center shadow-md ${
                      isOutOfStock
                        ? 'bg-gradient-to-br from-red-500 to-red-600'
                        : isLowStock
                          ? 'bg-gradient-to-br from-yellow-500 to-amber-500'
                          : 'bg-gradient-to-br from-teal-500 to-cyan-600'
                    }`}
                  >
                    <div className="text-3xl font-bold">{available}</div>
                    <div
                      className={`text-xs uppercase tracking-wider mt-1 ${
                        isOutOfStock
                          ? 'text-red-100'
                          : isLowStock
                            ? 'text-yellow-100'
                            : 'text-teal-100'
                      }`}
                    >
                      In Stock
                    </div>
                  </div>
                </div>

                {/* Stock Warning */}
                {isOutOfStock && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Out of Stock</p>
                      <p className="text-sm text-red-600">
                        This medication is currently unavailable. Consider
                        suggesting an alternative.
                      </p>
                    </div>
                  </div>
                )}

                {isLowStock && !isOutOfStock && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800">
                        Low Stock Alert
                      </p>
                      <p className="text-sm text-amber-600">
                        Stock is running low. Only {available} units remaining.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dispense Quantity Section */}
              <div
                className={`${isNightMode ? 'bg-slate-700' : 'bg-white'} rounded-xl border ${isNightMode ? 'border-slate-600' : 'border-gray-200'} p-5 shadow-sm`}
              >
                <div
                  className={`flex items-center gap-3 mb-4 pb-3 border-b ${isNightMode ? 'border-slate-600' : 'border-gray-100'}`}
                >
                  <div className="p-2.5 bg-primary-700/10 rounded-xl">
                    <Package className="h-5 w-5 text-primary-700" />
                  </div>
                  <div>
                    <h3
                      className={`text-base font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                    >
                      Dispense Details
                    </h3>
                    <p className="text-xs text-gray-500">
                      Enter quantity to dispense to patient
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Quantity Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Quantity to Dispense{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={decrementQuantity}
                        disabled={quantity <= 1 || isOutOfStock}
                        className="w-14 h-14 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                      >
                        <Minus className="h-6 w-6 text-gray-600" />
                      </button>
                      <div className="flex-1">
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const max = Math.min(remaining, available);
                            setQuantity(Math.min(Math.max(1, val), max));
                            if (errors.quantity) setErrors({});
                          }}
                          className={`w-full text-center text-3xl font-bold py-3 border-2 rounded-xl transition-all focus:ring-0 focus:border-primary-700 ${
                            errors.quantity
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-200'
                          }`}
                          min={1}
                          max={Math.min(remaining, available)}
                          disabled={isOutOfStock}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={incrementQuantity}
                        disabled={
                          quantity >= Math.min(remaining, available) ||
                          isOutOfStock
                        }
                        className="w-14 h-14 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                      >
                        <Plus className="h-6 w-6 text-gray-600" />
                      </button>
                    </div>
                    {errors.quantity && (
                      <p className="text-xs text-red-600 flex items-center gap-1 mt-2">
                        <AlertCircle className="h-3 w-3" /> {errors.quantity}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Maximum: {Math.min(remaining, available)} units
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Dispensing Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl transition-all text-sm focus:ring-0 focus:border-primary-700 resize-none"
                      placeholder="Any special instructions or notes for this dispense..."
                      disabled={isOutOfStock}
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Footer with Actions */}
          <div
            className={`flex-shrink-0 ${isNightMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-t px-6 py-4`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {canDispense && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>
                      Ready to dispense {quantity} unit
                      {quantity !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
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
                <Button
                  type="submit"
                  form="dispense-form"
                  disabled={isOutOfStock || isLoading || !canDispense}
                  isLoading={isLoading}
                  className="bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-[#007538] text-white px-6"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Dispense
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

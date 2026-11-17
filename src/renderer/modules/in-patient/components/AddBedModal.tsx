// =============================================================================
// XENOCARE EMR - Add Bed Modal
// Modal form for creating new beds in a ward
// =============================================================================

import React, { useState } from 'react';
import { X, Bed, Loader2, Plus } from 'lucide-react';
import { useWards } from '../hooks/useWards';
import { useCreateBed, useCreateBulkBeds } from '../hooks/useBeds';
import type { BedType } from '../../../types/database.types';

interface AddBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preSelectedWardId?: string | null;
}

const bedTypes: { value: BedType; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard', description: 'Regular hospital bed' },
  {
    value: 'electric',
    label: 'Electric',
    description: 'Adjustable electric bed',
  },
  {
    value: 'icu',
    label: 'ICU',
    description: 'Intensive care bed with monitoring',
  },
  {
    value: 'pediatric',
    label: 'Pediatric',
    description: 'Child-sized bed with safety rails',
  },
  {
    value: 'bariatric',
    label: 'Bariatric',
    description: 'Heavy-duty bed for larger patients',
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Low-height bed for fall prevention',
  },
  {
    value: 'stretcher',
    label: 'Stretcher',
    description: 'Portable stretcher bed',
  },
  { value: 'crib', label: 'Crib', description: 'Infant crib' },
  { value: 'bassinet', label: 'Bassinet', description: 'Newborn bassinet' },
];

type CreateMode = 'single' | 'bulk';

const AddBedModal: React.FC<AddBedModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedWardId,
}) => {
  const [mode, setMode] = useState<CreateMode>('single');
  const [formData, setFormData] = useState({
    ward_id: preSelectedWardId || '',
    bed_number: '',
    bed_type: 'standard' as BedType,
    daily_rate: '',
    location_details: '',
    features: [] as string[],
  });
  const [bulkFormData, setBulkFormData] = useState({
    ward_id: preSelectedWardId || '',
    bed_type: 'standard' as BedType,
    prefix: '',
    start_number: '1',
    count: '1',
    daily_rate: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: wards } = useWards();
  const createBed = useCreateBed();

  // Bed-only deployment: keep the ward behind the scenes and default to the
  // first active ward so the UI never asks the user to choose one.
  React.useEffect(() => {
    const defaultWardId = wards?.[0]?.id;
    if (!defaultWardId) return;
    setFormData((prev) =>
      prev.ward_id ? prev : { ...prev, ward_id: defaultWardId },
    );
    setBulkFormData((prev) =>
      prev.ward_id ? prev : { ...prev, ward_id: defaultWardId },
    );
  }, [wards]);
  const createBulkBeds = useCreateBulkBeds();

  // Update ward_id when preSelectedWardId changes
  React.useEffect(() => {
    if (preSelectedWardId) {
      setFormData((prev) => ({ ...prev, ward_id: preSelectedWardId }));
      setBulkFormData((prev) => ({ ...prev, ward_id: preSelectedWardId }));
    }
  }, [preSelectedWardId]);

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.ward_id) {
      setError('Please select a ward');
      return;
    }

    if (!formData.bed_number.trim()) {
      setError('Bed number is required');
      return;
    }

    try {
      await createBed.mutateAsync({
        ward_id: formData.ward_id,
        bed_number: formData.bed_number.trim(),
        bed_type: formData.bed_type,
        daily_rate: formData.daily_rate
          ? parseFloat(formData.daily_rate)
          : undefined,
        location_details: formData.location_details.trim() || undefined,
        features: formData.features.length > 0 ? formData.features : undefined,
      });

      // Reset form
      setFormData({
        ward_id: preSelectedWardId || '',
        bed_number: '',
        bed_type: 'standard',
        daily_rate: '',
        location_details: '',
        features: [],
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create bed');
    }
  };

  const handleSubmitBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!bulkFormData.ward_id) {
      setError('Please select a ward');
      return;
    }

    const count = parseInt(bulkFormData.count);
    if (isNaN(count) || count < 1 || count > 50) {
      setError('Number of beds must be between 1 and 50');
      return;
    }

    const startNumber = parseInt(bulkFormData.start_number);
    if (isNaN(startNumber) || startNumber < 1) {
      setError('Start number must be at least 1');
      return;
    }

    try {
      await createBulkBeds.mutateAsync({
        wardId: bulkFormData.ward_id,
        bedType: bulkFormData.bed_type,
        startNumber,
        count,
        prefix: bulkFormData.prefix.trim() || undefined,
        dailyRate: bulkFormData.daily_rate
          ? parseFloat(bulkFormData.daily_rate)
          : undefined,
      });

      // Reset form
      setBulkFormData({
        ward_id: preSelectedWardId || '',
        bed_type: 'standard',
        prefix: '',
        start_number: '1',
        count: '1',
        daily_rate: '',
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create beds');
    }
  };

  const selectedWard = wards?.find(
    (w) =>
      w.id === (mode === 'single' ? formData.ward_id : bulkFormData.ward_id),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Bed className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Add New Bed(s)
              </h2>
              <p className="text-sm text-gray-500">Create beds for a ward</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'single'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Single Bed
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'bulk'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Multiple Beds
          </button>
        </div>

        {/* Form */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {mode === 'single' ? (
            <form onSubmit={handleSubmitSingle} className="space-y-4">
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Beds are added directly. Ward grouping is handled
                automatically.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bed Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.bed_number}
                    onChange={(e) =>
                      setFormData({ ...formData, bed_number: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., B-01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bed Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.bed_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bed_type: e.target.value as BedType,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {bedTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Rate (₦)
                </label>
                <input
                  type="number"
                  value={formData.daily_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, daily_rate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 5000"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location Details
                </label>
                <input
                  type="text"
                  value={formData.location_details}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location_details: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Near window, by nurse station"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBed.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createBed.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Bed className="h-4 w-4" />
                      Create Bed
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitBulk} className="space-y-4">
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Beds are added directly. Ward grouping is handled
                automatically.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bed Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={bulkFormData.bed_type}
                  onChange={(e) =>
                    setBulkFormData({
                      ...bulkFormData,
                      bed_type: e.target.value as BedType,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {bedTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prefix
                  </label>
                  <input
                    type="text"
                    value={bulkFormData.prefix}
                    onChange={(e) =>
                      setBulkFormData({
                        ...bulkFormData,
                        prefix: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., B-"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start # <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={bulkFormData.start_number}
                    onChange={(e) =>
                      setBulkFormData({
                        ...bulkFormData,
                        start_number: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={bulkFormData.count}
                    onChange={(e) =>
                      setBulkFormData({
                        ...bulkFormData,
                        count: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Rate (₦) - Applied to all beds
                </label>
                <input
                  type="number"
                  value={bulkFormData.daily_rate}
                  onChange={(e) =>
                    setBulkFormData({
                      ...bulkFormData,
                      daily_rate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 5000"
                  min="0"
                />
              </div>

              {/* Preview */}
              {bulkFormData.ward_id &&
                bulkFormData.count &&
                parseInt(bulkFormData.count) > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Preview:</span> Creating{' '}
                      <span className="font-semibold text-green-600">
                        {bulkFormData.count}
                      </span>{' '}
                      beds
                      {selectedWard && (
                        <>
                          {' '}
                          in{' '}
                          <span className="font-semibold">
                            {selectedWard.name}
                          </span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Bed numbers: {bulkFormData.prefix}
                      {bulkFormData.start_number} to {bulkFormData.prefix}
                      {parseInt(bulkFormData.start_number || '1') +
                        parseInt(bulkFormData.count || '1') -
                        1}
                    </p>
                  </div>
                )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBulkBeds.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createBulkBeds.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create {bulkFormData.count || 1} Beds
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddBedModal;

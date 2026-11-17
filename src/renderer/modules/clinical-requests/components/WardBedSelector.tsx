/**
 * Ward Bed Selector Component
 * ===========================
 * Reusable component for selecting a ward and available bed
 * Used in admission execution workflows
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Bed,
  Users,
  AlertCircle,
  CheckCircle,
  Search,
} from 'lucide-react';
import { supabase } from '../../../api/supabaseClient';
import {
  SkeletonWardGrid,
  SkeletonBedGrid,
} from '../../../components/ui/SkeletonLoader';
import { createScopedLogger } from '../../../utils/logger';

const log = createScopedLogger('WardBedSelector');

// Types
interface Ward {
  id: string;
  name: string;
  ward_type: string;
  total_beds: number;
  available_beds: number;
  is_active: boolean;
}

interface BedInfo {
  id: string;
  bed_number: string;
  bed_type: string;
  status:
    | 'Available'
    | 'Occupied'
    | 'Reserved'
    | 'Maintenance'
    | 'Cleaning'
    | 'available'
    | 'occupied'
    | 'reserved'
    | 'maintenance'
    | 'cleaning';
  features?: string[];
}

interface WardBedSelectorProps {
  facilityId: string;
  selectedWardId?: string | null;
  selectedBedId?: string | null;
  suggestedWardId?: string | null;
  suggestedWardType?: string | null;
  levelOfCare?: string | null;
  onWardSelect: (wardId: string, ward: Ward) => void;
  onBedSelect: (bedId: string, bed: BedInfo) => void;
  disabled?: boolean;
  required?: boolean;
  /** Hide ward selection and show every available bed in the facility. */
  bedOnly?: boolean;
}

// Ward type color mapping
const WARD_TYPE_COLORS: Record<string, string> = {
  general: 'bg-blue-100 text-blue-700',
  icu: 'bg-red-100 text-red-700',
  hdu: 'bg-orange-100 text-orange-700',
  nicu: 'bg-pink-100 text-pink-700',
  pediatric: 'bg-green-100 text-green-700',
  maternity: 'bg-purple-100 text-purple-700',
  surgical: 'bg-indigo-100 text-indigo-700',
  medical: 'bg-cyan-100 text-cyan-700',
  psychiatric: 'bg-yellow-100 text-yellow-700',
  isolation: 'bg-gray-100 text-gray-700',
};

// Bed status colors
const BED_STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700 border-green-300',
  occupied: 'bg-red-100 text-red-700 border-red-300',
  reserved: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  maintenance: 'bg-gray-100 text-gray-700 border-gray-300',
  cleaning: 'bg-blue-100 text-blue-700 border-blue-300',
};

function normalizeBedStatus(status: unknown): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

function isAvailableBedStatus(status: unknown): boolean {
  const normalized = normalizeBedStatus(status);
  return (
    normalized === 'available' ||
    normalized === 'vacant' ||
    normalized === 'free'
  );
}

export const WardBedSelector: React.FC<WardBedSelectorProps> = ({
  facilityId,
  selectedWardId,
  selectedBedId,
  suggestedWardId,
  suggestedWardType,
  levelOfCare,
  onWardSelect,
  onBedSelect,
  disabled = false,
  required = false,
  bedOnly = true,
}) => {
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<BedInfo[]>([]);
  const [facilityBeds, setFacilityBeds] = useState<
    Array<BedInfo & { ward_id: string }>
  >([]);
  const [loadingWards, setLoadingWards] = useState(true);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [wardFilter, setWardFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch wards and calculate available beds directly (handles case sensitivity)
  useEffect(() => {
    async function fetchWards() {
      try {
        setLoadingWards(true);
        setError(null);

        log.info(
          '[WardBedSelector] Fetching wards for facility:',
          facilityId,
        );

        // Fetch wards - don't filter by facility_id if not set (for backwards compatibility)
        // Also don't require is_active for legacy wards
        const wardQuery = supabase
          .from('wards')
          .select(
            'id, name, ward_type, total_beds, available_beds, is_active, facility_id',
          )
          .order('name');

        // Only filter by facility_id if it's provided and wards have facility_id
        // Don't strictly require facility_id match to support legacy wards
        const { data: wardData, error: wardError } = await wardQuery;

        if (wardError) {
          log.error('[WardBedSelector] Ward fetch error:', wardError);
          throw wardError;
        }

        log.info(
          '[WardBedSelector] Wards fetched:',
          wardData?.length,
          wardData,
        );

        // Filter wards:
        // 1. Show wards with matching facility_id OR wards without facility_id (legacy)
        // 2. Show active wards (is_active = true or undefined for legacy)
        const filteredWardData = (wardData || []).filter((ward) => {
          const matchesFacility =
            !facilityId || !ward.facility_id || ward.facility_id === facilityId;
          const isActive =
            ward.is_active === true ||
            ward.is_active === undefined ||
            ward.is_active === null;
          return matchesFacility && isActive;
        });

        log.info(
          '[WardBedSelector] Filtered wards for facility:',
          filteredWardData?.length,
        );

        // Fetch all beds (no facility filter - beds are linked via ward_id)
        const { data: allBeds, error: bedsError } = await supabase
          .from('beds')
          .select('id, ward_id, status, is_active, bed_number, bed_type, features');

        if (bedsError) {
          log.error('[WardBedSelector] Beds fetch error:', bedsError);
          throw bedsError;
        }

        log.info(
          '[WardBedSelector] All beds fetched:',
          allBeds?.length,
          allBeds,
        );

        // Log unique statuses found
        setFacilityBeds(
          ((allBeds || []) as Array<
              BedInfo & { ward_id: string; is_active?: boolean }
            >).filter(
            (bed) => bed.is_active !== false && isAvailableBedStatus(bed.status),
          ),
        );

        const uniqueStatuses = [
          ...new Set((allBeds || []).map((b) => b.status)),
        ];
        log.info(
          '[WardBedSelector] Unique bed statuses found:',
          uniqueStatuses,
        );

        // Calculate actual available beds per ward (case-insensitive check)
        const totalByWard: Record<string, number> = {};
        const availableByWard: Record<string, number> = {};

        (allBeds || []).forEach((bed) => {
          // Count all beds, including those without is_active flag (legacy data)
          if (bed.is_active !== false) {
            totalByWard[bed.ward_id] = (totalByWard[bed.ward_id] || 0) + 1;
            // Case-insensitive check for 'Available' or 'available'
            if (isAvailableBedStatus(bed.status)) {
              availableByWard[bed.ward_id] =
                (availableByWard[bed.ward_id] || 0) + 1;
            }
          }
        });

        log.info('[WardBedSelector] Available by ward:', availableByWard);
        log.info('[WardBedSelector] Total by ward:', totalByWard);

        // Merge actual counts into ward data
        const wardsWithCounts = (filteredWardData || []).map((ward) => ({
          id: ward.id,
          name: ward.name,
          ward_type: ward.ward_type,
          total_beds: totalByWard[ward.id] || ward.total_beds || 0,
          available_beds: availableByWard[ward.id] || 0,
          is_active: ward.is_active ?? true,
        }));

        log.info('[WardBedSelector] Wards with counts:', wardsWithCounts);

        setWards(wardsWithCounts);

        // Auto-select suggested ward if available
        if (suggestedWardId && wardsWithCounts) {
          const suggestedWard = wardsWithCounts.find(
            (w) => w.id === suggestedWardId,
          );
          if (suggestedWard && suggestedWard.available_beds > 0) {
            onWardSelect(suggestedWard.id, suggestedWard);
          }
        }
      } catch (err) {
        log.error('Error fetching wards:', err);
        setError('Failed to load wards');
      } finally {
        setLoadingWards(false);
      }
    }

    fetchWards();
  }, [facilityId, suggestedWardId]);

  // Fetch beds when ward is selected
  useEffect(() => {
    async function fetchBeds() {
      if (!selectedWardId) {
        setBeds([]);
        return;
      }

      try {
        setLoadingBeds(true);
        setError(null);

        log.info(
          '[WardBedSelector] Fetching beds for ward:',
          selectedWardId,
        );

        const { data, error: fetchError } = await supabase
          .from('beds')
          .select('id, bed_number, bed_type, status, features, is_active')
          .eq('ward_id', selectedWardId)
          .order('bed_number');

        if (fetchError) {
          log.error('[WardBedSelector] Bed fetch error:', fetchError);
          throw fetchError;
        }

        log.info(
          '[WardBedSelector] Beds fetched for ward:',
          data?.length,
          data,
        );

        // Filter only active beds
        const activeBeds = (data || []).filter((b) => b.is_active !== false);
        log.info('[WardBedSelector] Active beds:', activeBeds.length);
        log.info(
          '[WardBedSelector] Bed statuses:',
          activeBeds.map((b) => b.status),
        );

        setBeds(activeBeds);
      } catch (err) {
        log.error('Error fetching beds:', err);
        setError('Failed to load beds');
      } finally {
        setLoadingBeds(false);
      }
    }

    fetchBeds();
  }, [selectedWardId]);

  // Filter wards based on search and level of care
  const filteredWards = wards.filter((ward) => {
    const matchesSearch =
      wardFilter === '' ||
      ward.name.toLowerCase().includes(wardFilter.toLowerCase()) ||
      ward.ward_type.toLowerCase().includes(wardFilter.toLowerCase());

    // If level of care is specified, prioritize matching wards
    if (levelOfCare) {
      const levelMap: Record<string, string[]> = {
        ICU: ['icu'],
        HDU: ['hdu'],
        NICU: ['nicu'],
        Ward: ['general', 'medical', 'surgical', 'pediatric', 'maternity'],
      };
      const matchingTypes = levelMap[levelOfCare] || [];
      if (
        matchingTypes.length > 0 &&
        !matchingTypes.includes(ward.ward_type.toLowerCase())
      ) {
        return false;
      }
    }

    return matchesSearch;
  });

  // Get available beds only (handle both capitalized and lowercase status from DB)
  const availableBeds = beds.filter((bed) => isAvailableBedStatus(bed.status));

  const selectedWard = wards.find((w) => w.id === selectedWardId);
  const selectedBed = beds.find((b) => b.id === selectedBedId);

  if (bedOnly) {
    const selectedFacilityBed = facilityBeds.find(
      (bed) => bed.id === selectedBedId,
    );

    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Bed className="w-4 h-4 inline mr-1" />
          Select Bed {required && <span className="text-red-500">*</span>}
        </label>

        {loadingWards ? (
          <SkeletonBedGrid count={12} />
        ) : facilityBeds.length === 0 ? (
          <div className="py-4 text-center text-amber-600 bg-amber-50 rounded-lg">
            No available beds right now.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto p-1">
            {facilityBeds.map((bed) => {
              const isSelected = bed.id === selectedBedId;
              return (
                <button
                  key={bed.id}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    const ward =
                      wards.find((w) => w.id === bed.ward_id) ||
                      ({
                        id: bed.ward_id,
                        name: 'Bed',
                        ward_type: '',
                        total_beds: 0,
                        available_beds: 0,
                        is_active: true,
                      } as Ward);
                    onWardSelect(ward.id, ward);
                    onBedSelect(bed.id, bed);
                  }}
                  disabled={disabled}
                  className={`p-2 rounded-lg border-2 text-center transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-100'
                      : `${BED_STATUS_COLORS.available} hover:border-green-500`
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={`Bed ${bed.bed_number} (${bed.bed_type || 'Standard'})`}
                >
                  <div className="font-semibold text-sm">{bed.bed_number}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {bed.bed_type || 'Standard'}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedFacilityBed && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-800">
            <strong>Bed:</strong> {selectedFacilityBed.bed_number}
            {selectedFacilityBed.bed_type && ` (${selectedFacilityBed.bed_type})`}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Ward Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Building2 className="w-4 h-4 inline mr-1" />
          Select Ward {required && <span className="text-red-500">*</span>}
        </label>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            placeholder="Search wards..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={disabled}
          />
        </div>

        {/* Suggested Ward Notice */}
        {suggestedWardId && (
          <div className="mb-3 p-2 bg-blue-50 rounded-lg flex items-center gap-2 text-sm text-blue-700">
            <AlertCircle className="w-4 h-4" />
            <span>
              Doctor suggested:{' '}
              <strong>
                {wards.find((w) => w.id === suggestedWardId)?.name ||
                  'Loading...'}
              </strong>
            </span>
          </div>
        )}

        {/* Level of Care Notice */}
        {levelOfCare && levelOfCare !== 'Ward' && (
          <div className="mb-3 p-2 bg-amber-50 rounded-lg flex items-center gap-2 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4" />
            <span>
              Level of Care required: <strong>{levelOfCare}</strong>
            </span>
          </div>
        )}

        {/* Ward Grid */}
        {loadingWards ? (
          <SkeletonWardGrid count={6} />
        ) : filteredWards.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No matching wards found
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
            {filteredWards.map((ward) => {
              const isSelected = ward.id === selectedWardId;
              const isSuggested = ward.id === suggestedWardId;
              const hasAvailableBeds =
                ward.available_beds > 0 || ward.total_beds > 0; // Allow selection if ward has any beds

              return (
                <button
                  key={ward.id}
                  onClick={() => {
                    if (!disabled) {
                      onWardSelect(ward.id, ward);
                    }
                  }}
                  disabled={disabled}
                  className={`
                    relative p-3 rounded-lg border-2 text-left transition-all
                    ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    ${isSuggested && !isSelected ? 'ring-2 ring-blue-300' : ''}
                  `}
                >
                  {/* Selected check */}
                  {isSelected && (
                    <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-blue-600" />
                  )}

                  <div className="font-medium text-gray-900">{ward.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${WARD_TYPE_COLORS[ward.ward_type.toLowerCase()] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {ward.ward_type}
                    </span>
                    <span className="flex items-center text-xs text-gray-500">
                      <Users className="w-3 h-3 mr-1" />
                      {ward.available_beds}/{ward.total_beds} available
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bed Selection */}
      {selectedWardId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Bed className="w-4 h-4 inline mr-1" />
            Select Bed {required && <span className="text-red-500">*</span>}
          </label>

          {loadingBeds ? (
            <SkeletonBedGrid count={12} />
          ) : beds.length === 0 ? (
            <div className="py-4 text-center text-gray-500 bg-gray-50 rounded-lg">
              No beds configured for this ward.
            </div>
          ) : availableBeds.length === 0 ? (
            <div className="py-4 text-center text-amber-600 bg-amber-50 rounded-lg mb-2">
              No available beds in this ward.
            </div>
          ) : null}

          {beds.length > 0 && !loadingBeds && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1">
              {availableBeds.map((bed) => {
                const isSelected = bed.id === selectedBedId;
                const isAvailable = isAvailableBedStatus(bed.status);

                return (
                  <button
                    key={bed.id}
                    onClick={() => {
                      if (!disabled && isAvailable) {
                        onBedSelect(bed.id, bed);
                      }
                    }}
                    disabled={disabled || !isAvailable}
                    className={`
                      p-2 rounded-lg border-2 text-center transition-all
                      ${isSelected ? 'border-blue-500 bg-blue-100' : ''}
                      ${isAvailable && !isSelected ? `${BED_STATUS_COLORS.available} hover:border-green-500` : ''}
                      ${!isAvailable ? `${BED_STATUS_COLORS[bed.status?.toLowerCase() || 'maintenance']} opacity-60 cursor-not-allowed` : 'cursor-pointer'}
                    `}
                    title={`Bed ${bed.bed_number} - ${bed.status}${bed.bed_type ? ` (${bed.bed_type})` : ''}`}
                  >
                    <div className="font-semibold text-sm">
                      {bed.bed_number}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {bed.bed_type || 'Standard'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Bed legend */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div
                className={`w-3 h-3 rounded ${BED_STATUS_COLORS.available.split(' ')[0]}`}
              />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className={`w-3 h-3 rounded ${BED_STATUS_COLORS.occupied.split(' ')[0]}`}
              />
              <span>Occupied</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className={`w-3 h-3 rounded ${BED_STATUS_COLORS.reserved.split(' ')[0]}`}
              />
              <span>Reserved</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className={`w-3 h-3 rounded ${BED_STATUS_COLORS.maintenance.split(' ')[0]}`}
              />
              <span>Maintenance</span>
            </div>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      {(selectedWard || selectedBed) && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <h4 className="text-sm font-medium text-green-800 mb-1">
            Selection Summary
          </h4>
          <div className="text-sm text-green-700">
            {selectedWard && (
              <div>
                <strong>Ward:</strong> {selectedWard.name} (
                {selectedWard.ward_type})
              </div>
            )}
            {selectedBed && (
              <div>
                <strong>Bed:</strong> {selectedBed.bed_number}
                {selectedBed.bed_type && ` (${selectedBed.bed_type})`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}
    </div>
  );
};

export default WardBedSelector;
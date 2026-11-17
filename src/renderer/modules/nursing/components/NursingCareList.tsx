import React, { useMemo, useState } from 'react';
import {
  Eye,
  Edit,
  Trash2,
  Search,
  Filter,
  User,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
} from 'lucide-react';
import {
  Input,
  Select,
  Button,
  DataTable,
  StatusBadge,
  EmptyState,
} from '../../../components/ui';
import { SkeletonList } from '../../../components/ui/SkeletonLoader';
import {
  NursingCareDTO,
  CARE_TYPES,
  CareType,
  formatVitalSigns,
  getCareTypeColor,
} from '../dtos/nursing.dto';
import {
  formatPatientName,
  formatDetailedAge,
} from '../../patient-registration/dtos/patient.dto';

// =============================================================================
// Types
// =============================================================================

interface NursingCareListProps {
  records: NursingCareDTO[];
  isLoading?: boolean;
  onView: (record: NursingCareDTO) => void;
  onEdit: (record: NursingCareDTO) => void;
  onDelete?: (record: NursingCareDTO) => void;
  onOpenPatientPanel?: (record: NursingCareDTO) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  careTypeFilter: CareType | '';
  onCareTypeFilterChange: (type: CareType | '') => void;
}

// Grouped patient type
interface GroupedPatient {
  patientId: string;
  patientName: string;
  patientInitials: string;
  gender: string;
  age: string;
  encounterCount: number; // Count of unique encounters, not vitals records
  encounters: NursingCareDTO[];
  uniqueEncounterIds: Set<string>; // Track unique encounter IDs
  encounterSummaries: EncounterSummary[]; // Grouped by encounter
  latestRecord: NursingCareDTO;
}

// Summary of records grouped by encounter
interface EncounterSummary {
  encounterId: string;
  encounterDate: string;
  visitType: string;
  recordCount: number; // Number of vitals/nursing records in this encounter
  latestRecord: NursingCareDTO;
}

// =============================================================================
// Component
// =============================================================================

export default function NursingCareList({
  records,
  isLoading = false,
  onView,
  onEdit,
  onDelete,
  onOpenPatientPanel,
  page,
  totalPages,
  onPageChange,
  onSearch,
  careTypeFilter,
  onCareTypeFilterChange,
}: NursingCareListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(
    new Set(),
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value);
  };

  // Group records by patient
  const groupedPatients = useMemo(() => {
    const patientMap = new Map<string, GroupedPatient>();

    records.forEach((record) => {
      const patientId =
        record.patient?.patient_id || record.patient_id || 'unknown';

      if (!patientMap.has(patientId)) {
        patientMap.set(patientId, {
          patientId,
          patientName: record.patient
            ? formatPatientName(record.patient)
            : 'Unknown',
          patientInitials: `${record.patient?.first_name?.charAt(0) || ''}${record.patient?.surname?.charAt(0) || ''}`,
          gender: record.patient?.gender || '-',
          age: record.patient
            ? `${formatDetailedAge(record.patient.date_of_birth)}`
            : '-',
          encounterCount: 0,
          encounters: [],
          uniqueEncounterIds: new Set<string>(),
          encounterSummaries: [],
          latestRecord: record,
        });
      }

      const group = patientMap.get(patientId)!;
      group.encounters.push(record);

      // Count unique encounters (not individual vitals/nursing records)
      const encounterId = (record as any).encounter_id;
      if (encounterId && !group.uniqueEncounterIds.has(encounterId)) {
        group.uniqueEncounterIds.add(encounterId);
        group.encounterCount = group.uniqueEncounterIds.size;
      }

      // Update latest record if this one is more recent
      if (
        new Date(record.created_at) > new Date(group.latestRecord.created_at)
      ) {
        group.latestRecord = record;
      }
    });

    // Sort by latest record date (most recent first)
    return Array.from(patientMap.values()).sort(
      (a, b) =>
        new Date(b.latestRecord.created_at).getTime() -
        new Date(a.latestRecord.created_at).getTime(),
    );
  }, [records]);

  const togglePatientExpand = (patientId: string) => {
    setExpandedPatients((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="space-y-3">
        {/* Expanded Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by patient name, patient number, or phone number..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-3 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent placeholder-gray-400"
          />
        </div>

        {/* Collapsible Care Type Filter */}
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-700"
          >
            <Filter size={16} />
            <span>Filter by Care Type</span>
            {careTypeFilter && (
              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-xs font-semibold">
                {careTypeFilter}
              </span>
            )}
            <ChevronDown
              size={14}
              className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown Filter Options */}
          {isFilterOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsFilterOpen(false)}
              />
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px]">
                <button
                  onClick={() => {
                    onCareTypeFilterChange('');
                    setIsFilterOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                    careTypeFilter === ''
                      ? 'bg-pink-50 text-pink-700 font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  All Care Types
                </button>
                {CARE_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      onCareTypeFilterChange(type);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                      careTypeFilter === type
                        ? 'bg-pink-50 text-pink-700 font-medium'
                        : 'text-gray-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Grouped Patient List */}
      {isLoading ? (
        <div className="p-4">
          <SkeletonList count={5} />
        </div>
      ) : groupedPatients.length === 0 ? (
        <EmptyState
          title="No nursing care records"
          description="Start by adding a new nursing care record"
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {groupedPatients.map((group) => {
            const isExpanded = expandedPatients.has(group.patientId);

            return (
              <div key={group.patientId} className="overflow-hidden">
                {/* Patient Header Row */}
                <div
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => togglePatientExpand(group.patientId)}
                >
                  {/* Expand Icon */}
                  <div className="text-gray-400">
                    {isExpanded ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </div>

                  {/* Patient Avatar & Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-medium flex-shrink-0">
                      {group.patientInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {group.patientName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {group.gender} • {group.age}
                      </div>
                    </div>
                  </div>

                  {/* Latest Date */}
                  <div className="text-sm text-gray-500 w-28 text-right hidden sm:block">
                    Latest: {formatDate(group.latestRecord.created_at)}
                  </div>

                  {/* Quick Actions */}
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onOpenPatientPanel?.(group.latestRecord)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
                      title="Open patient panel"
                    >
                      <User size={14} />
                      Open Panel
                    </button>
                  </div>
                </div>

                {/* Expanded Encounters Summary */}
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    <div className="px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 uppercase tracking-wider flex items-center gap-4">
                      <div className="w-8" />
                      <div className="flex-1">Encounter</div>
                      <div className="w-32 text-center">Nurse</div>
                      <div className="w-36 text-center">Date & Time</div>
                      <div className="w-24 text-center">Visit Type</div>
                      <div className="w-28 text-right">Actions</div>
                    </div>

                    {/* Group records by encounter_id and show summary */}
                    {(() => {
                      const encounterMap = new Map<
                        string,
                        { records: typeof group.encounters; latestDate: Date }
                      >();
                      group.encounters.forEach((record) => {
                        const encId =
                          (record as any).encounter_id || 'no-encounter';
                        if (!encounterMap.has(encId)) {
                          encounterMap.set(encId, {
                            records: [],
                            latestDate: new Date(record.created_at),
                          });
                        }
                        const enc = encounterMap.get(encId)!;
                        enc.records.push(record);
                        const recordDate = new Date(record.created_at);
                        if (recordDate > enc.latestDate) {
                          enc.latestDate = recordDate;
                        }
                      });

                      // Sort encounters by latest date (most recent first)
                      const sortedEncounters = Array.from(
                        encounterMap.entries(),
                      ).sort(
                        (a, b) =>
                          b[1].latestDate.getTime() - a[1].latestDate.getTime(),
                      );

                      return sortedEncounters.map(
                        ([encounterId, { records: encRecords }], idx) => {
                          const latestRecord = encRecords.sort(
                            (a, b) =>
                              new Date(b.created_at).getTime() -
                              new Date(a.created_at).getTime(),
                          )[0];
                          const careTypes = [
                            ...new Set(encRecords.map((r) => r.care_type)),
                          ];

                          return (
                            <div
                              key={encounterId}
                              className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-100 transition-colors ${
                                idx !== sortedEncounters.length - 1
                                  ? 'border-b border-gray-100'
                                  : ''
                              }`}
                            >
                              {/* Index */}
                              <div className="w-8 text-center text-sm text-gray-400">
                                #{idx + 1}
                              </div>

                              {/* Encounter Info */}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800">
                                  {encounterId !== 'no-encounter'
                                    ? `Encounter #${encounterId.substring(0, 8)}...`
                                    : 'No Encounter ID'}
                                </div>
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  {careTypes.map((type) => (
                                    <span
                                      key={type}
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCareTypeColor(type as CareType)}`}
                                    >
                                      {type}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Nurse */}
                              <div className="w-32 text-center">
                                <span className="text-sm text-gray-700">
                                  {latestRecord.nurse
                                    ? `${latestRecord.nurse.first_name} ${latestRecord.nurse.last_name}`
                                    : 'Unknown'}
                                </span>
                              </div>

                              {/* Date & Time */}
                              <div className="w-36 text-center">
                                <div className="flex items-center justify-center gap-1 text-sm text-gray-700">
                                  <Calendar
                                    size={12}
                                    className="text-gray-400"
                                  />
                                  {formatDate(latestRecord.created_at)}
                                </div>
                                <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                                  <Clock size={10} className="text-gray-400" />
                                  {formatTime(latestRecord.created_at)}
                                </div>
                              </div>

                              {/* Visit Type */}
                              <div className="w-24 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  {(latestRecord as any).visit_type ||
                                    'General'}
                                </span>
                              </div>

                              {/* Actions */}
                              <div className="w-28 flex items-center justify-end gap-1">
                                <button
                                  onClick={() => onView(latestRecord)}
                                  className="inline-flex items-center p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                  title="View latest record"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() =>
                                    onOpenPatientPanel?.(latestRecord)
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
                                  title="Open patient panel"
                                >
                                  <User size={12} />
                                  Panel
                                </button>
                              </div>
                            </div>
                          );
                        },
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

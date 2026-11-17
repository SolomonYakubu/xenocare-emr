import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  Calendar,
  Pill,
  CheckCircle,
  Clock,
  Filter,
  Package,
  Activity,
  User,
  Stethoscope,
  X,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Button } from '../../../components/ui/FormElements';
import { StatusBadge } from '../../../components/ui/DataDisplay';
import {
  PrescriptionDTO,
  PrescriptionStatus,
  getPrescriptionStatusColor,
} from '../dtos/pharmacy.dto';
import { formatPatientName } from '../../patient-registration/dtos/patient.dto';
import { Patient } from '../../../types/database.types';
import { SkeletonTable } from '../../../components/ui/SkeletonLoader';

interface DispenseHistoryTabProps {
  prescriptions: PrescriptionDTO[];
  isLoading: boolean;
  onViewDispense: (prescription: PrescriptionDTO) => void;
}

// Grouped patient records type
interface PatientPrescriptionGroup {
  patient: Patient;
  patientId: string;
  emrNumber: string;
  prescriptions: PrescriptionDTO[];
  totalPrescriptions: number;
  dispensedCount: number;
  partialCount: number;
  latestDate: string;
}

export default function DispenseHistoryTab({
  prescriptions,
  isLoading,
  onViewDispense,
}: DispenseHistoryTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'dispensed' | 'partial'
  >('all');
  const [selectedPatientGroup, setSelectedPatientGroup] =
    useState<PatientPrescriptionGroup | null>(null);

  // Filter to only show dispensed or partially dispensed prescriptions
  const dispensedPrescriptions = useMemo(() => {
    return prescriptions.filter(
      (rx) =>
        rx.status === 'Dispensed' ||
        rx.status === 'Partial' ||
        (rx.quantity_dispensed && rx.quantity_dispensed > 0),
    );
  }, [prescriptions]);

  // Group prescriptions by patient patient number
  const patientGroups = useMemo(() => {
    const groups = new Map<string, PatientPrescriptionGroup>();

    dispensedPrescriptions.forEach((rx) => {
      if (!rx.patient) return;

      // Use patient id for grouping, but display emr_number
      const patientId = rx.patient.id || rx.patient.patient_id;
      const emrNumber = rx.patient.emr_number || 'Pending';

      if (!groups.has(patientId)) {
        groups.set(patientId, {
          patient: rx.patient,
          patientId,
          emrNumber,
          prescriptions: [],
          totalPrescriptions: 0,
          dispensedCount: 0,
          partialCount: 0,
          latestDate: rx.created_at,
        });
      }

      const group = groups.get(patientId)!;
      group.prescriptions.push(rx);
      group.totalPrescriptions++;

      if (rx.status === 'Dispensed') {
        group.dispensedCount++;
      } else if (rx.status === 'Partial') {
        group.partialCount++;
      }

      // Track latest date
      if (new Date(rx.created_at) > new Date(group.latestDate)) {
        group.latestDate = rx.created_at;
      }
    });

    return Array.from(groups.values());
  }, [dispensedPrescriptions]);

  // Filter groups based on search and status
  const filteredGroups = useMemo(() => {
    let filtered = [...patientGroups];

    // Status filter
    if (statusFilter === 'dispensed') {
      filtered = filtered.filter((g) => g.dispensedCount > 0);
    } else if (statusFilter === 'partial') {
      filtered = filtered.filter((g) => g.partialCount > 0);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((g) => {
        const patientName = formatPatientName(g.patient).toLowerCase();
        const emrNumber = g.emrNumber.toLowerCase();
        const phone = g.patient.contact_phone?.toLowerCase() || '';

        return (
          patientName.includes(query) ||
          emrNumber.includes(query) ||
          phone.includes(query)
        );
      });
    }

    // Sort by latest date
    filtered.sort(
      (a, b) =>
        new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime(),
    );

    return filtered;
  }, [patientGroups, searchQuery, statusFilter]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusVariant = (
    status: PrescriptionStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
    switch (status) {
      case 'Dispensed':
        return 'success';
      case 'Partial':
        return 'warning';
      case 'Pending':
        return 'info';
      case 'Cancelled':
        return 'danger';
      case 'Rejected':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  if (isLoading) {
    return <SkeletonTable rows={5} columns={4} />;
  }

  return (
    <div className="space-y-4">
      {/* Header with Search and Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              Dispense History by Patient
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {filteredGroups.length} patients with dispense records
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by EMR, name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'all' | 'dispensed' | 'partial',
                  )
                }
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="dispensed">Fully Dispensed</option>
                <option value="partial">Partially Dispensed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Pill className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Dispense Records Found
          </h3>
          <p className="text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search criteria'
              : 'No dispense records available yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Prescriptions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status Summary
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Latest Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredGroups.map((group) => (
                  <tr
                    key={group.patientId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-medium">
                          {group.patient.first_name?.charAt(0)}
                          {group.patient.surname?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {formatPatientName(group.patient)}
                          </p>
                          <span className="inline-block font-mono text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded mt-1">
                            {group.patient.emr_number || 'Pending'}
                          </span>
                          {group.patient.contact_phone && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {group.patient.contact_phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-semibold text-gray-900">
                          {group.totalPrescriptions}
                        </span>
                        <span className="text-xs text-gray-500">
                          medication(s)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {group.dispensedCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3" />
                            {group.dispensedCount} dispensed
                          </span>
                        )}
                        {group.partialCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock className="h-3 w-3" />
                            {group.partialCount} partial
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(group.latestDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedPatientGroup(group)}
                        className="inline-flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View All
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Patient Prescription Records Detail Modal */}
      {selectedPatientGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-semibold">
                    {selectedPatientGroup.patient.first_name?.charAt(0)}
                    {selectedPatientGroup.patient.surname?.charAt(0)}
                  </div>
                  <div className="text-white">
                    <h3 className="text-lg font-semibold">
                      {formatPatientName(selectedPatientGroup.patient)}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded">
                        {selectedPatientGroup.patient.emr_number || 'Pending'}
                      </span>
                      <span className="text-sm text-green-100">
                        • {selectedPatientGroup.totalPrescriptions}{' '}
                        Prescription(s)
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPatientGroup(null)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Body - Prescription Records List */}
            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
              <div className="space-y-4">
                {selectedPatientGroup.prescriptions.map((prescription) => (
                  <div
                    key={prescription.prescription_id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-green-300 hover:shadow-sm transition-all"
                  >
                    {/* Patient & Encounter Header */}
                    <div className="bg-gray-50 -mx-4 -mt-4 px-4 py-3 mb-4 rounded-t-lg border-b border-gray-200">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">EMR:</span>
                            <span className="font-mono text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                              {selectedPatientGroup.patient.emr_number ||
                                'Pending'}
                            </span>
                          </div>
                          <span className="text-gray-300">|</span>
                          <span className="font-medium text-gray-900 text-sm">
                            {formatPatientName(selectedPatientGroup.patient)}
                          </span>
                        </div>
                        {prescription.encounter?.encounter_number && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">
                              Encounter:
                            </span>
                            <span className="font-mono text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                              {prescription.encounter.encounter_number}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Drug Info */}
                        <div className="flex items-center gap-2 mb-2">
                          <Pill className="h-5 w-5 text-green-600" />
                          <h4 className="font-semibold text-gray-900">
                            {prescription.drug?.drug_name || 'Unknown Drug'}
                          </h4>
                          <StatusBadge
                            status={prescription.status}
                            variant={getStatusVariant(
                              prescription.status as PrescriptionStatus,
                            )}
                          />
                        </div>

                        {/* Dosage & Date */}
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                          {prescription.drug?.strength && (
                            <span className="flex items-center gap-1">
                              <Activity className="h-3.5 w-3.5" />
                              {prescription.drug.strength}
                            </span>
                          )}
                          <span>
                            {prescription.dosage} - {prescription.frequency}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(prescription.created_at)}
                          </span>
                        </div>

                        {/* Quantity Progress */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600">
                              Dispensed Progress
                            </span>
                            <span className="font-medium">
                              <span className="text-green-600">
                                {prescription.quantity_dispensed || 0}
                              </span>
                              <span className="text-gray-400"> / </span>
                              <span className="text-gray-700">
                                {prescription.quantity_prescribed}
                              </span>
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full">
                            <div
                              className={`h-full rounded-full ${
                                prescription.status === 'Dispensed'
                                  ? 'bg-green-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{
                                width: `${Math.min(100, ((prescription.quantity_dispensed || 0) / prescription.quantity_prescribed) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Prescribing Doctor */}
                        {prescription.doctor && (
                          <div className="bg-green-50 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Stethoscope className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-green-900">
                                Prescribed by:
                              </span>
                              <span className="text-green-700">
                                Dr. {prescription.doctor.first_name}{' '}
                                {prescription.doctor.last_name}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Diagnosis */}
                        {prescription.diagnosis &&
                          prescription.diagnosis.length > 0 && (
                            <div className="bg-amber-50 rounded-lg p-3 mb-3">
                              <div className="flex items-start gap-2">
                                <FileText className="h-4 w-4 text-amber-600 mt-0.5" />
                                <div>
                                  <span className="font-medium text-amber-900 text-sm">
                                    Diagnosis/Indication:
                                  </span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {prescription.diagnosis.map((dx, i) => (
                                      <span
                                        key={i}
                                        className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded"
                                      >
                                        {dx}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Clinical Notes */}
                        {prescription.clinical_notes && (
                          <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <div className="flex items-start gap-2">
                              <User className="h-4 w-4 text-gray-500 mt-0.5" />
                              <div>
                                <span className="font-medium text-gray-700 text-sm">
                                  Clinical Notes:
                                </span>
                                <p className="text-sm text-gray-600 mt-1">
                                  {prescription.clinical_notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Instructions */}
                        {prescription.instructions && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-blue-500 mt-0.5" />
                              <div>
                                <span className="font-medium text-blue-700 text-sm">
                                  Instructions:
                                </span>
                                <p className="text-sm text-blue-600 mt-1">
                                  {prescription.instructions}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* View Detail Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedPatientGroup(null);
                          onViewDispense(prescription);
                        }}
                        className="text-green-600 hover:text-green-700"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

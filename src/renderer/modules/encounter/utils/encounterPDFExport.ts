/**
 * =============================================================================
 * XENOCARE EMR - COMPREHENSIVE CROSS-MODULE PDF EXPORT
 * Description: Professional PDF generation for encounter reports with full module integration
 * Features:
 *   - Clinical data (Consultations, Diagnoses, Chief Complaints)
 *   - Nursing activities (Notes, Vitals, Treatment Plans)
 *   - Pharmacy records (Prescriptions, Dispensing)
 *   - Radiology records (Imaging requests, Reports)
 *   - Billing transactions (Orders, Items, Payments)
 *   - Inpatient movements (Admissions, Transfers, Ward Rounds)
 *   - Procedures and interventions
 *   - Ward-level statistics
 *   - Chart-driven analytics with statistical visualizations
 * =============================================================================
 */

import { Encounter } from '../dtos/encounter.dto';
import { ComprehensiveEncounterFilters } from '../components/ComprehensiveEncounterFilterPanel';
import { getFacilityAddress, getFacilityName } from '../../../lib/facility';

// Electron shell for opening files
const electron = window.require ? window.require('electron') : null;
const fs = electron ? window.require('fs') : null;
const path = electron ? window.require('path') : null;
const os = electron ? window.require('os') : null;

// XenoCare Logo as base64 (fallback if image load fails)
// =============================================================================
// Types
// =============================================================================

// Cross-module data interface for comprehensive reports
export interface CrossModuleData {
  // Nursing Data
  nursingNotes?: Array<{
    id: string;
    encounter_id: string;
    note_type: string;
    notes: string;
    patient_condition: string;
    pain_score?: number;
    nurse_name?: string;
    created_at: string;
  }>;
  vitals?: Array<{
    id: string;
    encounter_id: string;
    temperature?: number;
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    pulse?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    weight?: number;
    height?: number;
    recorded_at: string;
    recorded_by?: string;
  }>;
  treatmentPlans?: Array<{
    id: string;
    encounter_id: string;
    title: string;
    instructions: string;
    status: string;
    doctor_name?: string;
    created_at: string;
  }>;

  // Pharmacy Data
  prescriptions?: Array<{
    id: string;
    encounter_id: string;
    drug_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    status: string;
    doctor_name?: string;
    created_at: string;
    dispensed_at?: string;
  }>;

  // Radiology Data
  radiologyRequests?: Array<{
    id: string;
    encounter_id: string;
    imaging_type: string;
    body_part: string;
    clinical_indication: string;
    status: string;
    findings?: string;
    recommendation?: string;
    ordered_by?: string;
    reported_by?: string;
    created_at: string;
    completed_at?: string;
  }>;

  // Billing Data
  billingOrders?: Array<{
    id: string;
    encounter_id: string;
    order_number: string;
    total_amount: number;
    amount_paid: number;
    status: string;
    payment_category: string;
    items?: Array<{
      service_name: string;
      service_type: string;
      quantity: number;
      unit_price: number;
      amount: number;
    }>;
    created_at: string;
  }>;

  // Inpatient/Admission Data
  admissions?: Array<{
    id: string;
    encounter_id: string;
    admission_number: string;
    admission_type: string;
    ward_name: string;
    bed_number: string;
    admission_date: string;
    discharge_date?: string;
    diagnosis: string;
    status: string;
    attending_doctor?: string;
  }>;
  wardRoundNotes?: Array<{
    id: string;
    admission_id: string;
    round_date: string;
    assessment: string;
    plan: string;
    doctor_name?: string;
  }>;
  bedTransfers?: Array<{
    from_ward: string;
    to_ward: string;
    from_bed: string;
    to_bed: string;
    transfer_date: string;
    reason: string;
  }>;

  // Procedures Data
  procedures?: Array<{
    id: string;
    encounter_id: string;
    procedure_name: string;
    procedure_type: string;
    urgency: string;
    status: string;
    performed_by?: string;
    performed_at?: string;
    findings?: string;
    complications?: string;
    outcome?: string;
    created_at: string;
  }>;

  // Ward Statistics
  wardStats?: {
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyRate: number;
    byWard: Record<
      string,
      { total: number; occupied: number; available: number }
    >;
  };

  // Lab Results (future integration)
  labResults?: Array<{
    id: string;
    encounter_id: string;
    test_name: string;
    result: string;
    reference_range: string;
    status: string;
    created_at: string;
    completed_at?: string;
  }>;
}

export interface PDFExportOptions {
  title?: string;
  subtitle?: string;
  includePatientDetails: boolean;
  includeClinicalInfo: boolean;
  includeBillingInfo: boolean;
  includeStatistics: boolean;
  includeVitals: boolean;
  includeDiagnosis: boolean;
  groupByPatient: boolean;
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  generatedBy?: string;
  // Module sections to include (enhanced)
  enabledModules?: string[];
  isDefaultFilter?: boolean;
  // Cross-module data for comprehensive reports
  crossModuleData?: CrossModuleData;
}

export interface EncounterPDFData {
  encounters: Encounter[];
  filters: ComprehensiveEncounterFilters;
  options: PDFExportOptions;
  facilityName: string;
  facilityAddress: string;
  reportDate: Date;
}

// =============================================================================
// Statistics Calculator
// =============================================================================

interface EncounterStats {
  total: number;
  byStatus: Record<string, number>;
  byVisitType: Record<string, number>;
  byDepartment: Record<string, number>;
  byDoctor: Record<string, number>;
  byPatientCategory: Record<string, number>;
  byGender: Record<string, number>;
  byPriority: Record<string, number>;
  byAgeGroup: Record<string, number>;
  averageAge: number;
  dateRange: { earliest: string; latest: string };
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
}

function calculateStats(encounters: Encounter[]): EncounterStats {
  const stats: EncounterStats = {
    total: encounters.length,
    byStatus: {},
    byVisitType: {},
    byDepartment: {},
    byDoctor: {},
    byPatientCategory: {},
    byGender: {},
    byPriority: {},
    byAgeGroup: {
      '0-17': 0,
      '18-35': 0,
      '36-50': 0,
      '51-65': 0,
      '65+': 0,
      Unknown: 0,
    },
    averageAge: 0,
    dateRange: { earliest: '', latest: '' },
    activeCount: 0,
    completedCount: 0,
    cancelledCount: 0,
  };

  let totalAge = 0;
  let ageCount = 0;
  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;

  encounters.forEach((enc) => {
    // Status counts
    const status = enc.status || 'Unknown';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    if (status === 'Active' || status === 'In Progress' || status === 'Waiting')
      stats.activeCount++;
    if (status === 'Completed') stats.completedCount++;
    if (status === 'Cancelled') stats.cancelledCount++;

    // Visit Type
    const visitType = enc.visit_type || 'Unknown';
    stats.byVisitType[visitType] = (stats.byVisitType[visitType] || 0) + 1;

    // Department
    const dept = enc.clinic?.clinic_name || 'GOPD';
    stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;

    // Doctor
    const doc = enc.attending_doctor;
    const docName = doc
      ? `${doc.rank || ''} ${doc.first_name || ''} ${doc.last_name || ''}`.trim()
      : 'Unassigned';
    stats.byDoctor[docName] = (stats.byDoctor[docName] || 0) + 1;

    // Patient Category
    const patCat =
      (enc.patient as any)?.patient_category ||
      enc.payment_category ||
      'Unknown';
    stats.byPatientCategory[patCat] =
      (stats.byPatientCategory[patCat] || 0) + 1;

    // Gender
    const gender = enc.patient?.gender || 'Unknown';
    stats.byGender[gender] = (stats.byGender[gender] || 0) + 1;

    // Priority
    const priority = enc.priority || 'Normal';
    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

    // Age and Age Groups
    if (enc.patient?.date_of_birth) {
      const birthDate = new Date(enc.patient.date_of_birth);
      const age = Math.floor(
        (Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      );
      if (!isNaN(age) && age >= 0 && age < 150) {
        totalAge += age;
        ageCount++;
        if (age <= 17) stats.byAgeGroup['0-17']++;
        else if (age <= 35) stats.byAgeGroup['18-35']++;
        else if (age <= 50) stats.byAgeGroup['36-50']++;
        else if (age <= 65) stats.byAgeGroup['51-65']++;
        else stats.byAgeGroup['65+']++;
      } else {
        stats.byAgeGroup.Unknown++;
      }
    } else {
      stats.byAgeGroup.Unknown++;
    }

    // Date range
    const encDate = new Date(
      enc.created_at || enc.encounter_date || Date.now(),
    );
    if (!earliestDate || encDate < earliestDate) earliestDate = encDate;
    if (!latestDate || encDate > latestDate) latestDate = encDate;
  });

  stats.averageAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;

  // Handle date range - cast to Date to avoid TypeScript narrowing issues
  const earliestDateValue = earliestDate as Date | null;
  const latestDateValue = latestDate as Date | null;
  stats.dateRange = {
    earliest:
      earliestDateValue !== null
        ? earliestDateValue.toLocaleDateString()
        : 'N/A',
    latest:
      latestDateValue !== null ? latestDateValue.toLocaleDateString() : 'N/A',
  };

  return stats;
}

// =============================================================================
// Cross-Module Statistics Calculator
// =============================================================================

interface CrossModuleStats {
  // Nursing Stats
  nursing: {
    totalNotes: number;
    totalVitals: number;
    byNoteType: Record<string, number>;
    byPatientCondition: Record<string, number>;
    avgPainScore: number;
  };
  // Pharmacy Stats
  pharmacy: {
    totalPrescriptions: number;
    dispensed: number;
    pending: number;
    byDrugCategory: Record<string, number>;
    totalAmount: number;
  };
  // Radiology Stats
  radiology: {
    totalRequests: number;
    completed: number;
    pending: number;
    byImagingType: Record<string, number>;
  };
  // Billing Stats
  billing: {
    totalOrders: number;
    totalAmount: number;
    amountPaid: number;
    amountOutstanding: number;
    byServiceType: Record<string, number>;
    byPaymentCategory: Record<string, number>;
  };
  // Inpatient Stats
  inpatient: {
    totalAdmissions: number;
    currentlyAdmitted: number;
    discharged: number;
    avgLengthOfStay: number;
    byWard: Record<string, number>;
    byAdmissionType: Record<string, number>;
  };
  // Procedures Stats
  procedures: {
    totalProcedures: number;
    completed: number;
    scheduled: number;
    byProcedureType: Record<string, number>;
    byUrgency: Record<string, number>;
  };
}

function calculateCrossModuleStats(data: CrossModuleData): CrossModuleStats {
  const stats: CrossModuleStats = {
    nursing: {
      totalNotes: 0,
      totalVitals: 0,
      byNoteType: {},
      byPatientCondition: {},
      avgPainScore: 0,
    },
    pharmacy: {
      totalPrescriptions: 0,
      dispensed: 0,
      pending: 0,
      byDrugCategory: {},
      totalAmount: 0,
    },
    radiology: {
      totalRequests: 0,
      completed: 0,
      pending: 0,
      byImagingType: {},
    },
    billing: {
      totalOrders: 0,
      totalAmount: 0,
      amountPaid: 0,
      amountOutstanding: 0,
      byServiceType: {},
      byPaymentCategory: {},
    },
    inpatient: {
      totalAdmissions: 0,
      currentlyAdmitted: 0,
      discharged: 0,
      avgLengthOfStay: 0,
      byWard: {},
      byAdmissionType: {},
    },
    procedures: {
      totalProcedures: 0,
      completed: 0,
      scheduled: 0,
      byProcedureType: {},
      byUrgency: {},
    },
  };

  // Calculate Nursing Stats
  if (data.nursingNotes) {
    stats.nursing.totalNotes = data.nursingNotes.length;
    let painTotal = 0;
    let painCount = 0;
    data.nursingNotes.forEach((note) => {
      const noteType = note.note_type || 'Other';
      stats.nursing.byNoteType[noteType] =
        (stats.nursing.byNoteType[noteType] || 0) + 1;

      const condition = note.patient_condition || 'Unknown';
      stats.nursing.byPatientCondition[condition] =
        (stats.nursing.byPatientCondition[condition] || 0) + 1;

      if (note.pain_score !== undefined && note.pain_score !== null) {
        painTotal += note.pain_score;
        painCount++;
      }
    });
    stats.nursing.avgPainScore =
      painCount > 0 ? Math.round((painTotal / painCount) * 10) / 10 : 0;
  }

  if (data.vitals) {
    stats.nursing.totalVitals = data.vitals.length;
  }

  // Calculate Pharmacy Stats
  if (data.prescriptions) {
    stats.pharmacy.totalPrescriptions = data.prescriptions.length;
    data.prescriptions.forEach((rx) => {
      if (rx.status === 'Dispensed') stats.pharmacy.dispensed++;
      else if (rx.status === 'Pending' || rx.status === 'Verified')
        stats.pharmacy.pending++;
    });
  }

  // Calculate Radiology Stats
  if (data.radiologyRequests) {
    stats.radiology.totalRequests = data.radiologyRequests.length;
    data.radiologyRequests.forEach((req) => {
      const imgType = req.imaging_type || 'Other';
      stats.radiology.byImagingType[imgType] =
        (stats.radiology.byImagingType[imgType] || 0) + 1;

      if (req.status === 'Completed' || req.status === 'Reported')
        stats.radiology.completed++;
      else stats.radiology.pending++;
    });
  }

  // Calculate Billing Stats
  if (data.billingOrders) {
    stats.billing.totalOrders = data.billingOrders.length;
    data.billingOrders.forEach((order) => {
      stats.billing.totalAmount += order.total_amount || 0;
      stats.billing.amountPaid += order.amount_paid || 0;

      const payCat = order.payment_category || 'Unknown';
      stats.billing.byPaymentCategory[payCat] =
        (stats.billing.byPaymentCategory[payCat] || 0) + 1;

      if (order.items) {
        order.items.forEach((item) => {
          const svcType = item.service_type || 'Other';
          stats.billing.byServiceType[svcType] =
            (stats.billing.byServiceType[svcType] || 0) + 1;
        });
      }
    });
    stats.billing.amountOutstanding =
      stats.billing.totalAmount - stats.billing.amountPaid;
  }

  // Calculate Inpatient Stats
  if (data.admissions) {
    stats.inpatient.totalAdmissions = data.admissions.length;
    let totalDays = 0;
    let dischargeCount = 0;

    data.admissions.forEach((adm) => {
      const ward = adm.ward_name || 'Unknown';
      stats.inpatient.byWard[ward] = (stats.inpatient.byWard[ward] || 0) + 1;

      const admType = adm.admission_type || 'Unknown';
      stats.inpatient.byAdmissionType[admType] =
        (stats.inpatient.byAdmissionType[admType] || 0) + 1;

      if (adm.status === 'discharged' || adm.discharge_date) {
        stats.inpatient.discharged++;
        if (adm.admission_date && adm.discharge_date) {
          const days = Math.ceil(
            (new Date(adm.discharge_date).getTime() -
              new Date(adm.admission_date).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          totalDays += days;
          dischargeCount++;
        }
      } else {
        stats.inpatient.currentlyAdmitted++;
      }
    });

    stats.inpatient.avgLengthOfStay =
      dischargeCount > 0
        ? Math.round((totalDays / dischargeCount) * 10) / 10
        : 0;
  }

  // Calculate Procedures Stats
  if (data.procedures) {
    stats.procedures.totalProcedures = data.procedures.length;
    data.procedures.forEach((proc) => {
      const procType = proc.procedure_type || 'Other';
      stats.procedures.byProcedureType[procType] =
        (stats.procedures.byProcedureType[procType] || 0) + 1;

      const urgency = proc.urgency || 'routine';
      stats.procedures.byUrgency[urgency] =
        (stats.procedures.byUrgency[urgency] || 0) + 1;

      if (proc.status === 'completed') stats.procedures.completed++;
      else if (proc.status === 'scheduled') stats.procedures.scheduled++;
    });
  }

  return stats;
}

// =============================================================================
// Cross-Module Section Generators
// =============================================================================

function generateNursingSection(
  data: CrossModuleData,
  stats: CrossModuleStats,
): string {
  if (
    !data.nursingNotes?.length &&
    !data.vitals?.length &&
    !data.treatmentPlans?.length
  ) {
    return '';
  }

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  return `
    <div style="page-break-before: always; padding-top: 24px;">
      <h2 style="margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 3px solid #0891b2; color: #0891b2; font-size: 18px; display: flex; align-items: center; gap: 8px;">
        👩‍⚕️ Nursing Module Records
      </h2>

      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.nursing.totalNotes}</div>
          <div style="font-size: 11px; opacity: 0.9;">Nursing Notes</div>
        </div>
        <div style="background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.nursing.totalVitals}</div>
          <div style="font-size: 11px; opacity: 0.9;">Vital Records</div>
        </div>
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${data.treatmentPlans?.length || 0}</div>
          <div style="font-size: 11px; opacity: 0.9;">Treatment Plans</div>
        </div>
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.nursing.avgPainScore}/10</div>
          <div style="font-size: 11px; opacity: 0.9;">Avg Pain Score</div>
        </div>
      </div>

      ${
        data.vitals && data.vitals.length > 0
          ? `
      <!-- Vitals Table -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
          📊 Vital Signs History
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background: #f0fdfa;">
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #0891b2;">Date/Time</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #0891b2;">Temp (°C)</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #0891b2;">BP</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #0891b2;">Pulse</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #0891b2;">Resp Rate</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #0891b2;">SpO2 (%)</th>
              <th style="padding: 8px; text-align: center; border-bottom: 2px solid #0891b2;">Weight (kg)</th>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #0891b2;">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            ${data.vitals
              .slice(0, 10)
              .map(
                (v, i) => `
              <tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
                <td style="padding: 6px 8px;">${formatDateTime(v.recorded_at)}</td>
                <td style="padding: 6px 8px; text-align: center; ${v.temperature && v.temperature > 37.5 ? 'color: #dc2626; font-weight: bold;' : ''}">${v.temperature || '-'}</td>
                <td style="padding: 6px 8px; text-align: center;">${v.blood_pressure_systolic || '-'}/${v.blood_pressure_diastolic || '-'}</td>
                <td style="padding: 6px 8px; text-align: center; ${v.pulse && v.pulse > 100 ? 'color: #dc2626; font-weight: bold;' : ''}">${v.pulse || '-'}</td>
                <td style="padding: 6px 8px; text-align: center;">${v.respiratory_rate || '-'}</td>
                <td style="padding: 6px 8px; text-align: center; ${v.oxygen_saturation && v.oxygen_saturation < 95 ? 'color: #dc2626; font-weight: bold;' : ''}">${v.oxygen_saturation || '-'}</td>
                <td style="padding: 6px 8px; text-align: center;">${v.weight || '-'}</td>
                <td style="padding: 6px 8px;">${v.recorded_by || '-'}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
        ${data.vitals.length > 10 ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #6b7280; text-align: center;">Showing 10 of ${data.vitals.length} vital records</p>` : ''}
      </div>
      `
          : ''
      }

      ${
        data.nursingNotes && data.nursingNotes.length > 0
          ? `
      <!-- Nursing Notes Summary -->
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
          📝 Nursing Notes
        </h3>
        ${data.nursingNotes
          .slice(0, 5)
          .map(
            (note, i) => `
          <div style="margin-bottom: 12px; padding: 12px; background: #f0fdfa; border-left: 4px solid #0891b2; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: 600; color: #0891b2;">${note.note_type}</span>
              <span style="font-size: 10px; color: #6b7280;">${formatDateTime(note.created_at)}</span>
            </div>
            <p style="margin: 0 0 8px 0; font-size: 11px; color: #374151;">${note.notes?.substring(0, 200)}${note.notes && note.notes.length > 200 ? '...' : ''}</p>
            <div style="display: flex; gap: 12px; font-size: 10px;">
              <span style="padding: 2px 8px; background: ${note.patient_condition === 'Stable' ? '#dcfce7' : note.patient_condition === 'Critical' ? '#fee2e2' : '#fef3c7'}; border-radius: 12px;">
                ${note.patient_condition || 'Unknown'}
              </span>
              ${note.pain_score !== undefined ? `<span>Pain: ${note.pain_score}/10</span>` : ''}
              ${note.nurse_name ? `<span style="color: #6b7280;">by ${note.nurse_name}</span>` : ''}
            </div>
          </div>
        `,
          )
          .join('')}
        ${data.nursingNotes.length > 5 ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #6b7280; text-align: center;">Showing 5 of ${data.nursingNotes.length} nursing notes</p>` : ''}
      </div>
      `
          : ''
      }
    </div>
  `;
}

function generatePharmacySection(
  data: CrossModuleData,
  stats: CrossModuleStats,
): string {
  if (!data.prescriptions?.length) {
    return '';
  }

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString();

  return `
    <div style="page-break-before: always; padding-top: 24px;">
      <h2 style="margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 3px solid #7c3aed; color: #7c3aed; font-size: 18px; display: flex; align-items: center; gap: 8px;">
        💊 Pharmacy Module Records
      </h2>

      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.pharmacy.totalPrescriptions}</div>
          <div style="font-size: 11px; opacity: 0.9;">Total Prescriptions</div>
        </div>
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.pharmacy.dispensed}</div>
          <div style="font-size: 11px; opacity: 0.9;">Dispensed</div>
        </div>
        <div style="background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.pharmacy.pending}</div>
          <div style="font-size: 11px; opacity: 0.9;">Pending</div>
        </div>
      </div>

      <!-- Prescriptions Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f5f3ff;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #7c3aed;">Drug Name</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #7c3aed;">Dosage</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #7c3aed;">Frequency</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #7c3aed;">Duration</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #7c3aed;">Qty</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #7c3aed;">Status</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #7c3aed;">Prescribed By</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #7c3aed;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${data.prescriptions
            .slice(0, 20)
            .map(
              (rx, i) => `
            <tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
              <td style="padding: 6px 8px; font-weight: 500;">${rx.drug_name}</td>
              <td style="padding: 6px 8px;">${rx.dosage || '-'}</td>
              <td style="padding: 6px 8px;">${rx.frequency || '-'}</td>
              <td style="padding: 6px 8px;">${rx.duration || '-'}</td>
              <td style="padding: 6px 8px; text-align: center;">${rx.quantity || '-'}</td>
              <td style="padding: 6px 8px; text-align: center;">
                <span style="padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; background: ${rx.status === 'Dispensed' ? '#dcfce7' : rx.status === 'Pending' ? '#fef3c7' : '#fee2e2'}; color: ${rx.status === 'Dispensed' ? '#16a34a' : rx.status === 'Pending' ? '#d97706' : '#dc2626'};">
                  ${rx.status}
                </span>
              </td>
              <td style="padding: 6px 8px;">${rx.doctor_name || '-'}</td>
              <td style="padding: 6px 8px;">${formatDateTime(rx.created_at)}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
      ${data.prescriptions.length > 20 ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #6b7280; text-align: center;">Showing 20 of ${data.prescriptions.length} prescriptions</p>` : ''}
    </div>
  `;
}

function generateRadiologySection(
  data: CrossModuleData,
  stats: CrossModuleStats,
): string {
  if (!data.radiologyRequests?.length) {
    return '';
  }

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString();

  return `
    <div style="page-break-before: always; padding-top: 24px;">
      <h2 style="margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 3px solid #dc2626; color: #dc2626; font-size: 18px; display: flex; align-items: center; gap: 8px;">
        📷 Radiology Module Records
      </h2>

      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.radiology.totalRequests}</div>
          <div style="font-size: 11px; opacity: 0.9;">Total Imaging Requests</div>
        </div>
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.radiology.completed}</div>
          <div style="font-size: 11px; opacity: 0.9;">Completed/Reported</div>
        </div>
        <div style="background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.radiology.pending}</div>
          <div style="font-size: 11px; opacity: 0.9;">Pending</div>
        </div>
      </div>

      <!-- Imaging Type Distribution -->
      <div style="margin-bottom: 24px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #991b1b;">Imaging Type Distribution</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${Object.entries(stats.radiology.byImagingType)
            .map(
              ([type, count]) => `
            <span style="padding: 4px 12px; background: white; border-radius: 16px; font-size: 11px; border: 1px solid #fecaca;">
              ${type}: <strong>${count}</strong>
            </span>
          `,
            )
            .join('')}
        </div>
      </div>

      <!-- Radiology Requests Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #fef2f2;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dc2626;">Imaging Type</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dc2626;">Body Part</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dc2626;">Clinical Indication</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #dc2626;">Status</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dc2626;">Findings</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dc2626;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${data.radiologyRequests
            .slice(0, 15)
            .map(
              (req, i) => `
            <tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
              <td style="padding: 6px 8px; font-weight: 500;">${req.imaging_type}</td>
              <td style="padding: 6px 8px;">${req.body_part || '-'}</td>
              <td style="padding: 6px 8px;">${req.clinical_indication?.substring(0, 50)}${req.clinical_indication && req.clinical_indication.length > 50 ? '...' : ''}</td>
              <td style="padding: 6px 8px; text-align: center;">
                <span style="padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; background: ${req.status === 'Completed' || req.status === 'Reported' ? '#dcfce7' : '#fef3c7'}; color: ${req.status === 'Completed' || req.status === 'Reported' ? '#16a34a' : '#d97706'};">
                  ${req.status}
                </span>
              </td>
              <td style="padding: 6px 8px; font-size: 9px;">${req.findings?.substring(0, 80) || '-'}${req.findings && req.findings.length > 80 ? '...' : ''}</td>
              <td style="padding: 6px 8px;">${formatDateTime(req.created_at)}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
      ${data.radiologyRequests.length > 15 ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #6b7280; text-align: center;">Showing 15 of ${data.radiologyRequests.length} imaging requests</p>` : ''}
    </div>
  `;
}

function generateBillingSection(
  data: CrossModuleData,
  stats: CrossModuleStats,
): string {
  if (!data.billingOrders?.length) {
    return '';
  }

  const formatCurrency = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString();

  return `
    <div style="page-break-before: always; padding-top: 24px;">
      <h2 style="margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 3px solid #059669; color: #059669; font-size: 18px; display: flex; align-items: center; gap: 8px;">
        💳 Billing & Financial Records
      </h2>

      <!-- Financial Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold;">${stats.billing.totalOrders}</div>
          <div style="font-size: 11px; opacity: 0.9;">Billing Orders</div>
        </div>
        <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 18px; font-weight: bold;">${formatCurrency(stats.billing.totalAmount)}</div>
          <div style="font-size: 11px; opacity: 0.9;">Total Billed</div>
        </div>
        <div style="background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 18px; font-weight: bold;">${formatCurrency(stats.billing.amountPaid)}</div>
          <div style="font-size: 11px; opacity: 0.9;">Amount Paid</div>
        </div>
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 18px; font-weight: bold;">${formatCurrency(stats.billing.amountOutstanding)}</div>
          <div style="font-size: 11px; opacity: 0.9;">Outstanding</div>
        </div>
      </div>

      <!-- Payment Category Distribution -->
      <div style="margin-bottom: 24px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #166534;">Payment Category Distribution</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${Object.entries(stats.billing.byPaymentCategory)
            .map(
              ([cat, count]) => `
            <span style="padding: 4px 12px; background: white; border-radius: 16px; font-size: 11px; border: 1px solid #bbf7d0;">
              ${cat}: <strong>${count}</strong>
            </span>
          `,
            )
            .join('')}
        </div>
      </div>

      <!-- Billing Orders Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f0fdf4;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #059669;">Order #</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #059669;">Payment Category</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #059669;">Total Amount</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #059669;">Paid</th>
            <th style="padding: 8px; text-align: right; border-bottom: 2px solid #059669;">Balance</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #059669;">Status</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #059669;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${data.billingOrders
            .slice(0, 15)
            .map(
              (order, i) => `
            <tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
              <td style="padding: 6px 8px; font-family: monospace; font-weight: 500;">${order.order_number}</td>
              <td style="padding: 6px 8px;">${order.payment_category}</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: 500;">${formatCurrency(order.total_amount)}</td>
              <td style="padding: 6px 8px; text-align: right; color: #16a34a;">${formatCurrency(order.amount_paid)}</td>
              <td style="padding: 6px 8px; text-align: right; color: ${order.total_amount - order.amount_paid > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(order.total_amount - order.amount_paid)}</td>
              <td style="padding: 6px 8px; text-align: center;">
                <span style="padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; background: ${order.status === 'Paid' ? '#dcfce7' : order.status === 'Pending' ? '#fef3c7' : '#e0e7ff'}; color: ${order.status === 'Paid' ? '#16a34a' : order.status === 'Pending' ? '#d97706' : '#4338ca'};">
                  ${order.status}
                </span>
              </td>
              <td style="padding: 6px 8px;">${formatDateTime(order.created_at)}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr style="background: #f0fdf4; font-weight: 600;">
            <td colspan="2" style="padding: 10px 8px; border-top: 2px solid #059669;">TOTALS</td>
            <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #059669;">${formatCurrency(stats.billing.totalAmount)}</td>
            <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #059669; color: #16a34a;">${formatCurrency(stats.billing.amountPaid)}</td>
            <td style="padding: 10px 8px; text-align: right; border-top: 2px solid #059669; color: #dc2626;">${formatCurrency(stats.billing.amountOutstanding)}</td>
            <td colspan="2" style="padding: 10px 8px; border-top: 2px solid #059669;"></td>
          </tr>
        </tfoot>
      </table>
      ${data.billingOrders.length > 15 ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #6b7280; text-align: center;">Showing 15 of ${data.billingOrders.length} billing orders</p>` : ''}
    </div>
  `;
}

function generateInpatientSection(
  data: CrossModuleData,
  stats: CrossModuleStats,
): string {
  if (!data.admissions?.length) {
    return '';
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString();

  return `
    <div style="page-break-before: always; padding-top: 24px;">
      <h2 style="margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 3px solid #f59e0b; color: #f59e0b; font-size: 18px; display: flex; align-items: center; gap: 8px;">
        🏥 Inpatient & Admission Records
      </h2>

      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.inpatient.totalAdmissions}</div>
          <div style="font-size: 11px; opacity: 0.9;">Total Admissions</div>
        </div>
        <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.inpatient.currentlyAdmitted}</div>
          <div style="font-size: 11px; opacity: 0.9;">Currently Admitted</div>
        </div>
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.inpatient.discharged}</div>
          <div style="font-size: 11px; opacity: 0.9;">Discharged</div>
        </div>
        <div style="background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.inpatient.avgLengthOfStay}</div>
          <div style="font-size: 11px; opacity: 0.9;">Avg Stay (Days)</div>
        </div>
      </div>

      <!-- Ward Distribution -->
      <div style="margin-bottom: 24px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #92400e;">Ward Distribution</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${Object.entries(stats.inpatient.byWard)
            .map(
              ([ward, count]) => `
            <span style="padding: 4px 12px; background: white; border-radius: 16px; font-size: 11px; border: 1px solid #fde68a;">
              ${ward}: <strong>${count}</strong>
            </span>
          `,
            )
            .join('')}
        </div>
      </div>

      <!-- Admissions Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #fffbeb;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #f59e0b;">Admission #</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #f59e0b;">Type</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #f59e0b;">Ward</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #f59e0b;">Bed</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #f59e0b;">Admission Date</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #f59e0b;">Discharge Date</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #f59e0b;">Diagnosis</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #f59e0b;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.admissions
            .slice(0, 15)
            .map(
              (adm, i) => `
            <tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
              <td style="padding: 6px 8px; font-family: monospace; font-weight: 500;">${adm.admission_number}</td>
              <td style="padding: 6px 8px;">${adm.admission_type || '-'}</td>
              <td style="padding: 6px 8px;">${adm.ward_name || '-'}</td>
              <td style="padding: 6px 8px;">${adm.bed_number || '-'}</td>
              <td style="padding: 6px 8px;">${formatDate(adm.admission_date)}</td>
              <td style="padding: 6px 8px;">${adm.discharge_date ? formatDate(adm.discharge_date) : '-'}</td>
              <td style="padding: 6px 8px; font-size: 9px;">${adm.diagnosis?.substring(0, 50)}${adm.diagnosis && adm.diagnosis.length > 50 ? '...' : ''}</td>
              <td style="padding: 6px 8px; text-align: center;">
                <span style="padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; background: ${adm.status === 'discharged' ? '#dcfce7' : adm.status === 'admitted' ? '#dbeafe' : '#fef3c7'}; color: ${adm.status === 'discharged' ? '#16a34a' : adm.status === 'admitted' ? '#2563eb' : '#d97706'};">
                  ${adm.status}
                </span>
              </td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
      ${data.admissions.length > 15 ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #6b7280; text-align: center;">Showing 15 of ${data.admissions.length} admissions</p>` : ''}

      ${
        data.bedTransfers && data.bedTransfers.length > 0
          ? `
      <!-- Bed Transfers -->
      <div style="margin-top: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
          🔄 Bed/Ward Transfers
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px; text-align: left;">From Ward</th>
              <th style="padding: 8px; text-align: left;">From Bed</th>
              <th style="padding: 8px; text-align: center;">→</th>
              <th style="padding: 8px; text-align: left;">To Ward</th>
              <th style="padding: 8px; text-align: left;">To Bed</th>
              <th style="padding: 8px; text-align: left;">Date</th>
              <th style="padding: 8px; text-align: left;">Reason</th>
            </tr>
          </thead>
          <tbody>
            ${data.bedTransfers
              .map(
                (t, i) => `
              <tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
                <td style="padding: 6px 8px;">${t.from_ward}</td>
                <td style="padding: 6px 8px;">${t.from_bed}</td>
                <td style="padding: 6px 8px; text-align: center; color: #6b7280;">→</td>
                <td style="padding: 6px 8px;">${t.to_ward}</td>
                <td style="padding: 6px 8px;">${t.to_bed}</td>
                <td style="padding: 6px 8px;">${formatDate(t.transfer_date)}</td>
                <td style="padding: 6px 8px;">${t.reason || '-'}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      `
          : ''
      }
    </div>
  `;
}

function generateProceduresSection(
  data: CrossModuleData,
  stats: CrossModuleStats,
): string {
  if (!data.procedures?.length) {
    return '';
  }

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString();

  return `
    <div style="page-break-before: always; padding-top: 24px;">
      <h2 style="margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 3px solid #8b5cf6; color: #8b5cf6; font-size: 18px; display: flex; align-items: center; gap: 8px;">
        🔬 Procedures & Interventions
      </h2>

      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #a78bfa); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.procedures.totalProcedures}</div>
          <div style="font-size: 11px; opacity: 0.9;">Total Procedures</div>
        </div>
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.procedures.completed}</div>
          <div style="font-size: 11px; opacity: 0.9;">Completed</div>
        </div>
        <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${stats.procedures.scheduled}</div>
          <div style="font-size: 11px; opacity: 0.9;">Scheduled</div>
        </div>
      </div>

      <!-- Procedure Type & Urgency Distribution -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
        <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 16px;">
          <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #6d28d9;">By Procedure Type</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${Object.entries(stats.procedures.byProcedureType)
              .map(
                ([type, count]) => `
              <span style="padding: 4px 12px; background: white; border-radius: 16px; font-size: 11px; border: 1px solid #ddd6fe;">
                ${type}: <strong>${count}</strong>
              </span>
            `,
              )
              .join('')}
          </div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px;">
          <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #991b1b;">By Urgency</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${Object.entries(stats.procedures.byUrgency)
              .map(
                ([urgency, count]) => `
              <span style="padding: 4px 12px; background: white; border-radius: 16px; font-size: 11px; border: 1px solid #fecaca;">
                ${urgency}: <strong>${count}</strong>
              </span>
            `,
              )
              .join('')}
          </div>
        </div>
      </div>

      <!-- Procedures Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f5f3ff;">
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #8b5cf6;">Procedure Name</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #8b5cf6;">Type</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #8b5cf6;">Urgency</th>
            <th style="padding: 8px; text-align: center; border-bottom: 2px solid #8b5cf6;">Status</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #8b5cf6;">Performed By</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #8b5cf6;">Date</th>
            <th style="padding: 8px; text-align: left; border-bottom: 2px solid #8b5cf6;">Outcome</th>
          </tr>
        </thead>
        <tbody>
          ${data.procedures
            .slice(0, 15)
            .map(
              (proc, i) => `
            <tr style="${i % 2 === 0 ? 'background: #f9fafb;' : ''}">
              <td style="padding: 6px 8px; font-weight: 500;">${proc.procedure_name}</td>
              <td style="padding: 6px 8px;">${proc.procedure_type || '-'}</td>
              <td style="padding: 6px 8px; text-align: center;">
                <span style="padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; background: ${proc.urgency === 'emergency' ? '#fee2e2' : proc.urgency === 'urgent' ? '#fef3c7' : '#dcfce7'}; color: ${proc.urgency === 'emergency' ? '#dc2626' : proc.urgency === 'urgent' ? '#d97706' : '#16a34a'};">
                  ${proc.urgency || 'routine'}
                </span>
              </td>
              <td style="padding: 6px 8px; text-align: center;">
                <span style="padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; background: ${proc.status === 'completed' ? '#dcfce7' : '#dbeafe'}; color: ${proc.status === 'completed' ? '#16a34a' : '#2563eb'};">
                  ${proc.status}
                </span>
              </td>
              <td style="padding: 6px 8px;">${proc.performed_by || '-'}</td>
              <td style="padding: 6px 8px;">${proc.performed_at ? formatDateTime(proc.performed_at) : formatDateTime(proc.created_at)}</td>
              <td style="padding: 6px 8px; font-size: 9px;">${proc.outcome?.substring(0, 30) || '-'}${proc.outcome && proc.outcome.length > 30 ? '...' : ''}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
      ${data.procedures.length > 15 ? `<p style="margin: 8px 0 0 0; font-size: 10px; color: #6b7280; text-align: center;">Showing 15 of ${data.procedures.length} procedures</p>` : ''}
    </div>
  `;
}

function generateWardStatisticsSection(data: CrossModuleData): string {
  if (!data.wardStats) {
    return '';
  }

  const ws = data.wardStats;
  const occupancyColor =
    ws.occupancyRate > 90
      ? '#dc2626'
      : ws.occupancyRate > 70
        ? '#f59e0b'
        : '#16a34a';

  return `
    <div style="page-break-before: always; padding-top: 24px;">
      <h2 style="margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 3px solid #0ea5e9; color: #0ea5e9; font-size: 18px; display: flex; align-items: center; gap: 8px;">
        🛏️ Ward Statistics & Bed Occupancy
      </h2>

      <!-- Overall Summary -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #0ea5e9, #38bdf8); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${ws.totalBeds}</div>
          <div style="font-size: 11px; opacity: 0.9;">Total Beds</div>
        </div>
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${ws.occupiedBeds}</div>
          <div style="font-size: 11px; opacity: 0.9;">Occupied</div>
        </div>
        <div style="background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${ws.availableBeds}</div>
          <div style="font-size: 11px; opacity: 0.9;">Available</div>
        </div>
        <div style="background: ${occupancyColor}; color: white; padding: 16px; border-radius: 12px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold;">${ws.occupancyRate.toFixed(1)}%</div>
          <div style="font-size: 11px; opacity: 0.9;">Occupancy Rate</div>
        </div>
      </div>

      <!-- Ward-wise Breakdown -->
      ${
        Object.keys(ws.byWard).length > 0
          ? `
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #0369a1;">Ward-wise Bed Occupancy</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
          ${Object.entries(ws.byWard)
            .map(([ward, data]) => {
              const occupancy =
                data.total > 0 ? (data.occupied / data.total) * 100 : 0;
              const barColor =
                occupancy > 90
                  ? '#dc2626'
                  : occupancy > 70
                    ? '#f59e0b'
                    : '#16a34a';
              return `
              <div style="background: white; border-radius: 8px; padding: 12px; border: 1px solid #e0f2fe;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-weight: 600; color: #0369a1;">${ward}</span>
                  <span style="font-size: 11px; color: #6b7280;">${data.occupied}/${data.total} beds</span>
                </div>
                <div style="background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
                  <div style="background: ${barColor}; height: 100%; width: ${occupancy}%; border-radius: 4px;"></div>
                </div>
                <div style="text-align: right; margin-top: 4px; font-size: 10px; color: ${barColor}; font-weight: 600;">
                  ${occupancy.toFixed(1)}% occupied
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
      `
          : ''
      }
    </div>
  `;
}

// =============================================================================
// PDF HTML Template Generator
// =============================================================================

function formatFiltersForDisplay(
  filters: ComprehensiveEncounterFilters,
): string[] {
  const descriptions: string[] = [];

  if (filters.dateFrom || filters.dateTo) {
    descriptions.push(
      `Date Range: ${filters.dateFrom || 'Any'} to ${filters.dateTo || 'Present'}`,
    );
  }
  if (filters.status !== 'all') descriptions.push(`Status: ${filters.status}`);
  if (filters.visitType !== 'all')
    descriptions.push(`Visit Type: ${filters.visitType}`);
  if (filters.priority !== 'all')
    descriptions.push(`Priority: ${filters.priority}`);
  if (filters.currentStage !== 'all')
    descriptions.push(`Stage: ${filters.currentStage}`);
  if (filters.departmentId !== 'all')
    descriptions.push(`Department: ${filters.departmentId}`);
  if (filters.clinicId !== 'all')
    descriptions.push(`Clinic: ${filters.clinicId}`);
  if (filters.doctorId !== 'all')
    descriptions.push(`Doctor: ${filters.doctorId}`);
  if (filters.patientCategory !== 'all')
    descriptions.push(`Patient Category: ${filters.patientCategory}`);
  if (filters.insuranceType !== 'all')
    descriptions.push(`Insurance: ${filters.insuranceType}`);
  if (filters.paymentCategory !== 'all')
    descriptions.push(`Payment: ${filters.paymentCategory}`);
  if (filters.gender !== 'all') descriptions.push(`Gender: ${filters.gender}`);
  if (filters.ageRangeMin || filters.ageRangeMax) {
    descriptions.push(
      `Age: ${filters.ageRangeMin || '0'} - ${filters.ageRangeMax || '∞'}`,
    );
  }
  if (filters.rank !== 'all') descriptions.push(`Rank: ${filters.rank}`);
  if (filters.course !== 'all') descriptions.push(`Course: ${filters.course}`);
  if (filters.diagnosis !== 'all')
    descriptions.push(`Diagnosis: ${filters.diagnosis}`);
  if (
    (filters as any).icd10Category &&
    (filters as any).icd10Category !== 'all'
  ) {
    descriptions.push(`ICD-10 Category: ${(filters as any).icd10Category}`);
  }
  if (filters.diagnosisCode)
    descriptions.push(`ICD-10 Code: ${filters.diagnosisCode}`);
  if (filters.chiefComplaint !== 'all')
    descriptions.push(`Chief Complaint: ${filters.chiefComplaint}`);

  return descriptions;
}

function generateEncounterRow(
  enc: Encounter,
  index: number,
  options: PDFExportOptions,
): string {
  const { patient } = enc;
  const patientName = patient
    ? `${patient.first_name || ''} ${patient.surname || patient.last_name || ''}`.trim()
    : 'Unknown';
  const emrNumber = patient?.emr_number || 'N/A';
  const gender = patient?.gender || '-';
  const phone = patient?.contact_phone || patient?.phone || '-';

  const doctor = enc.attending_doctor;
  const doctorName = doctor
    ? `${doctor.rank || ''} ${doctor.first_name || ''} ${doctor.last_name || ''}`.trim()
    : '-';

  const encounterDate = enc.created_at
    ? new Date(enc.created_at).toLocaleDateString()
    : '-';
  const encounterTime = enc.created_at
    ? new Date(enc.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const statusColors: Record<string, string> = {
    Active: '#22c55e',
    'In Progress': '#3b82f6',
    Waiting: '#f59e0b',
    Completed: '#6b7280',
    Cancelled: '#ef4444',
  };
  const statusColor = statusColors[enc.status || ''] || '#6b7280';

  const priorityColors: Record<string, string> = {
    Emergency: '#dc2626',
    Urgent: '#f59e0b',
    Normal: '#6b7280',
  };
  const priorityColor = priorityColors[enc.priority || 'Normal'] || '#6b7280';

  return `
    <tr style="border-bottom: 1px solid #e5e7eb; ${index % 2 === 0 ? 'background: #f9fafb;' : ''}">
      <td style="padding: 8px; font-family: monospace; font-size: 11px; color: #006838; font-weight: 600;">
        ${enc.encounter_number || enc.visit_id?.slice(0, 8) || '-'}
      </td>
      <td style="padding: 8px;">
        <div style="font-weight: 600; color: #111827;">${patientName}</div>
        <div style="font-size: 10px; color: #6b7280;">EMR: ${emrNumber} | ${gender}</div>
      </td>
      <td style="padding: 8px; font-size: 11px;">
        <div>${encounterDate}</div>
        <div style="color: #6b7280; font-size: 10px;">${encounterTime}</div>
      </td>
      <td style="padding: 8px; font-size: 11px;">${enc.clinic?.clinic_name || 'GOPD'}</td>
      <td style="padding: 8px; font-size: 11px;">${enc.visit_type || '-'}</td>
      <td style="padding: 8px;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: ${statusColor}20; color: ${statusColor};">
          ${enc.status || '-'}
        </span>
      </td>
      <td style="padding: 8px;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: ${priorityColor}20; color: ${priorityColor};">
          ${enc.priority || 'Normal'}
        </span>
      </td>
      <td style="padding: 8px; font-size: 11px;">${doctorName}</td>
    </tr>
  `;
}

function generateStatisticsSection(
  stats: EncounterStats,
  enabledModules?: string[],
): string {
  const sortedByCount = (
    obj: Record<string, number>,
    limit = 8,
  ): Array<[string, number]> => {
    return Object.entries(obj)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);
  };

  const getPercentage = (value: number, total: number): string => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const getBarWidth = (value: number, total: number): number => {
    if (total === 0) return 0;
    return Math.max(5, (value / total) * 100);
  };

  // Helper to check if a module is enabled
  const isModuleEnabled = (moduleId: string): boolean => {
    // If no enabledModules specified, include all by default
    if (!enabledModules || enabledModules.length === 0) return true;
    return enabledModules.includes(moduleId);
  };

  // Generate visual bar chart
  const generateBarChart = (
    title: string,
    data: Record<string, number>,
    color: string,
    icon: string,
  ) => {
    const sorted = sortedByCount(data, 6);
    if (sorted.length === 0) return '';
    const maxValue = Math.max(...sorted.map(([_, v]) => v));

    return `
      <div style="break-inside: avoid; margin-bottom: 20px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
        <h4 style="margin: 0 0 12px 0; font-size: 13px; color: ${color}; display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 16px;">${icon}</span> ${title}
        </h4>
        <div style="space-y: 8px;">
          ${sorted
            .map(
              ([key, count]) => `
            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <span style="font-size: 11px; color: #374151; font-weight: 500;">${key}</span>
                <span style="font-size: 11px; color: #6b7280;">${count} (${getPercentage(count, stats.total)})</span>
              </div>
              <div style="background: #f3f4f6; border-radius: 4px; height: 8px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, ${color}, ${color}cc); height: 100%; width: ${getBarWidth(count, maxValue)}%; border-radius: 4px; transition: width 0.3s;"></div>
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>
    `;
  };

  // Generate pie chart representation (CSS-based)
  const generatePieData = (
    data: Record<string, number>,
    colors: string[],
  ): string => {
    const sorted = sortedByCount(data, 5);
    if (sorted.length === 0) return '';

    let cumulativePercent = 0;
    const total = sorted.reduce((sum, [_, v]) => sum + v, 0);

    const segments = sorted.map(([key, count], index) => {
      const percent = (count / total) * 100;
      const start = cumulativePercent;
      cumulativePercent += percent;
      return {
        key,
        count,
        percent,
        start,
        color: colors[index % colors.length],
      };
    });

    return `
      <div style="display: flex; gap: 16px; align-items: center;">
        <div style="position: relative; width: 100px; height: 100px;">
          <div style="width: 100%; height: 100%; border-radius: 50%; background: conic-gradient(
            ${segments.map((s, i) => `${s.color} ${s.start}% ${s.start + s.percent}%`).join(', ')}
          );"></div>
        </div>
        <div style="flex: 1;">
          ${segments
            .map(
              (s) => `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="width: 12px; height: 12px; border-radius: 2px; background: ${s.color};"></span>
              <span style="font-size: 10px; color: #374151;">${s.key}: ${s.count} (${s.percent.toFixed(1)}%)</span>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>
    `;
  };

  const pieColors = [
    '#006838',
    '#2563eb',
    '#dc2626',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
  ];

  // Build statistics sections based on enabled modules
  const showEncounterSummary = isModuleEnabled('encounters');
  const showDemographics = isModuleEnabled('demographics');
  const showDepartments = isModuleEnabled('departments');
  const showDoctors = isModuleEnabled('doctors');
  const showDiagnosis = isModuleEnabled('diagnosis');
  const showVisitTypes = isModuleEnabled('visitTypes');
  const showStatus = isModuleEnabled('status');
  const showPriority = isModuleEnabled('priority');
  const showTimeline = isModuleEnabled('timeline');

  return `
    <div style="page-break-before: always; padding-top: 24px;">
      <h2 style="margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 3px solid #006838; color: #006838; font-size: 18px; display: flex; align-items: center; gap: 8px;">
        📊 Statistical Analysis & Charts
      </h2>
      
      <!-- Executive Summary Cards (always show if encounters enabled) -->
      ${
        showEncounterSummary
          ? `
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="background: linear-gradient(135deg, #006838, #008545); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="font-size: 32px; font-weight: bold;">${stats.total}</div>
          <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">Total Encounters</div>
        </div>
        <div style="background: linear-gradient(135deg, #16a34a, #22c55e); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="font-size: 32px; font-weight: bold;">${stats.activeCount}</div>
          <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">Active Cases</div>
        </div>
        <div style="background: linear-gradient(135deg, #6b7280, #9ca3af); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="font-size: 32px; font-weight: bold;">${stats.completedCount}</div>
          <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">Completed</div>
        </div>
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="font-size: 32px; font-weight: bold;">${stats.cancelledCount}</div>
          <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">Cancelled</div>
        </div>
        <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="font-size: 32px; font-weight: bold;">${stats.averageAge}</div>
          <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">Avg. Patient Age</div>
        </div>
      </div>
      `
          : ''
      }

      <!-- Visual Charts Section - Conditionally rendered based on enabled modules -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 24px;">
        ${showStatus ? generateBarChart('Encounters by Status', stats.byStatus, '#006838', '📊') : ''}
        ${showVisitTypes ? generateBarChart('Encounters by Visit Type', stats.byVisitType, '#2563eb', '🏥') : ''}
        ${showDepartments ? generateBarChart('Encounters by Department', stats.byDepartment, '#7c3aed', '🏢') : ''}
        ${showPriority ? generateBarChart('Encounters by Priority', stats.byPriority, '#dc2626', '⚡') : ''}
      </div>

      <!-- Demographics Charts - Only show if demographics module enabled -->
      ${
        showDemographics
          ? `
      <div style="page-break-before: always; padding-top: 24px;">
        <h3 style="margin: 0 0 16px 0; font-size: 15px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
          👥 Demographics Analysis
        </h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
          ${generateBarChart('By Gender Distribution', stats.byGender, '#0891b2', '👤')}
          ${generateBarChart('By Age Group', stats.byAgeGroup, '#D96A36', '📅')}
          ${generateBarChart('By Patient Category', stats.byPatientCategory, '#65a30d', '🏷️')}
          ${showDoctors ? generateBarChart('Top Attending Doctors', stats.byDoctor, '#db2777', '👨‍⚕️') : ''}
        </div>
      </div>
      `
          : showDoctors
            ? `
      <div style="padding-top: 24px;">
        <h3 style="margin: 0 0 16px 0; font-size: 15px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
          👨‍⚕️ Doctors Analysis
        </h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
          ${generateBarChart('Top Attending Doctors', stats.byDoctor, '#db2777', '👨‍⚕️')}
        </div>
      </div>
      `
            : ''
      }

      <!-- Distribution Summary - Only show if status enabled -->
      ${
        showStatus || showDemographics
          ? `
      <div style="margin-top: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #374151;">📈 Distribution Overview</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
          ${
            showStatus
              ? `
          <div>
            <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">Status Distribution</h4>
            ${generatePieData(stats.byStatus, pieColors)}
          </div>
          `
              : ''
          }
          ${
            showDemographics
              ? `
          <div>
            <h4 style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">Gender Distribution</h4>
            ${generatePieData(stats.byGender, ['#0ea5e9', '#ec4899', '#8b5cf6'])}
          </div>
          `
              : ''
          }
        </div>
      </div>
      `
          : ''
      }

      <!-- Key Insights - Only show if timeline or encounters enabled -->
      ${
        showTimeline || showEncounterSummary
          ? `
      <div style="margin-top: 24px; background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #f59e0b; border-radius: 12px; padding: 20px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #92400e; display: flex; align-items: center; gap: 8px;">
          💡 Key Insights
        </h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #78350f; line-height: 1.8;">
          ${showEncounterSummary ? `<li>Total patient encounters in this report: <strong>${stats.total}</strong></li>` : ''}
          ${showVisitTypes ? `<li>Most common visit type: <strong>${sortedByCount(stats.byVisitType, 1)[0]?.[0] || 'N/A'}</strong></li>` : ''}
          ${showDepartments ? `<li>Busiest department: <strong>${sortedByCount(stats.byDepartment, 1)[0]?.[0] || 'N/A'}</strong></li>` : ''}
          ${showStatus ? `<li>Completion rate: <strong>${getPercentage(stats.completedCount, stats.total)}</strong></li>` : ''}
          ${showStatus ? `<li>Active case rate: <strong>${getPercentage(stats.activeCount, stats.total)}</strong></li>` : ''}
          ${showDemographics ? `<li>Average patient age: <strong>${stats.averageAge} years</strong></li>` : ''}
          ${showTimeline ? `<li>Reporting period: <strong>${stats.dateRange.earliest} - ${stats.dateRange.latest}</strong></li>` : ''}
        </ul>
      </div>
      `
          : ''
      }
    </div>
  `;
}

/**
 * Generate full PDF HTML content
 */
export function generateEncounterPDFContent(data: EncounterPDFData): string {
  const {
    encounters,
    filters,
    options,
    facilityName,
    facilityAddress,
    reportDate,
  } = data;
  const stats = calculateStats(encounters);
  const activeFilters = formatFiltersForDisplay(filters);
  const { enabledModules } = options;
  const isDefaultFilter = options.isDefaultFilter !== false; // Default to true if not specified

  // Helper to check if module is enabled
  const isModuleEnabled = (moduleId: string): boolean => {
    if (!enabledModules || enabledModules.length === 0) return true;
    return enabledModules.includes(moduleId);
  };

  const reportTitle = options.title || 'Encounter Summary Report';
  const reportSubtitle = options.subtitle || getFacilityName();
  const generatedDate = reportDate.toLocaleString();
  const generatedBy = options.generatedBy || 'System Administrator';

  // Determine filter status text
  const filterStatusText = isDefaultFilter
    ? 'All Records (Default Filter)'
    : `Filtered Export (${activeFilters.length} filters applied)`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <style>
    @page {
      size: ${options.pageSize} ${options.orientation};
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #111827;
      margin: 0;
      padding: 0;
    }
    .page-break {
      page-break-after: always;
    }
    .no-break {
      break-inside: avoid;
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #006838 0%, #008545 100%); color: white; padding: 24px; margin: -15mm -15mm 24px -15mm; display: flex; justify-content: space-between; align-items: center;">
    <div style="display: flex; align-items: center; gap: 20px;">
      <div style="background: white; padding: 8px; border-radius: 8px;">
        
      </div>
      <div>
        <h1 style="margin: 0; font-size: 20px; font-weight: bold;">${(facilityName || getFacilityName()).toUpperCase()}</h1>
        <h2 style="margin: 4px 0 0 0; font-size: 14px; font-weight: normal; opacity: 0.9;">${facilityAddress || getFacilityAddress()}</h2>
      </div>
    </div>
    <div style="text-align: right;">
      <h3 style="margin: 0; font-size: 16px;">${reportTitle}</h3>
      <p style="margin: 4px 0 0 0; font-size: 11px; opacity: 0.8;">Generated: ${generatedDate}</p>
      <p style="margin: 2px 0 0 0; font-size: 10px; opacity: 0.7;">By: ${generatedBy}</p>
    </div>
  </div>

  <!-- Report Info Section -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px;">
      <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${stats.total}</div>
      <div style="font-size: 11px; color: #15803d;">Total Encounters</div>
    </div>
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px;">
      <div style="font-size: 14px; font-weight: 600; color: #2563eb;">📅 Report Period</div>
      <div style="font-size: 11px; color: #1d4ed8; margin-top: 4px;">${stats.dateRange.earliest} - ${stats.dateRange.latest}</div>
    </div>
    <div style="background: ${isDefaultFilter ? '#f0fdf4' : '#fef3c7'}; border: 1px solid ${isDefaultFilter ? '#bbf7d0' : '#fde68a'}; border-radius: 8px; padding: 12px;">
      <div style="font-size: 14px; font-weight: 600; color: ${isDefaultFilter ? '#16a34a' : '#d97706'};">
        ${isDefaultFilter ? '✅' : '🔍'} Filter Status
      </div>
      <div style="font-size: 11px; color: ${isDefaultFilter ? '#15803d' : '#b45309'}; margin-top: 4px;">
        ${filterStatusText}
      </div>
    </div>
    <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 12px;">
      <div style="font-size: 14px; font-weight: 600; color: #7c3aed;">📊 Sections</div>
      <div style="font-size: 11px; color: #6d28d9; margin-top: 4px;">${enabledModules?.length || 'All'} modules included</div>
    </div>
  </div>

  ${
    activeFilters.length > 0
      ? `
  <!-- Applied Filters -->
  <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
    <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; color: #854d0e; text-transform: uppercase;">🔍 Active Filters:</p>
    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
      ${activeFilters.map((f) => `<span style="display: inline-block; padding: 4px 8px; background: white; border: 1px solid #d1d5db; border-radius: 4px; font-size: 10px;">${f}</span>`).join('')}
    </div>
  </div>
  `
      : `
  <!-- Default Filter Notice -->
  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
    <p style="margin: 0; font-size: 12px; color: #15803d;">
      <strong>✅ Default Filter Applied</strong> - This report contains all records from all modules.
    </p>
  </div>
  `
  }

  <!-- Encounters Table - Only show if encounters module is enabled -->
  ${
    isModuleEnabled('encounters')
      ? `
  <div style="margin-bottom: 24px;">
    <h2 style="margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #006838; color: #006838; font-size: 14px;">
      📋 Encounter Records (${encounters.length})
    </h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: linear-gradient(135deg, #006838, #008545); color: white;">
          <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Encounter #</th>
          <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Patient</th>
          <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Date</th>
          <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Clinic</th>
          <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Type</th>
          <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Status</th>
          <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Priority</th>
          <th style="padding: 10px 8px; text-align: left; font-weight: 600;">Doctor</th>
        </tr>
      </thead>
      <tbody>
        ${encounters
          .slice(0, 100)
          .map((enc, i) => generateEncounterRow(enc, i, options))
          .join('')}
        ${
          encounters.length > 100
            ? `
        <tr>
          <td colspan="8" style="padding: 12px; text-align: center; background: #fef3c7; color: #92400e; font-style: italic;">
            Showing first 100 of ${encounters.length} encounters. Export to CSV for complete data.
          </td>
        </tr>
        `
            : ''
        }
      </tbody>
    </table>
  </div>
  `
      : `
  <div style="margin-bottom: 24px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; text-align: center;">
    <p style="margin: 0; color: #6b7280; font-size: 12px;">
      <strong>Encounter Records Section</strong> - Excluded from this export based on selected modules.
    </p>
  </div>
  `
  }
  </div>

  ${options.includeStatistics ? generateStatisticsSection(stats, enabledModules) : ''}

  ${(() => {
    // Generate cross-module sections if data is provided
    const crossData = options.crossModuleData;
    if (!crossData) return '';

    const crossStats = calculateCrossModuleStats(crossData);
    let sections = '';

    // Add sections based on enabled modules
    if (isModuleEnabled('nursing')) {
      sections += generateNursingSection(crossData, crossStats);
    }
    if (isModuleEnabled('pharmacy')) {
      sections += generatePharmacySection(crossData, crossStats);
    }
    if (isModuleEnabled('radiology')) {
      sections += generateRadiologySection(crossData, crossStats);
    }
    if (isModuleEnabled('billing')) {
      sections += generateBillingSection(crossData, crossStats);
    }
    if (isModuleEnabled('inpatient') || isModuleEnabled('admissions')) {
      sections += generateInpatientSection(crossData, crossStats);
    }
    if (isModuleEnabled('procedures')) {
      sections += generateProceduresSection(crossData, crossStats);
    }
    if (isModuleEnabled('wards') && crossData.wardStats) {
      sections += generateWardStatisticsSection(crossData);
    }

    return sections;
  })()}

  <!-- Footer -->
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #6b7280;">
    <p style="margin: 0;">This report is confidential and intended for authorized personnel only.</p>
    <p style="margin: 4px 0 0 0;">${facilityName || getFacilityName()} - EMR System</p>
    <p style="margin: 4px 0 0 0;">Page generated on ${generatedDate}</p>
  </div>
</body>
</html>
  `;
}

/**
 * Open PDF in new window for printing
 */
export function openPDFPreview(htmlContent: string): void {
  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    // Wait for images to load before printing
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

/**
 * Save PDF/HTML report to Downloads folder and open in browser
 */
export async function saveAndOpenPDFReport(
  encounters: Encounter[],
  filters: ComprehensiveEncounterFilters,
  options: Partial<PDFExportOptions> = {},
): Promise<{
  success: boolean;
  filePath: string;
  filename: string;
  error?: string;
}> {
  const defaultOptions: PDFExportOptions = {
    title: 'Encounter Summary Report',
    subtitle: getFacilityName(),
    includePatientDetails: true,
    includeClinicalInfo: true,
    includeBillingInfo: false,
    includeStatistics: true,
    includeVitals: false,
    includeDiagnosis: true,
    groupByPatient: false,
    pageSize: 'A4',
    orientation: 'landscape',
    generatedBy: 'System Administrator',
  };

  const mergedOptions = { ...defaultOptions, ...options };

  const pdfData: EncounterPDFData = {
    encounters,
    filters,
    options: mergedOptions,
    facilityName: getFacilityName(),
    facilityAddress: getFacilityAddress(),
    reportDate: new Date(),
  };

  const htmlContent = generateEncounterPDFContent(pdfData);

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const time = new Date().toTimeString().slice(0, 5).replace(':', '');
  const filename = `XenoCare_Encounter_Report_${timestamp}_${time}.html`;

  try {
    // Check if we're in Electron environment
    if (fs && path && os && electron) {
      // Get Downloads folder path
      const downloadsPath = path.join(os.homedir(), 'Downloads');
      const filePath = path.join(downloadsPath, filename);

      // Write the HTML file
      fs.writeFileSync(filePath, htmlContent, 'utf-8');

      // Open the file in default browser using Electron shell
      const { shell } = electron;
      if (shell) {
        await shell.openPath(filePath);
      }

      return { success: true, filePath, filename };
    }
    // Fallback for non-Electron environment: download as file
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Also open in new tab
    window.open(url, '_blank');

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { success: true, filePath: `Downloads/${filename}`, filename };
  } catch (error) {
    console.error('Failed to save PDF report:', error);
    return {
      success: false,
      filePath: '',
      filename,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export encounters to PDF
 */
export function exportEncountersToPDF(
  encounters: Encounter[],
  filters: ComprehensiveEncounterFilters,
  options: Partial<PDFExportOptions> = {},
): void {
  const defaultOptions: PDFExportOptions = {
    title: 'Encounter Summary Report',
    subtitle: getFacilityName(),
    includePatientDetails: true,
    includeClinicalInfo: true,
    includeBillingInfo: false,
    includeStatistics: true,
    includeVitals: false,
    includeDiagnosis: true,
    groupByPatient: false,
    pageSize: 'A4',
    orientation: 'landscape',
    generatedBy: 'System Administrator',
  };

  const mergedOptions = { ...defaultOptions, ...options };

  const pdfData: EncounterPDFData = {
    encounters,
    filters,
    options: mergedOptions,
    facilityName: getFacilityName(),
    facilityAddress: getFacilityAddress(),
    reportDate: new Date(),
  };

  const htmlContent = generateEncounterPDFContent(pdfData);
  openPDFPreview(htmlContent);
}

/**
 * Generate and download PDF blob (for advanced use cases)
 */
export async function generatePDFBlob(
  encounters: Encounter[],
  filters: ComprehensiveEncounterFilters,
  options: Partial<PDFExportOptions> = {},
): Promise<Blob> {
  // For browser-based PDF generation, we use print-to-PDF
  // This function can be extended to use jsPDF or similar library
  const htmlContent = generateEncounterPDFContent({
    encounters,
    filters,
    options: {
      title: 'Encounter Report',
      includePatientDetails: true,
      includeClinicalInfo: true,
      includeBillingInfo: false,
      includeStatistics: true,
      includeVitals: false,
      includeDiagnosis: true,
      groupByPatient: false,
      pageSize: 'A4',
      orientation: 'landscape',
      ...options,
    } as PDFExportOptions,
    facilityName: getFacilityName(),
    facilityAddress: getFacilityAddress(),
    reportDate: new Date(),
  });

  return new Blob([htmlContent], { type: 'text/html' });
}

export default exportEncountersToPDF;

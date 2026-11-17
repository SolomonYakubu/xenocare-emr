/**
 * Discharge Summary Component
 * ===========================
 * Component for viewing and generating discharge summary documents
 * Includes diagnosis, procedures, medications, follow-up instructions
 */

import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import {
  FileText,
  Calendar,
  User,
  Building2,
  Bed,
  Stethoscope,
  Pill,
  AlertTriangle,
  Phone,
  Clock,
  Printer,
} from 'lucide-react';

export interface DischargeSummaryData {
  // Patient Info
  patientName: string;
  emrNumber: string;
  dateOfBirth: string;
  gender: string;
  phone?: string;
  address?: string;

  // Admission Info
  admissionNumber: string;
  admissionDate: string;
  dischargeDate: string;
  wardName: string;
  bedNumber: string;
  lengthOfStay: number;

  // Clinical Info
  admittingDiagnosis: string;
  primaryDischargeDiagnosis: string;
  secondaryDiagnoses?: string[];
  icd10Codes?: string[];
  chiefComplaint?: string;

  // Care Team
  attendingPhysician: string;
  consultingPhysicians?: string[];
  primaryNurse?: string;

  // Clinical Course
  briefHistory?: string;
  hospitalCourse?: string;
  proceduresPerformed?: string[];
  significantFindings?: string;

  // Discharge Details
  dischargeCondition: string;
  dischargeDisposition: string; // Home, SNF, Rehab, AMA, etc.

  // Medications
  dischargeMedications?: {
    name: string;
    dosage: string;
    frequency: string;
    duration?: string;
    instructions?: string;
  }[];

  // Follow-up
  followUpInstructions?: string;
  followUpAppointments?: {
    department: string;
    date?: string;
    notes?: string;
  }[];

  // Instructions
  activityRestrictions?: string;
  dietaryInstructions?: string;
  woundCareInstructions?: string;
  warningSignsToWatch?: string[];
  emergencyInstructions?: string;

  // Additional
  specialInstructions?: string;
  patientEducationProvided?: string[];
}

interface DischargeSummaryProps {
  data: DischargeSummaryData;
  facilityName?: string;
  facilityLogo?: string;
  showPrintButton?: boolean;
  onPrint?: () => void;
}

export const DischargeSummary = forwardRef<
  HTMLDivElement,
  DischargeSummaryProps
>(
  (
    {
      data,
      facilityName = 'XenoCare',
      facilityLogo,
      showPrintButton = true,
      onPrint,
    },
    ref,
  ) => {
    const handlePrint = () => {
      if (onPrint) {
        onPrint();
      } else {
        window.print();
      }
    };

    const calculateAge = (dob: string) => {
      const today = new Date();
      const birthDate = new Date(dob);
      let years = today.getFullYear() - birthDate.getFullYear();
      let months = today.getMonth() - birthDate.getMonth();
      let days = today.getDate() - birthDate.getDate();
      if (days < 0) {
        months--;
        const prev = new Date(today.getFullYear(), today.getMonth(), 0);
        days += prev.getDate();
      }
      if (months < 0) {
        years--;
        months += 12;
      }
      if (years === 0 && months === 0) {
        const weeks = Math.floor(days / 7);
        const rem = days % 7;
        if (weeks > 0 && rem > 0) return `${weeks}w ${rem}d`;
        if (weeks > 0) return `${weeks}w`;
        return `${days}d`;
      }
      if (years === 0) {
        const parts = [`${months}m`];
        if (days > 0) parts.push(`${days}d`);
        return parts.join(' ');
      }
      const parts = [`${years}y`];
      if (months > 0) parts.push(`${months}m`);
      if (days > 0) parts.push(`${days}d`);
      return parts.join(' ');
    };

    return (
      <div ref={ref} className="bg-white">
        {/* Print Button (hidden in print) */}
        {showPrintButton && (
          <div className="print:hidden mb-4 flex justify-end">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" />
              Print Summary
            </button>
          </div>
        )}

        {/* Summary Document */}
        <div className="border rounded-lg p-6 print:border-none print:p-0 space-y-6">
          {/* Header */}
          <div className="border-b pb-4 text-center">
            {facilityLogo && (
              <img
                src={facilityLogo}
                alt={facilityName}
                className="h-12 mx-auto mb-2"
              />
            )}
            <h1 className="text-xl font-bold text-gray-900">{facilityName}</h1>
            <h2 className="text-lg font-semibold text-blue-600 mt-1">
              DISCHARGE SUMMARY
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Document Generated: {format(new Date(), 'MMMM d, yyyy h:mm a')}
            </p>
          </div>

          {/* Patient & Admission Info */}
          <div className="grid grid-cols-2 gap-6 border-b pb-4">
            {/* Patient Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <User className="w-4 h-4" /> Patient Information
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex">
                  <span className="w-28 text-gray-500">Name:</span>
                  <span className="font-medium">{data.patientName}</span>
                </div>
                <div className="flex">
                  <span className="w-28 text-gray-500">Patient number:</span>
                  <span className="font-medium">{data.emrNumber}</span>
                </div>
                <div className="flex">
                  <span className="w-28 text-gray-500">Date of Birth:</span>
                  <span>
                    {format(new Date(data.dateOfBirth), 'MMMM d, yyyy')} (
                    {calculateAge(data.dateOfBirth)})
                  </span>
                </div>
                <div className="flex">
                  <span className="w-28 text-gray-500">Gender:</span>
                  <span>{data.gender}</span>
                </div>
                {data.phone && (
                  <div className="flex">
                    <span className="w-28 text-gray-500">Phone:</span>
                    <span>{data.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Admission Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Building2 className="w-4 h-4" /> Admission Details
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex">
                  <span className="w-28 text-gray-500">Admission #:</span>
                  <span className="font-medium">{data.admissionNumber}</span>
                </div>
                <div className="flex">
                  <span className="w-28 text-gray-500">Admitted:</span>
                  <span>
                    {format(new Date(data.admissionDate), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-28 text-gray-500">Discharged:</span>
                  <span>
                    {format(new Date(data.dischargeDate), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-28 text-gray-500">Length of Stay:</span>
                  <span>{data.lengthOfStay} days</span>
                </div>
                <div className="flex">
                  <span className="w-28 text-gray-500">Ward/Bed:</span>
                  <span>
                    {data.wardName} - Bed {data.bedNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Care Team */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <Stethoscope className="w-4 h-4" /> Care Team
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Attending Physician:</span>
                <span className="ml-2 font-medium">
                  Dr. {data.attendingPhysician}
                </span>
              </div>
              {data.consultingPhysicians &&
                data.consultingPhysicians.length > 0 && (
                  <div>
                    <span className="text-gray-500">Consulting:</span>
                    <span className="ml-2">
                      {data.consultingPhysicians.join(', ')}
                    </span>
                  </div>
                )}
              {data.primaryNurse && (
                <div>
                  <span className="text-gray-500">Primary Nurse:</span>
                  <span className="ml-2">{data.primaryNurse}</span>
                </div>
              )}
            </div>
          </div>

          {/* Diagnoses */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Diagnoses
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Admitting Diagnosis:</span>
                <p className="mt-0.5">{data.admittingDiagnosis}</p>
              </div>
              <div>
                <span className="text-gray-500">
                  Primary Discharge Diagnosis:
                </span>
                <p className="mt-0.5 font-medium">
                  {data.primaryDischargeDiagnosis}
                </p>
                {data.icd10Codes && data.icd10Codes.length > 0 && (
                  <p className="text-xs text-gray-400">
                    ICD-10: {data.icd10Codes.join(', ')}
                  </p>
                )}
              </div>
              {data.secondaryDiagnoses &&
                data.secondaryDiagnoses.length > 0 && (
                  <div>
                    <span className="text-gray-500">Secondary Diagnoses:</span>
                    <ul className="mt-0.5 list-disc list-inside">
                      {data.secondaryDiagnoses.map((dx, i) => (
                        <li key={i}>{dx}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </div>

          {/* Hospital Course */}
          {(data.briefHistory || data.hospitalCourse) && (
            <div className="border-b pb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Hospital Course
              </h3>
              {data.briefHistory && (
                <div className="mb-2">
                  <span className="text-xs text-gray-500">Brief History:</span>
                  <p className="text-sm">{data.briefHistory}</p>
                </div>
              )}
              {data.hospitalCourse && (
                <div>
                  <span className="text-xs text-gray-500">Course Summary:</span>
                  <p className="text-sm">{data.hospitalCourse}</p>
                </div>
              )}
            </div>
          )}

          {/* Procedures */}
          {data.proceduresPerformed && data.proceduresPerformed.length > 0 && (
            <div className="border-b pb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Procedures Performed
              </h3>
              <ul className="list-disc list-inside text-sm">
                {data.proceduresPerformed.map((proc, i) => (
                  <li key={i}>{proc}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Discharge Condition */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Discharge Status
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Condition at Discharge:</span>
                <span className="ml-2 font-medium">
                  {data.dischargeCondition}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Discharge To:</span>
                <span className="ml-2">{data.dischargeDisposition}</span>
              </div>
            </div>
          </div>

          {/* Discharge Medications */}
          {data.dischargeMedications &&
            data.dischargeMedications.length > 0 && (
              <div className="border-b pb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <Pill className="w-4 h-4" /> Discharge Medications
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">
                          Medication
                        </th>
                        <th className="text-left py-2 px-3 font-medium">
                          Dosage
                        </th>
                        <th className="text-left py-2 px-3 font-medium">
                          Frequency
                        </th>
                        <th className="text-left py-2 px-3 font-medium">
                          Duration
                        </th>
                        <th className="text-left py-2 px-3 font-medium">
                          Instructions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.dischargeMedications.map((med, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium">{med.name}</td>
                          <td className="py-2 px-3">{med.dosage}</td>
                          <td className="py-2 px-3">{med.frequency}</td>
                          <td className="py-2 px-3">{med.duration || '-'}</td>
                          <td className="py-2 px-3">
                            {med.instructions || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* Follow-up Instructions */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Follow-up
            </h3>
            {data.followUpInstructions && (
              <p className="text-sm mb-2">{data.followUpInstructions}</p>
            )}
            {data.followUpAppointments &&
              data.followUpAppointments.length > 0 && (
                <div className="space-y-2">
                  {data.followUpAppointments.map((appt, i) => (
                    <div key={i} className="text-sm bg-gray-50 p-2 rounded">
                      <span className="font-medium">{appt.department}</span>
                      {appt.date && <span className="ml-2">- {appt.date}</span>}
                      {appt.notes && (
                        <p className="text-gray-500 text-xs mt-1">
                          {appt.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Activity & Diet */}
          {(data.activityRestrictions || data.dietaryInstructions) && (
            <div className="border-b pb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Activity & Diet
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {data.activityRestrictions && (
                  <div>
                    <span className="text-gray-500 block">
                      Activity Restrictions:
                    </span>
                    <p>{data.activityRestrictions}</p>
                  </div>
                )}
                {data.dietaryInstructions && (
                  <div>
                    <span className="text-gray-500 block">
                      Dietary Instructions:
                    </span>
                    <p>{data.dietaryInstructions}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warning Signs */}
          {data.warningSignsToWatch && data.warningSignsToWatch.length > 0 && (
            <div className="border-b pb-4">
              <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Warning Signs - Seek
                Immediate Medical Attention If:
              </h3>
              <ul className="list-disc list-inside text-sm text-red-700 bg-red-50 p-3 rounded">
                {data.warningSignsToWatch.map((sign, i) => (
                  <li key={i}>{sign}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Emergency Contact */}
          {data.emergencyInstructions && (
            <div className="bg-amber-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-1">
                <Phone className="w-4 h-4" /> Emergency Information
              </h3>
              <p className="text-sm text-amber-700">
                {data.emergencyInstructions}
              </p>
            </div>
          )}

          {/* Signature Section */}
          <div className="mt-8 pt-4 border-t">
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="border-b border-gray-400 mb-2 h-10" />
                <p className="text-sm text-gray-600">
                  Attending Physician Signature
                </p>
                <p className="text-xs text-gray-400">
                  Dr. {data.attendingPhysician}
                </p>
              </div>
              <div className="text-center">
                <div className="border-b border-gray-400 mb-2 h-10" />
                <p className="text-sm text-gray-600">
                  Patient / Guardian Signature
                </p>
                <p className="text-xs text-gray-400">{data.patientName}</p>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">
              Date: {format(new Date(data.dischargeDate), 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
      </div>
    );
  },
);

DischargeSummary.displayName = 'DischargeSummary';

export default DischargeSummary;

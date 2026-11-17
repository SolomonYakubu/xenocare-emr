import React, { useState } from 'react';
import {
  X,
  User,
  FlaskConical,
  Stethoscope,
  Clock,
  FileText,
  Beaker,
  TestTube,
  AlertTriangle,
  CheckCircle,
  Droplets,
  CreditCard,
  Receipt,
  ClipboardList,
  Printer,
  Download,
  Activity,
  Microscope,
  Pill,
  Thermometer,
  ChevronLeft, // Added
  ChevronRight, // Added
} from 'lucide-react';
import { Button } from '../../../components/ui/FormElements';
import {
  getFacilityAddress,
  getFacilityName,
} from '../../../lib/facility';
import { StatusBadge } from '../../../components/ui/DataDisplay';
import {
  PaymentStatusBadge,
  getPaymentStatusFromBillingOrder,
} from '../../../components/workflow';
import {
  LabRequestDTO,
  LabRequestStatus,
  getLabCategoryColor,
  getSampleTypeColor,
  getResultStatusColor,
  LabCategory,
  SampleType,
} from '../dtos/lab.dto';
import {
  formatPatientName,
  formatDetailedAge,
} from '../../patient-registration/dtos/patient.dto';
import type { PaymentStatusMap } from '../../billing/hooks/useBillingOrders';
import { formatCurrency } from '../../billing/dtos/billing-order.dto';
import { useLabReportRequests } from '../hooks/useLab';
import { printUniversalLabReport } from '../utils/labReportPrint';
import { sanitizeClinicalHtml } from '../utils/clinicalDataHtml';
import { MUHEDA_LOGO_DATA_URI } from '../../../shared/constants/muhedaLogo';

interface LabDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: LabRequestDTO | null;
  onCollectSample?: (request: LabRequestDTO) => void;
  onEnterResult?: (request: LabRequestDTO) => void;
  paymentInfo?: PaymentStatusMap[string];
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

// Map status to StatusBadge variant
function getStatusVariant(
  status: LabRequestStatus,
): 'warning' | 'info' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'Pending':
      return 'warning';
    case 'Sample Collected':
      return 'info';
    case 'In Progress':
      return 'info';
    case 'Completed':
      return 'success';
    case 'Cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

// Helper function to render structured result based on template type
function renderStructuredResult(
  structuredResult: Record<string, unknown> | undefined | null,
  templateType: string | undefined | null,
): React.ReactNode {
  if (!structuredResult) return null;

  const data = structuredResult as Record<string, any>;

  if (templateType === 'clinical_data' || typeof data.html === 'string') {
    return (
      <div
        className="clinical-data-render rounded-xl border border-gray-200 bg-white p-5 text-sm leading-7 text-gray-800 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-bold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:p-2 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{
          __html: sanitizeClinicalHtml(String(data.html || '')),
        }}
      />
    );
  }

  // Reusable Section Header for uniformity
  function ResultSectionHeader({
    title,
    icon: Icon,
  }: {
    title: string;
    icon?: any;
  }) {
    return (
      <div className="flex items-center gap-2 mb-3 mt-6 pb-2 border-b border-gray-200 first:mt-0">
        {Icon && <Icon className="h-4 w-4 text-gray-500" />}
        <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
          {title}
        </h4>
      </div>
    );
  }

  switch (templateType) {
    case 'numeric_table':
    case 'panel_numeric': {
      // Handle both formats: parameters/results (numeric_table) and panels (panel_numeric)
      const params = data.parameters || data.results || [];
      const panels = data.panels || [];

      // Handle panel_numeric format with panels[].analytes[]
      if (panels.length > 0) {
        const rows = panels.flatMap(
          (g: any) =>
            g.analytes?.map((a: any) => ({ group: g.groupName, ...a })) || [],
        );
        if (rows.length === 0) {
          return (
            <p className="text-sm text-gray-500 italic py-2">
              No parameters recorded
            </p>
          );
        }
        return (
          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Panel / Analyte
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Result
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Ref. Range
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Flag
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((a: any, idx: number) => {
                  const isAbnormal =
                    a.flag === 'H' ||
                    a.flag === 'L' ||
                    a.flag === 'High' ||
                    a.flag === 'Low' ||
                    a.isAbnormal;
                  const isCritical =
                    a.flag === 'C' ||
                    a.flag === 'CC' ||
                    a.flag === 'Critical Low' ||
                    a.flag === 'Critical High' ||
                    a.isCritical;
                  return (
                    <tr
                      key={idx}
                      className={
                        isCritical
                          ? 'bg-red-50'
                          : isAbnormal
                            ? 'bg-amber-50'
                            : 'hover:bg-gray-50'
                      }
                    >
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        {a.group && a.group !== 'Additional Parameters'
                          ? `${a.group}: `
                          : ''}
                        {a.analyte || a.parameter || a.name}
                      </td>
                      <td
                        className={`px-4 py-2 text-sm font-bold ${isCritical ? 'text-red-700' : isAbnormal ? 'text-amber-700' : 'text-gray-900'}`}
                      >
                        {a.resultValue ?? a.value ?? a.result ?? 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {a.unit || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                        {a.referenceRange || a.reference || '-'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {(a.flag || a.isAbnormal || a.isCritical) && (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                              isCritical
                                ? 'bg-red-100 text-red-800'
                                : isAbnormal
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {a.flag ||
                              (isCritical
                                ? 'Critical'
                                : isAbnormal
                                  ? 'Abnormal'
                                  : 'Normal')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      // Handle numeric_table format with parameters/results array
      if (!Array.isArray(params) || params.length === 0) {
        return (
          <p className="text-sm text-gray-500 italic py-2">
            No parameters recorded
          </p>
        );
      }
      return (
        <div className="overflow-x-auto border border-gray-200 rounded-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Test / Analyte
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Result
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Ref. Range
                </th>
                <th className="px-4 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {params.map((param: any, idx: number) => {
                const isAbnormal =
                  param.flag === 'H' ||
                  param.flag === 'L' ||
                  param.flag === 'High' ||
                  param.flag === 'Low' ||
                  param.isAbnormal;
                const isCritical =
                  param.flag === 'C' ||
                  param.flag === 'CC' ||
                  param.flag === 'Critical Low' ||
                  param.flag === 'Critical High' ||
                  param.isCritical;
                return (
                  <tr
                    key={idx}
                    className={
                      isCritical
                        ? 'bg-red-50'
                        : isAbnormal
                          ? 'bg-amber-50'
                          : 'hover:bg-gray-50'
                    }
                  >
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {param.name || param.parameter}
                    </td>
                    <td
                      className={`px-4 py-2 text-sm font-bold ${isCritical ? 'text-red-700' : isAbnormal ? 'text-amber-700' : 'text-gray-900'}`}
                    >
                      {param.resultValue ??
                        param.value ??
                        param.result ??
                        'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {param.unit || '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                      {param.referenceRange || param.reference || '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {(param.flag || param.isAbnormal || param.isCritical) && (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                            isCritical
                              ? 'bg-red-100 text-red-800'
                              : isAbnormal
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {param.flag ||
                            (isCritical
                              ? 'Critical'
                              : isAbnormal
                                ? 'Abnormal'
                                : 'Normal')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    case 'culture_sensitivity': {
      return (
        <div className="space-y-6">
          {/* Specimen Info */}
          {data.specimenInfo && (
            <div>
              <ResultSectionHeader
                title="Specimen Information"
                icon={Droplets}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-gray-50 p-4 rounded border border-gray-200">
                {data.specimenInfo.specimenType && (
                  <div>
                    <span className="text-gray-500 block text-xs uppercase">
                      Specimen Type
                    </span>{' '}
                    <span className="font-semibold text-gray-900">
                      {data.specimenInfo.specimenType}
                    </span>
                  </div>
                )}
                {data.specimenInfo.collectionDate && (
                  <div>
                    <span className="text-gray-500 block text-xs uppercase">
                      Collection Date
                    </span>{' '}
                    <span className="font-semibold text-gray-900">
                      {new Date(
                        data.specimenInfo.collectionDate,
                      ).toLocaleString()}
                    </span>
                  </div>
                )}
                {data.specimenInfo.specimenQuality && (
                  <div>
                    <span className="text-gray-500 block text-xs uppercase">
                      Quality / Appearance
                    </span>{' '}
                    <span className="font-semibold text-gray-900">
                      {data.specimenInfo.specimenQuality}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Microscopy */}
          {data.microscopy && (
            <div>
              <ResultSectionHeader
                title="Microscopy Findings"
                icon={Microscope}
              />
              <div className="bg-white border border-gray-200 rounded overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(data.microscopy).map(([key, value]) => {
                      if (!value || key === 'otherFindings') return null;
                      return (
                        <tr key={key}>
                          <td className="px-4 py-2 bg-gray-50 w-1/3 text-xs font-bold text-gray-500 uppercase">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                            {String(value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {data.microscopy.otherFindings && (
                  <div className="p-3 bg-gray-50 border-t border-gray-200">
                    <span className="text-xs font-bold text-gray-500 uppercase block mb-1">
                      Other Microscopy Findings
                    </span>
                    <p className="text-sm text-gray-900">
                      {data.microscopy.otherFindings}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cultures */}
          {data.cultures &&
            Array.isArray(data.cultures) &&
            data.cultures.length > 0 && (
              <div>
                <ResultSectionHeader
                  title="Culture Results"
                  icon={FlaskConical}
                />
                <div className="space-y-4">
                  {data.cultures.map((culture: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 bg-white border border-gray-200 rounded shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                        <div>
                          <span className="text-xs font-bold text-gray-500 uppercase">
                            Isolate #{idx + 1}
                          </span>
                          <h5 className="text-lg font-bold text-gray-900">
                            {culture.organismIsolated || 'No Organism Isolated'}
                          </h5>
                        </div>
                        {culture.growth && (
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${
                              culture.growth === 'No Growth'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {culture.growth}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                        {culture.colonyCount && (
                          <div>
                            <span className="text-gray-500 text-xs uppercase block">
                              Colony Count
                            </span>{' '}
                            <span className="font-medium">
                              {culture.colonyCount}
                            </span>
                          </div>
                        )}
                        {culture.incubationTime && (
                          <div>
                            <span className="text-gray-500 text-xs uppercase block">
                              Incubation Period
                            </span>{' '}
                            <span className="font-medium">
                              {culture.incubationTime} hours
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Legacy Organism field */}
          {data.organism && !data.cultures && (
            <div>
              <ResultSectionHeader
                title="Culture Results"
                icon={FlaskConical}
              />
              <div className="p-4 bg-white border border-gray-200 rounded">
                <h5 className="text-lg font-bold text-gray-900">
                  {data.organism}
                </h5>
                {data.colonyCount && (
                  <p className="text-sm text-gray-600 mt-1">
                    Colony Count: {data.colonyCount}
                  </p>
                )}
                {data.growthStatus && (
                  <div
                    className={`mt-2 inline-block px-3 py-1 rounded text-xs font-bold uppercase ${
                      data.growthStatus.toLowerCase().includes('no')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {data.growthStatus}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sensitivities */}
          {data.sensitivities &&
            Array.isArray(data.sensitivities) &&
            data.sensitivities.length > 0 && (
              <div>
                <ResultSectionHeader
                  title="Antibiotic Susceptibility Testing"
                  icon={Pill}
                />
                <div className="space-y-4">
                  {data.sensitivities.map((sens: any, sIdx: number) => (
                    <div
                      key={sIdx}
                      className="bg-white border border-gray-200 rounded overflow-hidden"
                    >
                      {/* If sensitivities has nested antibiotics array (new format) */}
                      {sens.antibiotics && Array.isArray(sens.antibiotics) ? (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">
                                Antibiotic Agent
                              </th>
                              <th className="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase">
                                Interpretation
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {sens.antibiotics.map((ab: any, abIdx: number) => {
                              const res = (ab.result || '').toUpperCase();
                              const colorClass = res.startsWith('S')
                                ? 'text-green-700 bg-green-50'
                                : res.startsWith('R')
                                  ? 'text-red-700 bg-red-50'
                                  : 'text-amber-700 bg-amber-50';
                              return (
                                <tr key={abIdx}>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                    {ab.antibiotic}
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold w-16 text-center ${colorClass}`}
                                    >
                                      {ab.result}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        /* Legacy flat format */
                        <div className="p-3 flex justify-between items-center hover:bg-gray-50 border-b last:border-0 border-gray-100">
                          <span className="font-medium text-gray-900">
                            {sens.antibiotic || sens.name}
                          </span>
                          <span
                            className={`font-bold text-sm px-2 py-1 rounded ${
                              (sens.result || sens.sensitivity) ===
                                'Sensitive' ||
                              (sens.result || sens.sensitivity) === 'S'
                                ? 'bg-green-100 text-green-800'
                                : (sens.result || sens.sensitivity) ===
                                      'Resistant' ||
                                    (sens.result || sens.sensitivity) === 'R'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sens.result || sens.sensitivity}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      );
    }

    case 'urinalysis_checklist': {
      const sections = ['physical', 'chemical', 'microscopy'];

      // Helper to format array values nicely
      const formatValue = (value: unknown): string => {
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(', ') : '-';
        }
        if (value === null || value === undefined || value === '') {
          return '-';
        }
        return String(value);
      };

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sections.map((section) => {
              const sectionData = data[section];
              if (!sectionData || typeof sectionData !== 'object') return null;
              return (
                <div
                  key={section}
                  className="border border-gray-200 rounded bg-white"
                >
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {section} Examination
                    </h4>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Object.entries(sectionData).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between px-4 py-2 text-sm hover:bg-gray-50"
                      >
                        <span className="text-gray-600 capitalize">
                          {key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/_/g, ' ')
                            .trim()}
                        </span>
                        <span className="font-semibold text-gray-900 text-right max-w-[60%]">
                          {formatValue(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comments/Interpretation */}
          {data.comments && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded">
              <p className="text-xs font-bold text-amber-700 uppercase mb-1">
                Technician Comments
              </p>
              <p className="text-sm text-amber-900">{data.comments}</p>
            </div>
          )}
          {data.interpretation && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs font-bold text-blue-700 uppercase mb-1">
                Interpretation
              </p>
              <p className="text-sm text-blue-900">{data.interpretation}</p>
            </div>
          )}
        </div>
      );
    }

    case 'parasite_report': {
      return (
        <div className="space-y-6">
          {/* Specimen Info */}
          {(data.specimenType || data.specimenInfo?.specimenType) && (
            <div>
              <ResultSectionHeader title="Specimen Details" icon={Droplets} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-gray-50 p-4 rounded border border-gray-200">
                <div>
                  <span className="text-gray-500 text-xs uppercase block">
                    Specimen
                  </span>{' '}
                  <span className="font-bold text-gray-900">
                    {data.specimenType || data.specimenInfo?.specimenType}
                  </span>
                </div>
                {data.collectionTime && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase block">
                      Collection Time
                    </span>{' '}
                    <span className="font-medium text-gray-900">
                      {data.collectionTime}
                    </span>
                  </div>
                )}
                {data.examinationMethod && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase block">
                      Method
                    </span>{' '}
                    <span className="font-medium text-gray-900">
                      {data.examinationMethod}
                    </span>
                  </div>
                )}
                {data.fieldsExamined && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase block">
                      Fields Examined
                    </span>{' '}
                    <span className="font-medium text-gray-900">
                      {data.fieldsExamined}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Parasite Detection Status */}
          {data.parasitesFound !== undefined && (
            <div
              className={`p-4 rounded border-l-4 ${
                data.parasitesFound
                  ? 'bg-red-50 border-red-500 text-red-900'
                  : 'bg-green-50 border-green-500 text-green-900'
              }`}
            >
              <div className="flex items-center gap-3">
                {data.parasitesFound ? (
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                )}
                <div>
                  <span className="block text-lg font-bold uppercase tracking-tight">
                    {data.parasitesFound
                      ? 'Parasites Detected'
                      : 'No Parasites Detected'}
                  </span>
                  <span className="text-sm opacity-80">
                    {data.parasitesFound
                      ? 'See detailed findings below.'
                      : 'No parasitic organisms were observed in the sample.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Detections (new format: parasitesFound from form, or legacy detections) */}
          {((data.parasitesFound &&
            Array.isArray(data.parasitesFound) &&
            data.parasitesFound.length > 0) ||
            (data.detections &&
              Array.isArray(data.detections) &&
              data.detections.length > 0)) && (
            <div>
              <ResultSectionHeader
                title="Detailed Findings"
                icon={Microscope}
              />
              <div className="space-y-2">
                {(data.parasitesFound || data.detections).map(
                  (det: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded"
                    >
                      <div>
                        <p className="font-bold text-red-900">
                          {det.species || det.parasite || det.name}
                        </p>
                        <div className="flex gap-4 text-xs text-red-700 mt-1">
                          {det.stage && (
                            <span>
                              <strong>Stage:</strong> {det.stage}
                            </span>
                          )}
                          {(det.form || det.density) && (
                            <span>
                              <strong>{det.form ? 'Form' : 'Density'}:</strong>{' '}
                              {det.form || det.density}
                            </span>
                          )}
                          {det.countPer && (
                            <span>
                              <strong>Per:</strong> {det.countPer}
                            </span>
                          )}
                        </div>
                      </div>
                      {det.count && (
                        <div className="text-right">
                          <span className="text-xs uppercase text-red-600 block">
                            Count
                          </span>
                          <span className="font-bold text-red-900">
                            {det.count}
                          </span>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Legacy organisms field */}
          {data.organisms &&
            Array.isArray(data.organisms) &&
            data.organisms.length > 0 && (
              <div className="space-y-2">
                <ResultSectionHeader
                  title="Organisms Detected"
                  icon={Microscope}
                />
                {data.organisms.map((org: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-gray-200 rounded flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-gray-900">{org.name}</p>
                      {org.stage && (
                        <p className="text-xs text-gray-500">
                          Stage: {org.stage}
                        </p>
                      )}
                    </div>
                    {org.count && (
                      <div className="text-right">
                        <span className="text-xs uppercase text-gray-500 block">
                          Count
                        </span>
                        <span className="font-bold text-gray-900">
                          {org.count}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          {/* Other Findings */}
          {data.otherFindings && (
            <div className="mt-4">
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-1">
                Other Findings
              </h5>
              <p className="text-sm text-gray-900 p-3 bg-gray-50 rounded border border-gray-200">
                {data.otherFindings}
              </p>
            </div>
          )}

          {/* Notes/Remarks */}
          {(data.remarks || data.notes) && (
            <div className="mt-4">
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-1">
                Remarks / Notes
              </h5>
              <p className="text-sm text-gray-700 p-3 bg-amber-50 rounded border border-amber-200">
                {data.remarks || data.notes}
              </p>
            </div>
          )}
        </div>
      );
    }

    case 'qualitative_quantitative': {
      // Form saves: qualitativeResult, signalCutoff, quantitative: {concentration, titer, unit, referenceRange}
      // confirmation: {test, result, date}, interpretation, notes
      const qualResult = data.qualitative || data.qualitativeResult;
      const quantObj =
        typeof data.quantitative === 'object' && data.quantitative !== null
          ? data.quantitative
          : null;
      const quantValue = quantObj
        ? (quantObj.concentration ?? quantObj.titer ?? quantObj.value)
        : (data.quantitative ?? data.quantitativeValue);
      const unitVal = quantObj?.unit || data.unit || data.resultUnit;
      const refRange =
        quantObj?.referenceRange || data.reference || data.referenceRange;
      const interpretation = data.interpretation || data.notes;
      const titerVal = quantObj?.titer;

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {qualResult && (
              <div
                className={`p-6 rounded border text-center ${
                  qualResult === 'Positive' ||
                  qualResult === 'Reactive' ||
                  qualResult === 'Detected'
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-green-50 border-green-200 text-green-900'
                }`}
              >
                <p className="text-sm font-bold uppercase tracking-wider opacity-70 mb-2">
                  Qualitative Result
                </p>
                <p className="text-3xl font-extrabold">{qualResult}</p>
              </div>
            )}
            {quantValue !== undefined &&
              quantValue !== null &&
              quantValue !== '' && (
                <div className="p-6 bg-white rounded border border-gray-200 text-center">
                  <p className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Quantitative Value
                  </p>
                  <p className="text-3xl font-extrabold text-blue-900">
                    {quantValue}{' '}
                    <span className="text-lg text-gray-500 font-normal">
                      {unitVal || ''}
                    </span>
                  </p>
                  {refRange && (
                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 inline-block px-2 py-1 rounded">
                      Ref: {refRange}
                    </p>
                  )}
                </div>
              )}
          </div>

          {/* Titer (if separate from concentration) */}
          {titerVal && quantObj?.concentration !== undefined && (
            <div className="p-4 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                Titer
              </p>
              <p className="text-lg font-bold text-gray-900">{titerVal}</p>
            </div>
          )}

          {/* Signal/Cutoff */}
          {data.signalCutoff !== undefined && (
            <div className="p-4 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                Signal / Cutoff Ratio
              </p>
              <p className="text-lg font-bold text-gray-900">
                {data.signalCutoff}
              </p>
            </div>
          )}

          {/* Confirmation Testing */}
          {data.confirmation &&
            (data.confirmation.test || data.confirmation.result) && (
              <div className="p-4 bg-purple-50 rounded border border-purple-200">
                <p className="text-xs text-purple-700 uppercase font-bold mb-2">
                  Confirmation Testing
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {data.confirmation.test && (
                    <div>
                      <span className="text-purple-600 text-xs block">
                        Test
                      </span>
                      <span className="font-bold">
                        {data.confirmation.test}
                      </span>
                    </div>
                  )}
                  {data.confirmation.result && (
                    <div>
                      <span className="text-purple-600 text-xs block">
                        Result
                      </span>
                      <span className="font-bold">
                        {data.confirmation.result}
                      </span>
                    </div>
                  )}
                  {data.confirmation.date && (
                    <div>
                      <span className="text-purple-600 text-xs block">
                        Date
                      </span>
                      <span className="font-medium">
                        {data.confirmation.date}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {interpretation && (
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs text-blue-700 uppercase font-bold mb-1">
                Interpretation
              </p>
              <p className="text-sm text-blue-900 whitespace-pre-wrap">
                {interpretation}
              </p>
            </div>
          )}
        </div>
      );
    }

    case 'binary_metadata': {
      // Form saves: detected (boolean), target, method, kitInfo: {name, manufacturer, lotNumber, expiryDate}
      // qcChecklist: Record<string, boolean>, controlResults: {positiveControl, negativeControl}, ctValue, interpretation, notes
      const binResult =
        data.result ||
        (data.detected === true
          ? 'Detected'
          : data.detected === false
            ? 'Not Detected'
            : undefined);
      const kitLotDisplay = data.kitLot || data.kitInfo?.lotNumber;
      const kitNameDisplay = data.kitInfo?.name;
      const kitManufacturer = data.kitInfo?.manufacturer;
      const isPositive =
        binResult === 'Positive' ||
        binResult === 'Reactive' ||
        binResult === 'Detected';
      return (
        <div className="space-y-6">
          {binResult && (
            <div
              className={`p-6 rounded border text-center ${
                isPositive
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-green-50 border-green-200 text-green-900'
              }`}
            >
              <p className="text-sm font-bold uppercase tracking-wider opacity-70 mb-2">
                Test Result
              </p>
              <p className="text-3xl font-extrabold">{binResult}</p>
            </div>
          )}
          {data.target && (
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-bold">
                Target
              </p>
              <p className="text-sm font-medium">{data.target}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {data.method && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs text-gray-500 uppercase font-bold">
                  Method
                </p>
                <p className="text-sm font-medium">{data.method}</p>
              </div>
            )}
            {kitLotDisplay && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs text-gray-500 uppercase font-bold">
                  Kit / Lot #
                </p>
                <p className="text-sm font-medium">{kitLotDisplay}</p>
              </div>
            )}
            {kitNameDisplay && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs text-gray-500 uppercase font-bold">
                  Kit Name
                </p>
                <p className="text-sm font-medium">
                  {kitNameDisplay}
                  {kitManufacturer ? ` (${kitManufacturer})` : ''}
                </p>
              </div>
            )}
            {data.kitInfo?.expiryDate && (
              <div className="p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs text-gray-500 uppercase font-bold">
                  Kit Expiry
                </p>
                <p className="text-sm font-medium">{data.kitInfo.expiryDate}</p>
              </div>
            )}
          </div>
          {data.ctValue !== undefined && data.ctValue !== null && (
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-bold">
                Ct Value
              </p>
              <p className="text-lg font-bold">{data.ctValue}</p>
            </div>
          )}
          {/* QC Checklist */}
          {data.qcChecklist && Object.keys(data.qcChecklist).length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">
                QC Checklist
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(data.qcChecklist).map(
                  ([key, val]: [string, any]) => (
                    <div
                      key={key}
                      className={`px-3 py-2 rounded border text-xs font-medium ${val ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}
                    >
                      {key.replace(/([A-Z])/g, ' $1').trim()}: {val ? '✓' : '✗'}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
          {/* Control Results */}
          {data.controlResults && (
            <div className="grid grid-cols-2 gap-4">
              {data.controlResults.positiveControl && (
                <div className="p-3 bg-gray-50 rounded border">
                  <span className="text-xs text-gray-500 uppercase block">
                    Positive Control
                  </span>
                  <span className="font-bold">
                    {data.controlResults.positiveControl}
                  </span>
                </div>
              )}
              {data.controlResults.negativeControl && (
                <div className="p-3 bg-gray-50 rounded border">
                  <span className="text-xs text-gray-500 uppercase block">
                    Negative Control
                  </span>
                  <span className="font-bold">
                    {data.controlResults.negativeControl}
                  </span>
                </div>
              )}
            </div>
          )}
          {(data.interpretation || data.notes) && (
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs text-blue-700 uppercase font-bold mb-1">
                Interpretation / Notes
              </p>
              <p className="text-sm text-blue-900 whitespace-pre-wrap">
                {data.interpretation || data.notes}
              </p>
            </div>
          )}
        </div>
      );
    }

    case 'narrative_diagnostic': {
      // Form saves: macroscopy.grossDescription, microscopy.microscopicFindings, finalDiagnosis, diagnosis.finalDiagnosis
      // Also: specimenType, specimenSite, specimenDescription, fixationType, clinicalHistory, specialStains, specialStainResults
      // tumorGrade, ptnmStage, marginStatus, comments, addendum
      const grossDesc =
        typeof data.macroscopy === 'object'
          ? data.macroscopy?.grossDescription
          : data.macroscopy;
      const microDesc =
        typeof data.microscopy === 'object'
          ? data.microscopy?.microscopicFindings
          : data.microscopy;
      const finalDx =
        data.finalDiagnosis ||
        (typeof data.diagnosis === 'object'
          ? data.diagnosis?.finalDiagnosis
          : data.diagnosis);
      const findings = data.findings || grossDesc; // legacy fallback
      const impression = data.impression || finalDx; // legacy fallback
      const recommendation = data.recommendation || data.comments; // legacy fallback

      return (
        <div className="space-y-6">
          {/* Specimen Info */}
          {(data.specimenType || data.specimenSite) && (
            <div>
              <ResultSectionHeader title="Specimen Details" icon={FileText} />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-gray-50 p-4 rounded border border-gray-200">
                {data.specimenType && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase block">
                      Type
                    </span>
                    <span className="font-bold text-gray-900">
                      {data.specimenType}
                    </span>
                  </div>
                )}
                {data.specimenSite && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase block">
                      Site
                    </span>
                    <span className="font-bold text-gray-900">
                      {data.specimenSite}
                    </span>
                  </div>
                )}
                {data.fixationType && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase block">
                      Fixation
                    </span>
                    <span className="font-medium text-gray-900">
                      {data.fixationType}
                    </span>
                  </div>
                )}
                {data.specimenSize && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase block">
                      Size
                    </span>
                    <span className="font-medium text-gray-900">
                      {data.specimenSize}
                    </span>
                  </div>
                )}
                {data.specimenWeight && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase block">
                      Weight
                    </span>
                    <span className="font-medium text-gray-900">
                      {data.specimenWeight}g
                    </span>
                  </div>
                )}
                {data.blocksSubmitted && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase block">
                      Blocks
                    </span>
                    <span className="font-medium text-gray-900">
                      {data.blocksSubmitted}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {data.clinicalHistory && (
            <div>
              <ResultSectionHeader title="Clinical History" icon={FileText} />
              <div className="p-4 bg-white border border-gray-200 rounded text-sm text-gray-800 whitespace-pre-wrap">
                {data.clinicalHistory}
              </div>
            </div>
          )}
          {/* Macroscopy / Gross Description */}
          {(grossDesc || findings) && (
            <div>
              <ResultSectionHeader
                title="Macroscopic Findings"
                icon={FileText}
              />
              <div className="p-4 bg-white border border-gray-200 rounded text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {grossDesc || findings}
              </div>
            </div>
          )}
          {data.specimenDescription && (
            <div>
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-1">
                Specimen Description
              </h5>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800 whitespace-pre-wrap">
                {data.specimenDescription}
              </div>
            </div>
          )}
          {/* Microscopy */}
          {microDesc && (
            <div>
              <ResultSectionHeader
                title="Microscopic Findings"
                icon={Microscope}
              />
              <div className="p-4 bg-white border border-gray-200 rounded text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {microDesc}
              </div>
            </div>
          )}
          {/* Special Stains */}
          {(data.specialStains?.length > 0 || data.specialStainResults) && (
            <div>
              <ResultSectionHeader title="Special Stains" icon={Stethoscope} />
              {data.specialStains?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {data.specialStains.map((s: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-purple-50 text-purple-800 text-xs font-medium rounded border border-purple-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {data.specialStainResults && (
                <p className="text-sm text-gray-800 p-3 bg-gray-50 rounded border border-gray-200 whitespace-pre-wrap">
                  {data.specialStainResults}
                </p>
              )}
            </div>
          )}
          {/* Diagnosis */}
          {(finalDx || impression) && (
            <div>
              <ResultSectionHeader title="Diagnosis" icon={Stethoscope} />
              <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900 font-medium whitespace-pre-wrap">
                {finalDx || impression}
              </div>
            </div>
          )}
          {/* Tumor staging */}
          {(data.tumorGrade || data.ptnmStage || data.marginStatus) && (
            <div className="grid grid-cols-3 gap-4">
              {data.tumorGrade && (
                <div className="p-3 bg-gray-50 rounded border">
                  <span className="text-xs text-gray-500 uppercase block">
                    Tumor Grade
                  </span>
                  <span className="font-bold">{data.tumorGrade}</span>
                </div>
              )}
              {data.ptnmStage && (
                <div className="p-3 bg-gray-50 rounded border">
                  <span className="text-xs text-gray-500 uppercase block">
                    pTNM Stage
                  </span>
                  <span className="font-bold">{data.ptnmStage}</span>
                </div>
              )}
              {data.marginStatus && (
                <div className="p-3 bg-gray-50 rounded border">
                  <span className="text-xs text-gray-500 uppercase block">
                    Margin Status
                  </span>
                  <span
                    className={`font-bold ${data.marginStatus === 'Involved' ? 'text-red-700' : data.marginStatus === 'Clear' ? 'text-green-700' : ''}`}
                  >
                    {data.marginStatus}
                  </span>
                </div>
              )}
            </div>
          )}
          {/* Comments / Recommendation */}
          {recommendation && (
            <div>
              <ResultSectionHeader
                title="Comments / Recommendations"
                icon={Stethoscope}
              />
              <div className="p-4 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900 font-medium whitespace-pre-wrap">
                {recommendation}
              </div>
            </div>
          )}
          {data.addendum && (
            <div>
              <h5 className="text-xs font-bold text-gray-500 uppercase mb-1">
                Addendum
              </h5>
              <div className="p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-900 whitespace-pre-wrap">
                {data.addendum}
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'numeric_timing': {
      // Support both 'readings' and 'results' field names (form saves as 'results')
      const readings = data.readings || data.results || [];
      return (
        <div className="space-y-3">
          {Array.isArray(readings) && readings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                      Parameter / Time Point
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                      Value
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                      Unit
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                      Reference Range
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                      Flag
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {readings.map((reading: any, idx: number) => (
                    <tr
                      key={idx}
                      className={
                        reading.isCritical
                          ? 'bg-red-50'
                          : reading.isAbnormal
                            ? 'bg-amber-50'
                            : ''
                      }
                    >
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">
                        {reading.timePoint ||
                          reading.time ||
                          reading.parameter ||
                          `Reading ${idx + 1}`}
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                        {reading.value ?? reading.resultValue ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {reading.unit || data.unit || ''}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {reading.reference || reading.referenceRange || ''}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {reading.isCritical ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                            CRITICAL
                          </span>
                        ) : reading.isAbnormal ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">
                            ABNORMAL
                          </span>
                        ) : reading.flag ? (
                          <span className="text-gray-600">{reading.flag}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No timing readings recorded</p>
          )}

          {/* Additional Fields */}
          {data.interpretation && (
            <div className="mt-4 p-3 bg-purple-50 border-l-4 border-purple-500 rounded-r">
              <p className="text-xs font-semibold text-purple-700 uppercase mb-1">
                Clinical Interpretation
              </p>
              <p className="text-sm text-purple-800">{data.interpretation}</p>
            </div>
          )}
          {data.remarks && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
              <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                Technician Remarks
              </p>
              <p className="text-sm text-gray-700">{data.remarks}</p>
            </div>
          )}
          {data.methodology && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs font-semibold text-blue-700 uppercase mb-1">
                Methodology
              </p>
              <p className="text-sm text-blue-800">{data.methodology}</p>
            </div>
          )}
        </div>
      );
    }

    default:
      // Fallback: render as key-value pairs
      return (
        <div className="space-y-2">
          {Object.entries(data).map(([key, value]) => (
            <div
              key={key}
              className="flex justify-between p-2 bg-gray-50 rounded"
            >
              <span className="text-sm text-gray-600 capitalize">
                {key.replace(/_/g, ' ')}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      );
  }
}

export default function LabDetailModal({
  isOpen,
  onClose,
  request,
  onCollectSample,
  onEnterResult,
  paymentInfo,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: LabDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'report'>(
    request?.lab_result?.structured_result ? 'report' : 'details',
  );
  const { data: reportRequests = [] } = useLabReportRequests(
    isOpen ? request : null,
  );

  if (!isOpen || !request) return null;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const patientName = request.patient
    ? `${request.patient.first_name || ''} ${request.patient.surname || ''}`.trim()
    : 'Unknown Patient';
  const patientAge = request.patient?.date_of_birth
    ? formatDetailedAge(request.patient.date_of_birth)
    : 'N/A';

  // Print Lab Report Function
  const handlePrintLabReport = async () => {
    await printUniversalLabReport(
      reportRequests.length > 0 ? reportRequests : [request],
      request,
    );
  };

  const labResult = request.lab_result;
  const paymentStatus = getPaymentStatusFromBillingOrder(
    paymentInfo?.payment_status,
  );
  const outstandingAmount = paymentInfo?.balance_amount ?? 0;
  const paidAmount = paymentInfo?.paid_amount ?? 0;
  const baseAmount =
    paymentInfo?.patient_payable ?? paymentInfo?.amount_due ?? 0;

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
          className="relative bg-gray-50 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* EMR Header with NDC Branding */}
          <div className="bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600">
              <div className="flex items-center gap-4">
                <div className="border-l border-white/30 pl-4">
                  <h1 className="text-white font-bold text-lg tracking-wide">
                    {getFacilityName().toUpperCase()}
                  </h1>
                  <p className="text-green-100 text-xs font-medium">
                    {getFacilityAddress() || 'Laboratory Request'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Navigation Controls */}
                {(onPrev || onNext) && (
                  <div className="hidden md:flex items-center bg-black/20 rounded-lg mr-2 max-h-[40px]">
                    <button
                      onClick={onPrev}
                      disabled={!hasPrev}
                      className="p-2 hover:bg-white/10 rounded-l-lg transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Previous Request"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="w-[1px] h-5 bg-white/20 self-center" />
                    <button
                      onClick={onNext}
                      disabled={!hasNext}
                      className="p-2 hover:bg-white/10 rounded-r-lg transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Next Request"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}

                <div className="text-right mr-4">
                  <p className="text-white text-sm font-medium">
                    REQ #{request.request_id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-green-100 text-xs">
                    {new Date(request.created_at).toLocaleDateString('en-NG', {
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

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6 bg-gray-50">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'details'
                    ? 'text-primary-700 border-b-2 border-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Request Details
                </div>
              </button>
              <button
                onClick={() => setActiveTab('report')}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'report'
                    ? 'text-primary-700 border-b-2 border-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Lab Report
                  {(labResult || request.result) && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      1
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            {activeTab === 'details' && (
              <div className="p-6 space-y-5">
                {/* Status Banner */}
                <div
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    request.status === 'Completed'
                      ? 'bg-green-50 border-green-200'
                      : request.status === 'In Progress'
                        ? 'bg-blue-50 border-blue-200'
                        : request.status === 'Sample Collected'
                          ? 'bg-cyan-50 border-cyan-200'
                          : request.status === 'Cancelled'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {request.status === 'Completed' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : request.status === 'In Progress' ||
                      request.status === 'Sample Collected' ? (
                      <TestTube className="h-6 w-6 text-blue-600" />
                    ) : (
                      <Clock className="h-6 w-6 text-amber-600" />
                    )}
                    <div>
                      <StatusBadge
                        status={request.status}
                        variant={getStatusVariant(
                          request.status as LabRequestStatus,
                        )}
                      />
                      <p className="text-sm text-gray-600 mt-1">
                        Priority:{' '}
                        <span
                          className={`font-medium ${
                            request.priority === 'Emergency'
                              ? 'text-red-600'
                              : request.priority === 'Urgent'
                                ? 'text-orange-600'
                                : 'text-gray-700'
                          }`}
                        >
                          {request.priority}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Patient & Test Info */}
                <div className="grid grid-cols-2 gap-5">
                  {/* Patient Info Card */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-900">
                        Patient
                      </h3>
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
                        {request.test?.test_name || request.test?.test_name}
                      </p>
                      {request.test?.test_code && (
                        <p className="text-xs text-gray-500">
                          Code: {request.test.test_code}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Billing & Payment */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Billing & Payment
                    </h3>
                  </div>

                  {paymentInfo ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <PaymentStatusBadge status={paymentStatus} />
                        {paymentInfo.order_number && (
                          <span className="text-xs font-mono text-gray-500">
                            {paymentInfo.order_number}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                            {outstandingAmount > 0 ? 'Outstanding' : 'Amount'}
                          </p>
                          <p
                            className={`text-base font-semibold ${outstandingAmount > 0 ? 'text-red-600' : 'text-gray-900'}`}
                          >
                            {formatCurrency(
                              outstandingAmount > 0
                                ? outstandingAmount
                                : baseAmount,
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                            Paid
                          </p>
                          <p className="text-base font-semibold text-green-700">
                            {paidAmount > 0 ? formatCurrency(paidAmount) : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Payment Category:</span>
                        <span className="font-medium text-gray-700">
                          {paymentInfo.visit_payment_category || '—'}
                        </span>
                      </div>

                      {paymentInfo.receipt_number && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Receipt className="h-4 w-4 text-gray-400" />
                          <span>Receipt #{paymentInfo.receipt_number}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No billing order linked to this request yet.
                    </p>
                  )}
                </div>

                {/* Ordering Physician */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Stethoscope className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider">
                        Ordered By
                      </p>
                      <p className="font-semibold text-gray-900">
                        Dr. {request.doctor?.first_name}{' '}
                        {request.doctor?.last_name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Clinical Context */}
                {(request.diagnosis?.length || request.clinical_notes) && (
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <FileText className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-xs text-orange-600 font-medium uppercase tracking-wider">
                          Clinical Context
                        </p>
                        <p className="text-xs text-gray-500">
                          Why this test was ordered
                        </p>
                      </div>
                    </div>

                    {request.diagnosis && request.diagnosis.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 font-medium mb-2">
                          Diagnosis / Indication:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {request.diagnosis.map((dx, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200"
                            >
                              {dx}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {request.clinical_notes && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1">
                          Clinical Notes:
                        </p>
                        <p className="text-sm text-gray-700 bg-white/50 rounded-lg p-2 border border-orange-100">
                          {request.clinical_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-amber-100 rounded-xl">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Timeline
                      </h3>
                      <p className="text-xs text-gray-500">
                        Request workflow history
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Requested
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(request.request_date || request.created_at)}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Sample Collected
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(request.sample_collected_at)}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Processed
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(request.processed_at)}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Technician
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {request.technician
                          ? `${request.technician.first_name} ${request.technician.last_name}`
                          : labResult?.uploader
                            ? `${labResult.uploader.first_name} ${labResult.uploader.last_name}`
                            : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Report Tab */}
            {activeTab === 'report' && (
              <div className="p-6 space-y-5">
                {/* Results Section - HOSPITAL GRADE REPORT LAYOUT */}
                {labResult || request.result ? (
                  <div className="bg-white rounded-sm border border-gray-200 shadow-sm print:shadow-none min-h-[600px] flex flex-col">
                    {/* Report Header - Internal View */}
                    <div className="p-8 border-b-2 border-primary-700">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4 items-center">
                          <div>
                            <h2 className="text-2xl font-bold text-gray-900 tracking-tight uppercase">
                              {getFacilityName()}
                            </h2>
                            <p className="text-sm font-semibold text-primary-700 uppercase tracking-wide">
                              Department of Laboratory Medicine
                            </p>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">
                              Excellence in Diagnostics
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="inline-block bg-gray-100 rounded px-3 py-1 mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase mr-2">
                              Status
                            </span>
                            <span
                              className={`text-xs font-bold uppercase ${
                                labResult?.workflow_status === 'approved' ||
                                labResult?.workflow_status === 'released'
                                  ? 'text-green-700'
                                  : 'text-amber-600'
                              }`}
                            >
                              {labResult?.workflow_status || 'Pending'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 uppercase font-semibold">
                            Report Reference
                          </p>
                          <p className="text-lg font-mono font-bold text-gray-900">
                            {request.request_id.slice(0, 12).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Patient & Order Context */}
                    <div className="bg-gray-50 p-6 border-b border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                            Patient Name
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {patientName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                            EMR / ID
                          </p>
                          <p className="text-sm font-medium text-gray-900 font-mono">
                            {request.patient?.emr_number ||
                              request.patient?.patient_id}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                            Gender / Age
                          </p>
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            {request.patient?.gender || 'N/A'} / {patientAge}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                            Physician
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            Dr. {request.doctor?.first_name}{' '}
                            {request.doctor?.last_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                            Test Ordered
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {request.test?.test_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                            Category
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {request.test?.category}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                            Sample Collected
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {request.sample_collected_at
                              ? formatDate(request.sample_collected_at)
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                            Reported
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {labResult?.verified_at
                              ? formatDate(labResult.verified_at)
                              : 'Pending Verification'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Main Results Area */}
                    <div className="p-8 flex-grow">
                      <div className="mb-6 flex items-center gap-3 pb-2 border-b-2 border-gray-100">
                        <div className="p-2 bg-gray-900 rounded-sm">
                          <Microscope className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">
                          Examination Results
                        </h3>
                      </div>

                      {labResult?.structured_result ? (
                        <div className="animate-fade-in">
                          {renderStructuredResult(
                            labResult.structured_result as Record<
                              string,
                              unknown
                            >,
                            labResult.result_template_type,
                          )}
                        </div>
                      ) : (
                        /* Fallback for unstructured */
                        <div className="p-6 bg-gray-50 border border-gray-200 rounded min-h-[100px] flex items-center justify-center">
                          <p className="text-xl font-mono text-gray-800 font-bold">
                            {labResult?.result ||
                              (typeof request.result === 'string'
                                ? request.result
                                : 'Result data not formatted')}
                          </p>
                          {labResult?.result_unit && (
                            <span className="ml-2 text-gray-500">
                              {labResult.result_unit}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reference Range (if basic result) */}
                      {!labResult?.structured_result &&
                        (labResult?.reference_range ||
                          request.test?.normal_range) && (
                          <div className="mt-4 p-3 bg-gray-50 border-l-4 border-gray-400 text-sm">
                            <span className="font-bold text-gray-600 mr-2">
                              Reference Range:
                            </span>
                            <span className="font-mono">
                              {labResult?.reference_range ||
                                request.test?.normal_range}
                            </span>
                          </div>
                        )}
                    </div>

                    {/* Footer / Interpretation Area */}
                    <div className="bg-gray-50 p-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Pathologist Comments */}
                        <div className="space-y-4">
                          {labResult?.interpretation && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                                Pathologist Interpretation
                              </h4>
                              <p className="text-sm text-gray-800 italic bg-white p-3 border border-gray-200 rounded">
                                {labResult.interpretation}
                              </p>
                            </div>
                          )}
                          {(labResult?.remarks || request.result_notes) && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                                Scientist Remarks
                              </h4>
                              <p className="text-sm text-gray-800 bg-white p-3 border border-gray-200 rounded">
                                {labResult?.remarks || request.result_notes}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Signatures */}
                        <div className="flex flex-col justify-end">
                          <div className="grid grid-cols-2 gap-8">
                            {labResult?.uploader && (
                              <div className="text-center">
                                <div className="h-10 border-b border-gray-400 mb-2" />
                                <p className="text-sm font-bold text-gray-900">
                                  {labResult.uploader.first_name}{' '}
                                  {labResult.uploader.last_name}
                                </p>
                                <p className="text-xs text-gray-500 uppercase">
                                  Medical Lab Scientist
                                </p>
                              </div>
                            )}
                            {labResult?.verifier && (
                              <div className="text-center">
                                <div className="h-10 border-b border-gray-400 mb-2 relative">
                                  <div
                                    className="absolute bottom-0 left-0 right-0 mx-auto w-16 h-8 bg-contain bg-no-repeat bg-center opacity-50"
                                    style={{
                                      backgroundImage:
                                        'url(/signature-placeholder.png)',
                                    }}
                                  />
                                </div>
                                <p className="text-sm font-bold text-gray-900">
                                  {labResult.verifier.first_name}{' '}
                                  {labResult.verifier.last_name}
                                </p>
                                <p className="text-xs text-gray-500 uppercase">
                                  Verified By
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="mt-6 text-center">
                            <p className="text-xs text-gray-400 uppercase tracking-widest">
                              Electronic Report Generated by XenoCare System
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
                    <div className="bg-white h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Beaker className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      Awaiting Results
                    </h3>
                    <p className="text-gray-500 max-w-sm mx-auto">
                      Lab results have not been entered or verified for this
                      request yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with Actions */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FlaskConical className="h-4 w-4" />
                <span>
                  Turnaround: {request.test?.turnaround_time || 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Print Button - Show when results are available */}
                {(request.status === 'Completed' ||
                  labResult ||
                  request.result) && (
                  <button
                    onClick={handlePrintLabReport}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-md transition-all"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Report
                  </button>
                )}
                {request.status === 'Pending' && onCollectSample && (
                  <Button
                    variant="secondary"
                    onClick={() => onCollectSample(request)}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    Collect Sample
                  </Button>
                )}
                {(request.status === 'Sample Collected' ||
                  request.status === 'In Progress') &&
                  onEnterResult && (
                    <button
                      onClick={() => onEnterResult(request)}
                      className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-[#007538] text-white font-semibold rounded-lg shadow-md transition-all"
                    >
                      <Beaker className="h-4 w-4 mr-2" />
                      Enter Result
                    </button>
                  )}
                <Button variant="secondary" onClick={onClose}>
                  Back to List
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

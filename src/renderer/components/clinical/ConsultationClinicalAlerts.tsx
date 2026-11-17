import React, { useMemo } from 'react';
import { AlertTriangle, User, Pill, Droplets, Siren } from 'lucide-react';
import { usePatient } from '../../modules/patient-registration/hooks/usePatient';

export interface ConsultationClinicalAlertsProps {
  /** `patients.patient_id` (VARCHAR) or `patients.id` (UUID) — both work with `usePatient` */
  patientIdForLookup: string | null | undefined;
  patientDisplayName?: string;
  encounter?: {
    priority?: string | null;
    chief_complaint?: string | null;
  } | null;
  isNightMode?: boolean;
  className?: string;
}

/**
 * High-visibility clinical alert strip for consultation workflows (OPD & specialties).
 * Loads allergies / blood group from the patient record; surfaces encounter urgency.
 */
export function ConsultationClinicalAlerts({
  patientIdForLookup,
  patientDisplayName,
  encounter,
  isNightMode = false,
  className = '',
}: ConsultationClinicalAlertsProps) {
  const enabled = !!patientIdForLookup && String(patientIdForLookup).length > 0;
  const {
    data: patient,
    isLoading,
    isError,
  } = usePatient(enabled ? String(patientIdForLookup) : '');

  const items = useMemo(() => {
    const out: Array<{
      key: string;
      tone: 'critical' | 'warn' | 'info';
      icon: React.ReactNode;
      title: string;
      body: string;
    }> = [];

    const p = encounter?.priority || '';
    if (p === 'Emergency' || p === 'Urgent' || p === 'Stat') {
      const label = p === 'Stat' ? 'Stat / immediate' : `${p} encounter`;
      out.push({
        key: 'priority',
        tone: 'critical',
        icon: <Siren className="h-4 w-4 shrink-0" strokeWidth={2.25} />,
        title: label,
        body: 'Review triage and resources before proceeding.',
      });
    }

    const allergies = patient?.known_allergies?.filter(Boolean) || [];
    if (allergies.length > 0) {
      out.push({
        key: 'allergy',
        tone: 'critical',
        icon: <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.25} />,
        title: 'Allergies',
        body: allergies.join(', '),
      });
    }

    if (patient?.blood_group) {
      out.push({
        key: 'bg',
        tone: 'info',
        icon: <Droplets className="h-4 w-4 shrink-0" strokeWidth={2.25} />,
        title: 'Blood group',
        body: patient.blood_group,
      });
    }

    const cc = encounter?.chief_complaint?.trim();
    if (cc) {
      out.push({
        key: 'cc',
        tone: 'warn',
        icon: <Pill className="h-4 w-4 shrink-0" strokeWidth={2.25} />,
        title: 'Chief complaint',
        body: cc.length > 180 ? `${cc.slice(0, 177)}…` : cc,
      });
    }

    return out;
  }, [patient, encounter?.priority, encounter?.chief_complaint]);

  const shell = isNightMode
    ? 'border-slate-700 bg-slate-900/90'
    : 'border-amber-200/80 bg-gradient-to-r from-amber-50/95 via-white to-orange-50/40';

  if (!enabled) {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-sm ${
          isNightMode
            ? 'border-slate-600 bg-slate-900/50 text-slate-400'
            : 'border-slate-200 bg-slate-50/80 text-slate-600'
        } ${className}`}
      >
        <User className="h-4 w-4 shrink-0 opacity-60" />
        <span>
          Select a patient from the queue (or open a consultation) to view
          clinical alerts.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={`animate-pulse rounded-2xl border px-4 py-3 text-sm ${
          isNightMode
            ? 'border-slate-700 bg-slate-800 text-slate-500'
            : 'border-slate-200 bg-white text-slate-400'
        } ${className}`}
      >
        Loading clinical alerts…
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div
        className={`rounded-2xl border px-4 py-3 text-sm ${
          isNightMode
            ? 'border-amber-900/50 bg-amber-950/30 text-amber-200'
            : 'border-amber-300 bg-amber-50 text-amber-950'
        } ${className}`}
      >
        Could not load patient safety data. Verify the patient record link.
      </div>
    );
  }

  const name =
    patientDisplayName ||
    [patient.first_name, patient.surname].filter(Boolean).join(' ').trim() ||
    patient.emr_number ||
    'Patient';

  if (items.length === 0) {
    return (
      <div
        className={`rounded-2xl border px-4 py-3 sm:px-5 ${shell} ${className}`}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-emerald-800 dark:text-emerald-200">
            Clinical alerts
          </span>
          <span className="text-slate-500 dark:text-slate-400">·</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {name}
          </span>
          <span className="text-slate-600 dark:text-slate-400">
            — No known allergies on file for this snapshot. Always verify with
            the patient.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${shell} ${className}`}
      role="region"
      aria-label="Clinical alerts"
    >
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-black/5 pb-2 dark:border-white/10">
          <AlertTriangle
            className="h-4 w-4 text-amber-700 dark:text-amber-300"
            strokeWidth={2.25}
          />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-100">
            Clinical alerts
          </span>
          <span className="text-slate-400 dark:text-slate-500">·</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {name}
          </span>
          {patient.emr_number && (
            <span className="rounded-md bg-white/80 px-2 py-0.5 font-mono text-xs font-semibold text-primary-800 dark:bg-slate-800 dark:text-emerald-300">
              {patient.emr_number}
            </span>
          )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.key}
              className={`flex gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                item.tone === 'critical'
                  ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100'
                  : item.tone === 'warn'
                    ? 'border-amber-200 bg-white/90 text-amber-950 dark:border-amber-900/50 dark:bg-slate-800/80 dark:text-amber-50'
                    : 'border-slate-200/80 bg-white/70 text-slate-900 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100'
              }`}
            >
              <span className="mt-0.5 shrink-0 opacity-90">{item.icon}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                  {item.title}
                </p>
                <p className="mt-0.5 leading-snug font-medium">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

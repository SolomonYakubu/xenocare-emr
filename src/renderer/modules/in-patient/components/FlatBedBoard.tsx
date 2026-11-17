import React, { useMemo, useState } from 'react';
import { Bed, Pencil, RefreshCw } from 'lucide-react';
import { useBedAvailability } from '../hooks/useBeds';
import BedManagerPanel, { BedRow } from './BedManagerPanel';

interface FlatBedBoardProps {
  onAdmitToBed: (bedId: string, wardId: string) => void;
}

const STATUS_DOT: Record<string, string> = {
  available: 'bg-[#78A98B]',
  occupied: 'bg-[#C98477]',
  reserved: 'bg-[#C7A76A]',
  cleaning: 'bg-[#7FA3B8]',
  maintenance: 'bg-[#A3A3A3]',
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Free',
  occupied: 'Occupied',
  reserved: 'Reserved',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
};

function normalize(status: unknown): string {
  return String(status || '')
    .trim()
    .toLowerCase();
}

/** "Bed 10" must come after "Bed 9", not after "Bed 1". */
function bedNumber(value: string): number {
  return Number(String(value).replace(/\D/g, '')) || 0;
}

export default function FlatBedBoard({ onAdmitToBed }: FlatBedBoardProps) {
  const { data: beds = [], isLoading, refetch, isFetching } = useBedAvailability();
  const [managerOpen, setManagerOpen] = useState(false);

  const sortedBeds = useMemo<BedRow[]>(
    () =>
      (beds as any[])
        .map((bed) => ({
          id: bed.bed_id as string,
          wardId: bed.ward_id as string,
          number: bed.bed_number as string,
          type: (bed.bed_type as string) || 'Standard',
          status: normalize(bed.status),
          dailyRate: bed.daily_rate,
          location: bed.location_details || bed.ward_name || null,
          patient: bed.current_patient_name as string | null,
        }))
        .sort((a, b) => bedNumber(a.number) - bedNumber(b.number)),
    [beds],
  );

  const availableCount = sortedBeds.filter(
    (bed) => bed.status === 'available',
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Select a free bed to admit a patient.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            aria-label="Refresh beds"
            title="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            Manage beds
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ) : sortedBeds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
          <Bed className="mx-auto mb-2 h-9 w-9 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No beds yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Use Manage beds to add the first bed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {sortedBeds.map((bed) => {
            const available = bed.status === 'available';
            const dot = STATUS_DOT[bed.status] || 'bg-slate-300';
            const detail = available
              ? 'Free'
              : bed.status === 'occupied'
                ? bed.patient || 'Occupied'
                : STATUS_LABEL[bed.status] || bed.status;

            return (
              <button
                key={bed.id}
                type="button"
                disabled={!available}
                onClick={() => onAdmitToBed(bed.id, bed.wardId)}
                title={available ? `Admit a patient to ${bed.number}` : detail}
                className={`rounded-xl border bg-white px-3 py-2.5 text-left transition-colors ${
                  available
                    ? 'border-slate-200 hover:border-[#E9783F] hover:bg-[#FDF8F4]'
                    : 'cursor-default border-slate-200'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-900">
                    {bed.number}
                  </span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                </span>
                <span
                  className={`mt-1 block truncate text-xs ${
                    available ? 'text-[#8A6A55]' : 'text-slate-500'
                  }`}
                >
                  {detail}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <BedManagerPanel
        isOpen={managerOpen}
        beds={sortedBeds}
        onClose={() => setManagerOpen(false)}
        onChanged={() => refetch()}
      />
    </div>
  );
}

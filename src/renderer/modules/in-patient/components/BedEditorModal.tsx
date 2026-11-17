import React, { useEffect, useState } from 'react';
import { Bed, Loader2, Trash2, X } from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';
import {
  useCreateBed,
  useDeactivateBed,
  useUpdateBed,
} from '../hooks/useBeds';
import { useWards } from '../hooks/useWards';
import type { BedType } from '../../../types/database.types';

export interface EditableBed {
  id: string;
  wardId: string;
  number: string;
  type: string;
  status: string;
  dailyRate?: number | null;
  location?: string | null;
}

interface BedEditorModalProps {
  isOpen: boolean;
  bed: EditableBed | null;
  onClose: () => void;
  onSaved: () => void;
}

const BED_TYPES: Array<{ value: BedType; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'electric', label: 'Electric' },
  { value: 'icu', label: 'ICU' },
  { value: 'pediatric', label: 'Pediatric' },
  { value: 'bariatric', label: 'Bariatric' },
  { value: 'low', label: 'Low' },
  { value: 'stretcher', label: 'Stretcher' },
  { value: 'crib', label: 'Crib' },
  { value: 'bassinet', label: 'Bassinet' },
];

const STATUSES = [
  'Available',
  'Occupied',
  'Reserved',
  'Cleaning',
  'Maintenance',
];

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-[#E9783F] focus:bg-white focus:ring-4 focus:ring-[#E9783F]/15';

export default function BedEditorModal({
  isOpen,
  bed,
  onClose,
  onSaved,
}: BedEditorModalProps) {
  const { showToast } = useToast();
  const { data: wards = [] } = useWards();
  const createBed = useCreateBed();
  const updateBed = useUpdateBed();
  const deactivateBed = useDeactivateBed();

  const [number, setNumber] = useState('');
  const [type, setType] = useState<BedType>('standard');
  const [status, setStatus] = useState('Available');
  const [dailyRate, setDailyRate] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(bed);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setConfirmRemove(false);
    setNumber(bed?.number || '');
    setType(((bed?.type || 'standard') as BedType) || 'standard');
    setStatus(bed?.status ? bed.status[0].toUpperCase() + bed.status.slice(1) : 'Available');
    setDailyRate(bed?.dailyRate != null ? String(bed.dailyRate) : '');
    setLocation(bed?.location || '');
  }, [isOpen, bed]);

  if (!isOpen) return null;

  const save = async () => {
    setError(null);
    if (!number.trim()) {
      setError('Give the bed a name or number.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && bed) {
        await updateBed.mutateAsync({
          bedId: bed.id,
          updates: {
            bed_number: number.trim(),
            bed_type: type,
            status,
            daily_rate: dailyRate ? Number(dailyRate) : null,
            location_details: location.trim() || null,
          } as any,
        });
        showToast({ type: 'success', title: 'Bed updated', message: 'The bed details were saved.' });
      } else {
        const wardId = wards[0]?.id;
        if (!wardId) {
          throw new Error('No ward is configured for this facility.');
        }
        await createBed.mutateAsync({
          ward_id: wardId,
          bed_number: number.trim(),
          bed_type: type,
          daily_rate: dailyRate ? Number(dailyRate) : undefined,
          location_details: location.trim() || undefined,
        });
        showToast({ type: 'success', title: 'Bed added', message: 'The new bed is ready.' });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save the bed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!bed) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }

    setSaving(true);
    try {
      await deactivateBed.mutateAsync(bed.id);
      showToast({ type: 'success', title: 'Bed removed', message: 'The bed was removed from the board.' });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not remove the bed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E9783F]/10 text-[#E9783F]">
              <Bed className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEdit ? 'Edit bed' : 'Add bed'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit ? 'Rename, change status or remove' : 'Create a new bed'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              Bed name / number
            </label>
            <input
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="e.g. B-101"
              className={fieldClass}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Type
              </label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as BedType)}
                className={fieldClass}
              >
                {BED_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Status
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={fieldClass}
              >
                {STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Daily rate
              </label>
              <input
                type="number"
                min="0"
                value={dailyRate}
                onChange={(event) => setDailyRate(event.target.value)}
                placeholder="0"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Location note
              </label>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Optional"
                className={fieldClass}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}

          {isEdit && (
            <button
              type="button"
              onClick={remove}
              disabled={saving}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                confirmRemove
                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                  : 'border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
              }`}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {confirmRemove ? 'Tap again to remove this bed' : 'Remove bed'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 pb-5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[#E9783F] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#E9783F]/25 transition-all hover:bg-[#D96A36] active:scale-[0.99] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Add bed'}
          </button>
        </div>
      </div>
    </div>
  );
}

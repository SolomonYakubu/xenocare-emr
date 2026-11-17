import React, { useState } from 'react';
import { Bed, ChevronRight, Plus, X } from 'lucide-react';
import BedEditorModal, { EditableBed } from './BedEditorModal';

export interface BedRow extends EditableBed {
  patient?: string | null;
}

interface BedManagerPanelProps {
  isOpen: boolean;
  beds: BedRow[];
  onClose: () => void;
  onChanged: () => void;
}

const STATUS_TONE: Record<string, string> = {
  available: 'bg-[#EFF6F1] text-[#4F7A5E]',
  occupied: 'bg-[#FBF0EE] text-[#A45E52]',
  reserved: 'bg-[#FBF5E8] text-[#8C6B3A]',
  cleaning: 'bg-[#EEF4F8] text-[#4F6F84]',
  maintenance: 'bg-[#F2F1EF] text-[#6B6B6B]',
};

export default function BedManagerPanel({
  isOpen,
  beds,
  onClose,
  onChanged,
}: BedManagerPanelProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<EditableBed | null>(null);

  if (!isOpen) return null;

  const openEditor = (bed: EditableBed | null) => {
    setEditingBed(bed);
    setEditorOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <div
          className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C96A3A]">
                Bed setup
              </p>
              <h2 className="mt-0.5 font-display text-xl font-bold text-slate-900">
                Manage beds
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {beds.length} bed{beds.length === 1 ? '' : 's'} on this board
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close bed manager"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-5 py-4">
            <button
              type="button"
              onClick={() => openEditor(null)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E9783F] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#E9783F]/20 transition-all hover:bg-[#D96A36] active:scale-[0.99]"
            >
              <Plus className="h-4 w-4" />
              Add a bed
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-6">
            <div className="space-y-1">
              {beds.map((bed) => (
                <button
                  key={bed.id}
                  type="button"
                  aria-label={`Edit ${bed.number}`}
                  onClick={() => openEditor(bed)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F5F1] text-[#B36845]">
                    <Bed className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {bed.number}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400">
                      {bed.type}
                      {bed.patient ? ` · ${bed.patient}` : ''}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      STATUS_TONE[bed.status] || 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {bed.status}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BedEditorModal
        isOpen={editorOpen}
        bed={editingBed}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          onChanged();
        }}
      />
    </>
  );
}

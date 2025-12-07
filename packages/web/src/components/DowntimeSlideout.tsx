// packages/web/src/components/DowntimeSlideout.tsx
// Slide-out panel for logging downtime

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';

interface DowntimeReason {
  code: string;
  name: string;
  category: string;
}

interface DowntimeSlideoutProps {
  isOpen: boolean;
  onClose: () => void;
  workCenterId: number;
  workCenterName: string;
  shiftId: number;
  shiftDate: Date;
  downtimeReasons: DowntimeReason[];
}

export function DowntimeSlideout({
  isOpen,
  onClose,
  workCenterId,
  workCenterName,
  shiftId,
  shiftDate,
  downtimeReasons,
}: DowntimeSlideoutProps) {
  const queryClient = useQueryClient();
  const [reasonCode, setReasonCode] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [timeFrom, setTimeFrom] = useState('08:00');
  const [timeTo, setTimeTo] = useState('08:30');
  const [notes, setNotes] = useState('');

  const createDowntimeMutation = useMutation({
    mutationFn: async (data: {
      workCenterId: number;
      reasonCode: string;
      shiftId: number;
      notes: string;
      startedAt: string;
      endedAt: string;
      durationMinutes: number;
    }) => {
      const res = await fetch('/api/downtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to log downtime');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtime-logs'] });
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setReasonCode('');
    setDurationMinutes(30);
    setTimeFrom('08:00');
    setTimeTo('08:30');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonCode) return;

    const dateStr = shiftDate.toISOString().split('T')[0];
    createDowntimeMutation.mutate({
      workCenterId,
      reasonCode,
      shiftId,
      notes,
      startedAt: `${dateStr}T${timeFrom}:00`,
      endedAt: `${dateStr}T${timeTo}:00`,
      durationMinutes,
    });
  };

  // Update duration when times change
  const updateTimeTo = (newTimeTo: string) => {
    setTimeTo(newTimeTo);
    // Calculate duration
    const [fromH, fromM] = timeFrom.split(':').map(Number);
    const [toH, toM] = newTimeTo.split(':').map(Number);
    const fromMinutes = fromH * 60 + fromM;
    const toMinutes = toH * 60 + toM;
    const duration = toMinutes - fromMinutes;
    if (duration > 0) setDurationMinutes(duration);
  };

  const plannedReasons = downtimeReasons.filter((r) => r.category === 'planned');
  const unplannedReasons = downtimeReasons.filter((r) => r.category === 'unplanned');

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close slideout"
      />

      {/* Slideout Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-lg text-slate-900">Log Downtime</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Machine Info */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="text-sm text-slate-500">Work Center</div>
          <div className="font-bold text-slate-900">{workCenterName}</div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 p-4 overflow-y-auto">
          {/* Reason */}
          <div className="mb-4">
            <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">
              Reason
            </label>
            <select
              id="reason"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            >
              <option value="">Select reason...</option>
              <optgroup label="Planned">
                {plannedReasons.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Unplanned">
                {unplannedReasons.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Time Range */}
          <div className="mb-4">
            <span className="block text-sm font-medium text-slate-700 mb-1">Time Range</span>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="time"
                value={timeTo}
                onChange={(e) => updateTimeTo(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
            </div>
            <div className="text-sm text-slate-500 mt-1">Duration: {durationMinutes} minutes</div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label
              htmlFor="downtime-notes"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Notes (optional)
            </label>
            <textarea
              id="downtime-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              placeholder="Any additional details..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!reasonCode || createDowntimeMutation.isPending}
            className="flex-1 py-2 px-4 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {createDowntimeMutation.isPending ? 'Saving...' : 'Save Downtime'}
          </button>
        </div>
      </div>
    </>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { getAuthHeader } from '../../lib/auth';
import type { CalendarDay } from '../plant-calendar/YearCalendar';

interface ShiftInstance {
  id: number;
  shiftTemplateId: number;
  productionDate: string;
  plannedStartAt: string;
  plannedEndAt: string;
  status: string;
  isOvertime: boolean;
  shiftName: string | null;
}

export function ShiftScheduleTab() {
  const queryClient = useQueryClient();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  });
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  const startDate = currentWeekStart.toISOString().split('T')[0];
  const endDate = new Date(currentWeekStart.getTime() + 13 * 86400000).toISOString().split('T')[0];

  const { data: instances = [] } = useQuery<ShiftInstance[]>({
    queryKey: ['shift-instances', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar/shift-instances?startDate=${startDate}&endDate=${endDate}`
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: calendarDays = [] } = useQuery<CalendarDay[]>({
    queryKey: ['plant-calendar', startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar/plant-calendar?startDate=${startDate}&endDate=${endDate}`
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  const toggleOvertimeMutation = useMutation({
    mutationFn: async (data: { dates: string[]; isOvertime: boolean }) => {
      const res = await fetch('/api/calendar/shift-instances/bulk-overtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-instances'] });
      queryClient.invalidateQueries({ queryKey: ['plant-calendar'] });
      setSelectedDates(new Set());
    },
  });

  // Group instances by date
  const instancesByDate = new Map<string, ShiftInstance[]>();
  for (const inst of instances) {
    const existing = instancesByDate.get(inst.productionDate) || [];
    existing.push(inst);
    instancesByDate.set(inst.productionDate, existing);
  }

  const calendarMap = new Map(calendarDays.map((d) => [d.date, d]));

  // Generate 2-week dates
  const dates: string[] = [];
  for (let i = 0; i < 14; i++) {
    dates.push(new Date(currentWeekStart.getTime() + i * 86400000).toISOString().split('T')[0]);
  }

  const toggleDate = (date: string) => {
    const newSet = new Set(selectedDates);
    if (newSet.has(date)) {
      newSet.delete(date);
    } else {
      newSet.add(date);
    }
    setSelectedDates(newSet);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() =>
              setCurrentWeekStart(new Date(currentWeekStart.getTime() - 14 * 86400000))
            }
            className="px-3 py-1 border rounded hover:bg-slate-50"
          >
            ← 2 weeks
          </button>
          <h3 className="text-lg font-semibold">Shift Schedule</h3>
          <button
            type="button"
            onClick={() =>
              setCurrentWeekStart(new Date(currentWeekStart.getTime() + 14 * 86400000))
            }
            className="px-3 py-1 border rounded hover:bg-slate-50"
          >
            2 weeks →
          </button>
        </div>

        {/* Actions */}
        {selectedDates.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{selectedDates.size} dates selected</span>
            <button
              type="button"
              onClick={() =>
                toggleOvertimeMutation.mutate({
                  dates: Array.from(selectedDates),
                  isOvertime: true,
                })
              }
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Mark Overtime
            </button>
            <button
              type="button"
              onClick={() =>
                toggleOvertimeMutation.mutate({
                  dates: Array.from(selectedDates),
                  isOvertime: false,
                })
              }
              className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              Mark Normal
            </button>
            <button
              type="button"
              onClick={() => setSelectedDates(new Set())}
              className="px-2 py-1 text-slate-500 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-2">
        {dates.map((date) => {
          const dayOfWeek = new Date(date).toLocaleDateString('en', { weekday: 'short' });
          const dayOfMonth = new Date(date).getDate();
          const shifts = instancesByDate.get(date) || [];
          const calDay = calendarMap.get(date);
          const isSelected = selectedDates.has(date);
          const isWeekend = calDay?.dayType === 'weekend';
          const hasOvertime = shifts.some((s) => s.isOvertime);

          return (
            <button
              type="button"
              key={date}
              onClick={() => toggleDate(date)}
              className={`
                p-3 rounded-lg border-2 text-left transition-all
                ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}
                ${isWeekend ? 'bg-slate-100' : 'bg-white'}
                ${hasOvertime ? 'bg-purple-50' : ''}
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-xs text-slate-500">{dayOfWeek}</div>
                  <div className="text-lg font-semibold">{dayOfMonth}</div>
                </div>
                {hasOvertime && (
                  <span className="text-xs px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded">
                    OT
                  </span>
                )}
              </div>
              {shifts.length > 0 ? (
                <div className="space-y-1">
                  {shifts.map((shift) => (
                    <div
                      key={shift.id}
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        shift.isOvertime
                          ? 'bg-purple-200 text-purple-800'
                          : 'bg-emerald-200 text-emerald-800'
                      }`}
                    >
                      {shift.shiftName}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400">No shifts</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

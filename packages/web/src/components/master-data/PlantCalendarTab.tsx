import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getAuthHeader } from '../../lib/auth';
import { type CalendarDay, YearCalendar } from '../plant-calendar/YearCalendar';

export function PlantCalendarTab() {
  const queryClient = useQueryClient();
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [holidayName, setHolidayName] = useState('');

  // Get calendar for entire year
  const startDate = `${currentYear}-01-01`;
  const endDate = `${currentYear}-12-31`;

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

  const updateMutation = useMutation({
    mutationFn: async (data: { dates: string[]; dayType: string; name?: string }) => {
      const res = await fetch('/api/calendar/plant-calendar/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `Failed to update (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plant-calendar'] });
      setSelectedDates(new Set());
      setHolidayName('');
    },
    onError: (error: Error) => {
      alert(`Failed to update calendar: ${error.message}`);
    },
  });

  // Build calendar map
  const calendarMap = new Map(calendarDays.map((d) => [d.date, d]));

  // Calculate stats
  const workdays = calendarDays.filter((d) => d.dayType === 'working').length;
  const freeDays = calendarDays.filter((d) => d.dayType !== 'working').length;
  const holidays = calendarDays.filter((d) => d.dayType === 'holiday' && d.name);

  // Calculate stats
  const toggleDate = (date: string) => {
    const newSet = new Set(selectedDates);
    if (newSet.has(date)) {
      newSet.delete(date);
    } else {
      newSet.add(date);
    }
    setSelectedDates(newSet);
  };

  const applyDayType = (dayType: string, name?: string) => {
    if (selectedDates.size === 0) return;
    updateMutation.mutate({ dates: Array.from(selectedDates), dayType, name });
  };

  return (
    <div className="space-y-4">
      {/* Actions Bar - Sticky or prominent */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center gap-4 justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="text-sm font-semibold text-slate-700">
            {selectedDates.size} date(s) selected
          </div>
          {selectedDates.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDates(new Set())}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => applyDayType('working')}
              disabled={selectedDates.size === 0}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set Working
            </button>
            <button
              type="button"
              onClick={() => applyDayType('weekend')}
              disabled={selectedDates.size === 0}
              className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set Weekend
            </button>
            <button
              type="button"
              onClick={() => applyDayType('shutdown', 'Shutdown')}
              disabled={selectedDates.size === 0}
              className="px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set Shutdown
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-2" />

          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              placeholder="Holiday name..."
              className="px-2 py-1.5 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-40"
            />
            <button
              type="button"
              onClick={() => applyDayType('holiday', holidayName || 'Holiday')}
              disabled={selectedDates.size === 0}
              className="px-3 py-1.5 text-xs font-medium bg-rose-100 text-rose-700 rounded hover:bg-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set Holiday
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Calendar Grid */}
        <div className="flex-1">
          <YearCalendar
            year={currentYear}
            onYearChange={setCurrentYear}
            data={calendarMap}
            selectedDates={selectedDates}
            onToggleDate={toggleDate}
          />
        </div>

        {/* Public Holidays Sidebar */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* Stats */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Year Overview</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Workdays</span>
                <span className="font-bold text-emerald-700">{workdays}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Free Days</span>
                <span className="font-bold text-amber-700">{freeDays}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Holidays</span>
                <span className="font-bold text-rose-700">{holidays.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-slate-200 px-3 py-2 border-b border-slate-300">
              <span className="text-sm font-bold text-slate-700">Public Holidays</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-2 py-1 text-left font-semibold text-slate-600">Date</th>
                    <th className="px-2 py-1 text-left font-semibold text-slate-600">
                      Explanation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length > 0 ? (
                    holidays.map((h) => (
                      <tr key={h.date} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-1 font-medium text-slate-700">{h.date}</td>
                        <td className="px-2 py-1 text-slate-600">{h.name}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-2 py-4 text-center text-slate-400">
                        No holidays defined
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 bg-slate-100 border border-slate-300 rounded p-3">
            <div className="text-xs font-semibold text-slate-600 mb-2">Legend</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-green-400 rounded" />
                <span>Working</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-yellow-300 rounded" />
                <span>Weekend</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-pink-400 rounded" />
                <span>Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-orange-400 rounded" />
                <span>Shutdown</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

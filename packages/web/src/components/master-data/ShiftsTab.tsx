import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { getAuthHeader } from '../../lib/auth';
import { Badge } from '../ui/badge';
import { CrudTable } from '../ui/crud-table';
import { ConfirmDialog, Modal } from '../ui/modal';

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface ShiftBreak {
  id: number;
  shiftId: number;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

// Helper: Calculate duration in minutes from time strings
function calculateDurationFromTimes(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMins = startH * 60 + startM;
  let endMins = endH * 60 + endM;
  // Handle overnight (e.g., 23:00 to 00:30)
  if (endMins < startMins) {
    endMins += 24 * 60;
  }
  return endMins - startMins;
}

export function ShiftsTab() {
  const queryClient = useQueryClient();
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [isAddingShift, setIsAddingShift] = useState(false);
  const [editingBreak, setEditingBreak] = useState<ShiftBreak | null>(null);
  const [isAddingBreak, setIsAddingBreak] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'shift' | 'break';
    id: number;
  } | null>(null);

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<Shift[]>({
    queryKey: ['shifts-all'],
    queryFn: async () => {
      const res = await fetch('/api/shifts');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: breaks = [] } = useQuery<ShiftBreak[]>({
    queryKey: ['shift-breaks-all'],
    queryFn: async () => {
      const res = await fetch('/api/reference/shift-breaks');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Shift mutations
  const saveShiftMutation = useMutation({
    mutationFn: async (data: Partial<Shift> & { id?: number }) => {
      const url = data.id ? `/api/reference/shifts/${data.id}` : '/api/reference/shifts';
      const method = data.id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts-all'] });
      setEditingShift(null);
      setIsAddingShift(false);
    },
  });

  // Break mutations
  const saveBreakMutation = useMutation({
    mutationFn: async (data: Partial<ShiftBreak> & { id?: number }) => {
      const url = data.id
        ? `/api/reference/shift-breaks/${data.id}`
        : '/api/reference/shift-breaks';
      const method = data.id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-breaks-all'] });
      setEditingBreak(null);
      setIsAddingBreak(false);
    },
  });

  const deleteBreakMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/reference/shift-breaks/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-breaks-all'] });
      setDeleteConfirm(null);
    },
  });

  return (
    <div className="space-y-8">
      {/* Shifts */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Shifts</h3>
          <button
            type="button"
            onClick={() => setIsAddingShift(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Shift
          </button>
        </div>
        <CrudTable
          data={shifts}
          keyField="id"
          columns={[
            { key: 'name', label: 'Shift Name' },
            { key: 'startTime', label: 'Start Time' },
            { key: 'endTime', label: 'End Time' },
            {
              key: 'isActive',
              label: 'Status',
              render: (v) =>
                v ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="neutral">Inactive</Badge>
                ),
            },
          ]}
          isLoading={shiftsLoading}
          onEdit={(s) => setEditingShift(s)}
        />
      </div>

      {/* Breaks */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Shift Breaks</h3>
          <button
            type="button"
            onClick={() => setIsAddingBreak(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Break
          </button>
        </div>
        <CrudTable
          data={breaks}
          keyField="id"
          columns={[
            {
              key: 'shiftId',
              label: 'Shift',
              render: (v) => shifts.find((s) => s.id === v)?.name || '-',
            },
            { key: 'name', label: 'Break Name' },
            { key: 'startTime', label: 'Start' },
            { key: 'endTime', label: 'End' },
            {
              key: 'startTime',
              label: 'Duration',
              render: (_v, row) => `${calculateDurationFromTimes(row.startTime, row.endTime)} min`,
            },
          ]}
          onEdit={(b) => setEditingBreak(b)}
          onDelete={(b) => setDeleteConfirm({ type: 'break', id: b.id })}
        />
      </div>

      {/* Shift Edit Modal */}
      <Modal
        isOpen={isAddingShift || !!editingShift}
        onClose={() => {
          setIsAddingShift(false);
          setEditingShift(null);
        }}
        title={editingShift ? 'Edit Shift' : 'Add Shift'}
      >
        <ShiftForm
          shift={editingShift}
          onSave={(data) => saveShiftMutation.mutate(data)}
          onCancel={() => {
            setIsAddingShift(false);
            setEditingShift(null);
          }}
          isLoading={saveShiftMutation.isPending}
        />
      </Modal>

      {/* Break Edit Modal */}
      <Modal
        isOpen={isAddingBreak || !!editingBreak}
        onClose={() => {
          setIsAddingBreak(false);
          setEditingBreak(null);
        }}
        title={editingBreak ? 'Edit Break' : 'Add Break'}
      >
        <BreakForm
          brk={editingBreak}
          shifts={shifts}
          onSave={(data) => saveBreakMutation.mutate(data)}
          onCancel={() => {
            setIsAddingBreak(false);
            setEditingBreak(null);
          }}
          isLoading={saveBreakMutation.isPending}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.type === 'break') {
            deleteBreakMutation.mutate(deleteConfirm.id);
          }
        }}
        title="Delete Break"
        message="Are you sure you want to delete this break? This action cannot be undone."
        isLoading={deleteBreakMutation.isPending}
      />
    </div>
  );
}

function ShiftForm({
  shift,
  onSave,
  onCancel,
  isLoading,
}: {
  shift: Shift | null;
  onSave: (data: Partial<Shift> & { id?: number }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(shift?.name || '');
  const [startTime, setStartTime] = useState(shift?.startTime || '08:00');
  const [endTime, setEndTime] = useState(shift?.endTime || '20:00');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: shift?.id, name, startTime, endTime });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="shift-name" className="block text-sm font-medium text-slate-700 mb-1">
          Name
        </label>
        <input
          id="shift-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="shift-start" className="block text-sm font-medium text-slate-700 mb-1">
            Start Time
          </label>
          <input
            id="shift-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label htmlFor="shift-end" className="block text-sm font-medium text-slate-700 mb-1">
            End Time
          </label>
          <input
            id="shift-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function BreakForm({
  brk,
  shifts,
  onSave,
  onCancel,
  isLoading,
}: {
  brk: ShiftBreak | null;
  shifts: Shift[];
  onSave: (data: Partial<ShiftBreak> & { id?: number }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [shiftId, setShiftId] = useState(brk?.shiftId || shifts[0]?.id || 0);
  const [name, setName] = useState(brk?.name || '');
  const [startTime, setStartTime] = useState(brk?.startTime || '12:00');
  const [endTime, setEndTime] = useState(brk?.endTime || '13:00');

  // Auto-calculate duration from start and end times
  const calculateDuration = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMins = startH * 60 + startM;
    let endMins = endH * 60 + endM;
    // Handle overnight breaks (e.g., 23:00 to 00:30)
    if (endMins < startMins) {
      endMins += 24 * 60;
    }
    return endMins - startMins;
  };

  const durationMinutes = calculateDuration(startTime, endTime);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: brk?.id, shiftId, name, startTime, endTime });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="break-shift" className="block text-sm font-medium text-slate-700 mb-1">
          Shift
        </label>
        <select
          id="break-shift"
          value={shiftId}
          onChange={(e) => setShiftId(Number(e.target.value))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          required
        >
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="break-name" className="block text-sm font-medium text-slate-700 mb-1">
          Break Name
        </label>
        <input
          id="break-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="e.g. Lunch Break"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="break-start" className="block text-sm font-medium text-slate-700 mb-1">
            Start Time
          </label>
          <input
            id="break-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label htmlFor="break-end" className="block text-sm font-medium text-slate-700 mb-1">
            End Time
          </label>
          <input
            id="break-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          />
        </div>
      </div>
      <div className="text-sm text-slate-600">
        Duration: <span className="font-medium">{durationMinutes} minutes</span>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || durationMinutes <= 0}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

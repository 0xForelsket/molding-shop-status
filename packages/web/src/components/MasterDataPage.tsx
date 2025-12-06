// packages/web/src/components/MasterDataPage.tsx
// Master Data management page with tabs for Machines, Shifts, Downtime Reasons, Product Lines, Calendar

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Clock,
  Cog,
  Database,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { getAuthHeader } from '../lib/auth';

type Tab = 'shifts' | 'downtime' | 'productlines' | 'machines' | 'plantcalendar' | 'shiftschedule';

interface Machine {
  machineId: number;
  machineName: string;
  status: string;
  tonnage: number | null;
  machineType: string | null;
  isActive: boolean;
}

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
  // Duration is auto-calculated from start/end times
  isActive: boolean;
}

interface DowntimeReason {
  code: string;
  name: string;
  category: string;
  isActive: boolean;
}

interface ProductLine {
  code: string;
  name: string;
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

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg border-b-2 transition-colors ${
        active
          ? 'border-indigo-500 text-indigo-600 bg-white'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// Modal Component
function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} onKeyDown={() => {}} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// Confirm Delete Dialog
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-slate-600 mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}

// Reusable CRUD Table Component
function CrudTable<T extends object>({
  data,
  columns,
  keyField,
  onEdit,
  onDelete,
  isLoading,
}: {
  data: T[];
  columns: {
    key: keyof T;
    label: string;
    render?: (value: T[keyof T], row: T) => React.ReactNode;
  }[];
  keyField: keyof T;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="px-4 py-3 text-left text-sm font-medium text-slate-600"
              >
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-600 w-24">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                className="px-4 py-8 text-center text-slate-400"
              >
                No data found
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String(row[keyField])}
                className="border-b border-slate-100 hover:bg-slate-50"
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-3 text-sm text-slate-700">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// =============== SHIFTS TAB ===============
function ShiftsTab() {
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
    <div className="space-y-6">
      {/* Shifts */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">Shifts</h3>
          <button
            type="button"
            onClick={() => setIsAddingShift(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
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
                  <span className="text-emerald-600">Active</span>
                ) : (
                  <span className="text-slate-400">Inactive</span>
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
          <h3 className="font-semibold text-slate-800">Shift Breaks</h3>
          <button
            type="button"
            onClick={() => setIsAddingBreak(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
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

// Shift Form
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

// Break Form
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

// =============== DOWNTIME REASONS TAB ===============
function DowntimeReasonsTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DowntimeReason | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { data: reasons = [], isLoading } = useQuery<DowntimeReason[]>({
    queryKey: ['downtime-reasons-all'],
    queryFn: async () => {
      const res = await fetch('/api/reference/downtime-reasons');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<DowntimeReason> & { code: string; isNew?: boolean }) => {
      const url = data.isNew
        ? '/api/reference/downtime-reasons'
        : `/api/reference/downtime-reasons/${data.code}`;
      const method = data.isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtime-reasons-all'] });
      setEditing(null);
      setIsAdding(false);
    },
  });

  const planned = reasons.filter((r) => r.category === 'planned');
  const unplanned = reasons.filter((r) => r.category === 'unplanned');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Reason
        </button>
      </div>

      {/* Planned */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-3">Planned Downtime</h3>
        <CrudTable
          data={planned}
          keyField="code"
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            {
              key: 'isActive',
              label: 'Status',
              render: (v) =>
                v ? (
                  <span className="text-emerald-600">Active</span>
                ) : (
                  <span className="text-slate-400">Inactive</span>
                ),
            },
          ]}
          isLoading={isLoading}
          onEdit={(r) => setEditing(r)}
        />
      </div>

      {/* Unplanned */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-3">Unplanned Downtime</h3>
        <CrudTable
          data={unplanned}
          keyField="code"
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            {
              key: 'isActive',
              label: 'Status',
              render: (v) =>
                v ? (
                  <span className="text-emerald-600">Active</span>
                ) : (
                  <span className="text-slate-400">Inactive</span>
                ),
            },
          ]}
          isLoading={isLoading}
          onEdit={(r) => setEditing(r)}
        />
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isAdding || !!editing}
        onClose={() => {
          setIsAdding(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Downtime Reason' : 'Add Downtime Reason'}
      >
        <DowntimeReasonForm
          reason={editing}
          onSave={(data) => saveMutation.mutate({ ...data, isNew: !editing })}
          onCancel={() => {
            setIsAdding(false);
            setEditing(null);
          }}
          isLoading={saveMutation.isPending}
        />
      </Modal>
    </div>
  );
}

// Downtime Reason Form
function DowntimeReasonForm({
  reason,
  onSave,
  onCancel,
  isLoading,
}: {
  reason: DowntimeReason | null;
  onSave: (data: { code: string; name: string; category: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [code, setCode] = useState(reason?.code || '');
  const [name, setName] = useState(reason?.name || '');
  const [category, setCategory] = useState(reason?.category || 'planned');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ code, name, category });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="reason-code" className="block text-sm font-medium text-slate-700 mb-1">
          Code
        </label>
        <input
          id="reason-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, '_'))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="e.g. MOLD_CHANGE"
          disabled={!!reason}
          required
        />
      </div>
      <div>
        <label htmlFor="reason-name" className="block text-sm font-medium text-slate-700 mb-1">
          Name
        </label>
        <input
          id="reason-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="e.g. Mold Change"
          required
        />
      </div>
      <div>
        <label htmlFor="reason-category" className="block text-sm font-medium text-slate-700 mb-1">
          Category
        </label>
        <select
          id="reason-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
        >
          <option value="planned">Planned</option>
          <option value="unplanned">Unplanned</option>
        </select>
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

// =============== PRODUCT LINES TAB ===============
function ProductLinesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProductLine | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { data: lines = [], isLoading } = useQuery<ProductLine[]>({
    queryKey: ['product-lines-all'],
    queryFn: async () => {
      const res = await fetch('/api/reference/product-lines');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ProductLine> & { code: string; isNew?: boolean }) => {
      const url = data.isNew
        ? '/api/reference/product-lines'
        : `/api/reference/product-lines/${data.code}`;
      const method = data.isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-lines-all'] });
      setEditing(null);
      setIsAdding(false);
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-800">Product Lines</h3>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Product Line
        </button>
      </div>
      <CrudTable
        data={lines}
        keyField="code"
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          {
            key: 'isActive',
            label: 'Status',
            render: (v) =>
              v ? (
                <span className="text-emerald-600">Active</span>
              ) : (
                <span className="text-slate-400">Inactive</span>
              ),
          },
        ]}
        isLoading={isLoading}
        onEdit={(l) => setEditing(l)}
      />

      {/* Edit Modal */}
      <Modal
        isOpen={isAdding || !!editing}
        onClose={() => {
          setIsAdding(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Product Line' : 'Add Product Line'}
      >
        <ProductLineForm
          line={editing}
          onSave={(data) => saveMutation.mutate({ ...data, isNew: !editing })}
          onCancel={() => {
            setIsAdding(false);
            setEditing(null);
          }}
          isLoading={saveMutation.isPending}
        />
      </Modal>
    </div>
  );
}

// Product Line Form
function ProductLineForm({
  line,
  onSave,
  onCancel,
  isLoading,
}: {
  line: ProductLine | null;
  onSave: (data: { code: string; name: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [code, setCode] = useState(line?.code || '');
  const [name, setName] = useState(line?.name || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ code, name });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="line-code" className="block text-sm font-medium text-slate-700 mb-1">
          Code
        </label>
        <input
          id="line-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, '_'))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="e.g. WAVE_1"
          disabled={!!line}
          required
        />
      </div>
      <div>
        <label htmlFor="line-name" className="block text-sm font-medium text-slate-700 mb-1">
          Name
        </label>
        <input
          id="line-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="e.g. Wave 1"
          required
        />
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

// =============== MACHINES TAB ===============
function MachinesTab() {
  const { data: machines = [], isLoading } = useQuery<Machine[]>({
    queryKey: ['machines-all'],
    queryFn: async () => {
      const res = await fetch('/api/machines');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-800">Machines</h3>
        <span className="text-sm text-slate-500">
          Machine management is available in the Machine Admin page
        </span>
      </div>
      <CrudTable
        data={machines}
        keyField="machineId"
        columns={[
          { key: 'machineName', label: 'Name' },
          { key: 'tonnage', label: 'Tonnage', render: (v) => (v ? `${v}T` : '-') },
          { key: 'machineType', label: 'Type' },
          {
            key: 'status',
            label: 'Status',
            render: (v) => (
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  v === 'running'
                    ? 'bg-emerald-100 text-emerald-700'
                    : v === 'idle'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {String(v)}
              </span>
            ),
          },
        ]}
        isLoading={isLoading}
      />
    </div>
  );
}

// =============== PLANT CALENDAR TAB ===============
interface CalendarDay {
  date: string;
  dayType: string;
  weekNum: number | null;
  name: string | null;
}

function PlantCalendarTab() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // Get calendar for current month view
  const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

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
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plant-calendar'] });
      setSelectedDates(new Set());
    },
  });

  const getDaysInMonth = () => {
    const days: { date: string; dayOfMonth: number; isCurrentMonth: boolean }[] = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month and how many days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Pad start with previous month days
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({
        date: d.toISOString().split('T')[0],
        dayOfMonth: d.getDate(),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d.toISOString().split('T')[0],
        dayOfMonth: i,
        isCurrentMonth: true,
      });
    }

    return days;
  };

  const calendarMap = new Map(calendarDays.map((d) => [d.date, d]));
  const days = getDaysInMonth();

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

  const dayTypeColors: Record<string, string> = {
    working: 'bg-emerald-100 text-emerald-800',
    weekend: 'bg-slate-200 text-slate-600',
    holiday: 'bg-red-100 text-red-800',
    shutdown: 'bg-orange-100 text-orange-800',
    special: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
            }
            className="px-3 py-1 border rounded hover:bg-slate-50"
          >
            ←
          </button>
          <h3 className="text-lg font-semibold">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            type="button"
            onClick={() =>
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
            }
            className="px-3 py-1 border rounded hover:bg-slate-50"
          >
            →
          </button>
        </div>

        {/* Actions */}
        {selectedDates.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{selectedDates.size} selected</span>
            <button
              type="button"
              onClick={() => applyDayType('working')}
              className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              Working
            </button>
            <button
              type="button"
              onClick={() => applyDayType('holiday', 'Holiday')}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Holiday
            </button>
            <button
              type="button"
              onClick={() => applyDayType('shutdown', 'Shutdown')}
              className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              Shutdown
            </button>
            <button
              type="button"
              onClick={() => applyDayType('weekend')}
              className="px-3 py-1 text-sm bg-slate-600 text-white rounded hover:bg-slate-700"
            >
              Weekend
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

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100" /> Working
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-slate-200" /> Weekend
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100" /> Holiday
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-100" /> Shutdown
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-purple-100" /> Special
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const calDay = calendarMap.get(day.date);
          const isSelected = selectedDates.has(day.date);
          const dayType = calDay?.dayType || 'working';

          return (
            <button
              type="button"
              key={day.date}
              onClick={() => toggleDate(day.date)}
              className={`
                p-2 text-center rounded-lg border-2 transition-all
                ${day.isCurrentMonth ? '' : 'opacity-40'}
                ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'}
                ${dayTypeColors[dayType] || 'bg-white'}
              `}
            >
              <div className="text-sm font-medium">{day.dayOfMonth}</div>
              {calDay?.name && <div className="text-xs truncate">{calDay.name}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============== SHIFT SCHEDULE TAB ===============
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

function ShiftScheduleTab() {
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

// =============== MAIN PAGE ===============
export function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<Tab>('shifts');

  return (
    <div className="flex-1 bg-slate-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-indigo-600" />
          Master Data
        </h1>
        <p className="text-slate-500 mt-1">
          Manage shifts, calendars, downtime reasons, and product lines
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-0 flex-wrap">
        <TabButton
          active={activeTab === 'shifts'}
          onClick={() => setActiveTab('shifts')}
          icon={<Clock className="w-4 h-4" />}
          label="Shifts & Breaks"
        />
        <TabButton
          active={activeTab === 'plantcalendar'}
          onClick={() => setActiveTab('plantcalendar')}
          icon={<Calendar className="w-4 h-4" />}
          label="Plant Calendar"
        />
        <TabButton
          active={activeTab === 'shiftschedule'}
          onClick={() => setActiveTab('shiftschedule')}
          icon={<CalendarDays className="w-4 h-4" />}
          label="Shift Schedule"
        />
        <TabButton
          active={activeTab === 'downtime'}
          onClick={() => setActiveTab('downtime')}
          icon={<AlertCircle className="w-4 h-4" />}
          label="Downtime Reasons"
        />
        <TabButton
          active={activeTab === 'productlines'}
          onClick={() => setActiveTab('productlines')}
          icon={<Layers className="w-4 h-4" />}
          label="Product Lines"
        />
        <TabButton
          active={activeTab === 'machines'}
          onClick={() => setActiveTab('machines')}
          icon={<Cog className="w-4 h-4" />}
          label="Machines"
        />
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg border border-t-0 border-slate-200 p-6">
        {activeTab === 'shifts' && <ShiftsTab />}
        {activeTab === 'plantcalendar' && <PlantCalendarTab />}
        {activeTab === 'shiftschedule' && <ShiftScheduleTab />}
        {activeTab === 'downtime' && <DowntimeReasonsTab />}
        {activeTab === 'productlines' && <ProductLinesTab />}
        {activeTab === 'machines' && <MachinesTab />}
      </div>
    </div>
  );
}

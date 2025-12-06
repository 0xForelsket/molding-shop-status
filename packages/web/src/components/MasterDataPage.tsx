// packages/web/src/components/MasterDataPage.tsx
// Master Data management page with tabs for Machines, Shifts, Downtime Reasons, Product Lines

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, Cog, Database, Layers, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { getAuthHeader } from '../lib/auth';

type Tab = 'machines' | 'shifts' | 'downtime' | 'productlines';

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
  durationMinutes: number;
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
            { key: 'durationMinutes', label: 'Duration', render: (v) => `${v} min` },
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
    onSave({ id: brk?.id, shiftId, name, startTime, endTime, durationMinutes });
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
          Manage shifts, breaks, downtime reasons, and product lines
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-0">
        <TabButton
          active={activeTab === 'shifts'}
          onClick={() => setActiveTab('shifts')}
          icon={<Clock className="w-4 h-4" />}
          label="Shifts & Breaks"
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
        {activeTab === 'downtime' && <DowntimeReasonsTab />}
        {activeTab === 'productlines' && <ProductLinesTab />}
        {activeTab === 'machines' && <MachinesTab />}
      </div>
    </div>
  );
}

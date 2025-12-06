// packages/web/src/components/MasterDataPage.tsx
// Master Data management page with tabs for Machines, Shifts, Downtime Reasons, Product Lines

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock, Cog, Database, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

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

// Machines Tab
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
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Machine
        </button>
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
        onEdit={(m) => console.log('Edit machine', m)}
        onDelete={(m) => console.log('Delete machine', m)}
      />
    </div>
  );
}

// Shifts Tab with Breaks
function ShiftsTab() {
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

  return (
    <div className="space-y-6">
      {/* Shifts */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">Shifts</h3>
          <button
            type="button"
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
          onEdit={(s) => console.log('Edit shift', s)}
        />
      </div>

      {/* Breaks */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">Shift Breaks</h3>
          <button
            type="button"
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
          onEdit={(b) => console.log('Edit break', b)}
          onDelete={(b) => console.log('Delete break', b)}
        />
      </div>
    </div>
  );
}

// Downtime Reasons Tab
function DowntimeReasonsTab() {
  const { data: reasons = [], isLoading } = useQuery<DowntimeReason[]>({
    queryKey: ['downtime-reasons-all'],
    queryFn: async () => {
      const res = await fetch('/api/reference/downtime-reasons');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const planned = reasons.filter((r) => r.category === 'planned');
  const unplanned = reasons.filter((r) => r.category === 'unplanned');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
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
          onEdit={(r) => console.log('Edit reason', r)}
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
          onEdit={(r) => console.log('Edit reason', r)}
        />
      </div>
    </div>
  );
}

// Product Lines Tab
function ProductLinesTab() {
  const { data: lines = [], isLoading } = useQuery<ProductLine[]>({
    queryKey: ['product-lines-all'],
    queryFn: async () => {
      const res = await fetch('/api/reference/product-lines');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-800">Product Lines</h3>
        <button
          type="button"
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
        onEdit={(l) => console.log('Edit line', l)}
        onDelete={(l) => console.log('Delete line', l)}
      />
    </div>
  );
}

// Main Master Data Page
export function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<Tab>('machines');

  return (
    <div className="flex-1 bg-slate-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-indigo-600" />
          Master Data
        </h1>
        <p className="text-slate-500 mt-1">
          Manage machines, shifts, downtime reasons, and product lines
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-0">
        <TabButton
          active={activeTab === 'machines'}
          onClick={() => setActiveTab('machines')}
          icon={<Cog className="w-4 h-4" />}
          label="Machines"
        />
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
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg border border-t-0 border-slate-200 p-6">
        {activeTab === 'machines' && <MachinesTab />}
        {activeTab === 'shifts' && <ShiftsTab />}
        {activeTab === 'downtime' && <DowntimeReasonsTab />}
        {activeTab === 'productlines' && <ProductLinesTab />}
      </div>
    </div>
  );
}

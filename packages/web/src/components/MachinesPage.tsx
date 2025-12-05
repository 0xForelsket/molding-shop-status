// packages/web/src/components/MachinesPage.tsx
// CRUD page for managing injection molding machines

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button } from './ui/button';

interface Machine {
  machineId: number;
  machineName: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  tonnage: number | null;
  screwDiameter: number | null;
  injectionWeight: number | null;
  is2K: boolean;
  floorRow: 'top' | 'middle' | 'bottom' | null;
  floorPosition: number | null;
  inputMode: 'auto' | 'manual';
}

type MachineFormData = Omit<Machine, 'machineId'>;

const emptyMachine: MachineFormData = {
  machineName: '',
  brand: '',
  model: '',
  serialNo: '',
  tonnage: null,
  screwDiameter: null,
  injectionWeight: null,
  is2K: false,
  floorRow: null,
  floorPosition: null,
  inputMode: 'auto',
};

async function fetchMachines(): Promise<Machine[]> {
  const res = await fetch('/api/machines');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export function MachinesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<MachineFormData>(emptyMachine);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: fetchMachines,
  });

  const createMutation = useMutation({
    mutationFn: async (data: MachineFormData) => {
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      setIsCreating(false);
      setFormData(emptyMachine);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MachineFormData> }) => {
      const res = await fetch(`/api/machines/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      setEditingMachine(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/machines/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      setDeleteConfirm(null);
    },
  });

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setFormData({
      machineName: machine.machineName,
      brand: machine.brand || '',
      model: machine.model || '',
      serialNo: machine.serialNo || '',
      tonnage: machine.tonnage,
      screwDiameter: machine.screwDiameter,
      injectionWeight: machine.injectionWeight,
      is2K: machine.is2K,
      floorRow: machine.floorRow,
      floorPosition: machine.floorPosition,
      inputMode: machine.inputMode,
    });
  };

  const handleSave = () => {
    if (editingMachine) {
      updateMutation.mutate({ id: editingMachine.machineId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleCancel = () => {
    setEditingMachine(null);
    setIsCreating(false);
    setFormData(emptyMachine);
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <h1 className="text-lg font-semibold text-slate-800">Manage Machines</h1>
        <Button
          onClick={() => {
            setIsCreating(true);
            setFormData(emptyMachine);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Machine
        </Button>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        {(isCreating || editingMachine) && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingMachine ? `Edit ${editingMachine.machineName}` : 'Add New Machine'}
                </h2>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-2 hover:bg-slate-100 rounded text-slate-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Machine Name *</span>
                  <input
                    type="text"
                    value={formData.machineName}
                    onChange={(e) => setFormData({ ...formData, machineName: e.target.value })}
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. IM19"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Brand</span>
                  <input
                    type="text"
                    value={formData.brand || ''}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value || null })}
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. HAITIAN, ZHAFIR, ENGEL"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Model</span>
                  <input
                    type="text"
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value || null })}
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. MA1600II"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Serial No</span>
                  <input
                    type="text"
                    value={formData.serialNo || ''}
                    onChange={(e) => setFormData({ ...formData, serialNo: e.target.value || null })}
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="Serial number"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Tonnage</span>
                  <input
                    type="number"
                    value={formData.tonnage ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tonnage: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 160"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Screw Diameter (mm)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.screwDiameter ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        screwDiameter: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 40"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Injection Weight (g)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.injectionWeight ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        injectionWeight: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 230"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Floor Row</span>
                  <select
                    value={formData.floorRow || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        floorRow: (e.target.value as 'top' | 'middle' | 'bottom') || null,
                      })
                    }
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Not set</option>
                    <option value="top">Top Row</option>
                    <option value="middle">Middle Row</option>
                    <option value="bottom">Bottom Row</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Floor Position</span>
                  <input
                    type="number"
                    value={formData.floorPosition ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        floorPosition: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="1 = leftmost"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm text-slate-600 mb-1">Input Mode</span>
                  <select
                    value={formData.inputMode}
                    onChange={(e) =>
                      setFormData({ ...formData, inputMode: e.target.value as 'auto' | 'manual' })
                    }
                    className="w-full bg-white rounded px-3 py-2 border border-slate-300 text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="auto">Auto (ESP32)</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 col-span-2">
                  <input
                    type="checkbox"
                    checked={formData.is2K}
                    onChange={(e) => setFormData({ ...formData, is2K: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                  />
                  <span className="text-sm">2K / Multi-shot Machine</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    !formData.machineName || createMutation.isPending || updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg p-6 w-full max-w-md border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Confirm Delete</h2>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this machine? This will also remove all associated
                status logs and part mappings.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Machines Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-t-emerald-600" />
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded border border-slate-200">
            <table className="w-full text-left table-industrial">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase text-xs tracking-wide">
                    ID
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase text-xs tracking-wide">
                    Name
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase text-xs tracking-wide">
                    Brand
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase text-xs tracking-wide">
                    Model
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase text-xs tracking-wide">
                    Tonnage
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase text-xs tracking-wide">
                    2K
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase text-xs tracking-wide">
                    Floor
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase text-xs tracking-wide">
                    Mode
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 uppercase text-xs tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {machines.map((machine) => (
                  <tr key={machine.machineId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-slate-500">{machine.machineId}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {machine.machineName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{machine.brand || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{machine.model || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {machine.tonnage ? `${machine.tonnage}T` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {machine.is2K && (
                        <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded">
                          2K
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {machine.floorRow ? `${machine.floorRow} #${machine.floorPosition}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          machine.inputMode === 'auto'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {machine.inputMode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(machine)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(machine.machineId)}
                          className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="mt-6 text-center text-sm text-slate-500">
          {machines.length} machines total
        </footer>
      </div>
    </>
  );
}

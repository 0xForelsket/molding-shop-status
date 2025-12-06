// packages/web/src/components/PartsPage.tsx
// Admin page for managing parts catalog

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Image as ImageIcon, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMachines } from '../lib/api';
import { getAuthHeader } from '../lib/auth';
import { Button } from './ui/button';
import { DataTable } from './ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

interface Part {
  partNumber: string;
  partName: string;
  imageUrl?: string | null;
  productLine: string | null;
  compatibleMachines?: string[];
  machineIds?: number[];
}

async function fetchParts(): Promise<Part[]> {
  const res = await fetch('/api/reference/parts');
  if (!res.ok) throw new Error('Failed to fetch parts');
  return res.json();
}

export function PartsPage() {
  const queryClient = useQueryClient();
  const { data: parts = [], isLoading } = useQuery({ queryKey: ['parts'], queryFn: fetchParts });
  const { data: machines = [] } = useQuery({ queryKey: ['machines'], queryFn: fetchMachines });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [form, setForm] = useState({
    partNumber: '',
    partName: '',
    imageUrl: '',
    productLine: '',
    machineIds: [] as number[],
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editingPart) {
      setForm({
        partNumber: editingPart.partNumber,
        partName: editingPart.partName,
        imageUrl: editingPart.imageUrl ?? '',
        productLine: editingPart.productLine ?? '',
        machineIds: editingPart.machineIds ?? [],
      });
    } else {
      setForm({ partNumber: '', partName: '', imageUrl: '', productLine: '', machineIds: [] });
    }
  }, [editingPart]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const url = editingPart
        ? `/api/reference/parts/${encodeURIComponent(editingPart.partNumber)}`
        : '/api/reference/parts';
      const method = editingPart ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save part');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      setDialogOpen(false);
      setEditingPart(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (partNumber: string) => {
      const res = await fetch(`/api/reference/parts/${encodeURIComponent(partNumber)}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete part');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleDelete = useCallback(
    (partNumber: string) => {
      if (confirm(`Delete part ${partNumber}?`)) {
        deleteMutation.mutate(partNumber);
      }
    },
    [deleteMutation]
  );

  const columns = useMemo<ColumnDef<Part>[]>(
    () => [
      {
        accessorKey: 'partNumber',
        header: 'Part Number',
        cell: ({ row }) => <span className="font-mono">{row.getValue('partNumber')}</span>,
      },
      {
        accessorKey: 'imageUrl',
        header: 'Image',
        cell: ({ row }) => {
          const url = row.original.imageUrl;
          if (!url)
            return (
              <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-slate-300" />
              </div>
            );
          return (
            <img
              src={url}
              alt={row.original.partName}
              className="w-10 h-10 object-cover rounded bg-slate-100"
            />
          );
        },
      },
      {
        accessorKey: 'partName',
        header: 'Part Name',
      },
      {
        accessorKey: 'productLine',
        header: 'Product Line',
        cell: ({ row }) => (
          <span className="text-slate-500">{row.getValue('productLine') || '-'}</span>
        ),
      },
      {
        accessorKey: 'compatibleMachines',
        header: 'Compatible Machines',
        cell: ({ row }) => {
          const machines = row.original.compatibleMachines || [];
          if (machines.length === 0)
            return <span className="text-slate-400 italic text-xs">None</span>;
          return (
            <div className="flex flex-wrap gap-1 max-w-[300px]">
              {machines.map((m) => (
                <span
                  key={m}
                  className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200 whitespace-nowrap"
                >
                  {m}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1 justify-end">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setEditingPart(row.original);
                setDialogOpen(true);
              }}
              className="h-8 w-8 text-slate-400 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDelete(row.original.partNumber)}
              className="h-8 w-8 text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete]
  );

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 flex justify-between items-center px-6">
        <h1 className="text-lg font-semibold text-slate-800">Parts Catalog</h1>
        <Button
          onClick={() => {
            setEditingPart(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Part
        </Button>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-emerald-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={parts}
            searchKey="partNumber"
            searchPlaceholder="Search by part number..."
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPart ? 'Edit Part' : 'Add New Part'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label htmlFor="partNumber" className="block text-sm font-medium text-slate-600 mb-1">
                Part Number
              </label>
              <Input
                id="partNumber"
                value={form.partNumber}
                onChange={(e) => setForm((f) => ({ ...f, partNumber: e.target.value }))}
                placeholder="e.g., 141929-00"
                disabled={!!editingPart}
                required
              />
            </div>
            <div>
              <label htmlFor="partName" className="block text-sm font-medium text-slate-600 mb-1">
                Part Name
              </label>
              <Input
                id="partName"
                value={form.partName}
                onChange={(e) => setForm((f) => ({ ...f, partName: e.target.value }))}
                placeholder="e.g., Lower Housing USB"
                required
              />
            </div>
            <div>
              <label
                htmlFor="productLine"
                className="block text-sm font-medium text-slate-600 mb-1"
              >
                Product Line (optional)
              </label>
              <Input
                id="productLine"
                value={form.productLine}
                onChange={(e) => setForm((f) => ({ ...f, productLine: e.target.value }))}
                placeholder="e.g., Wave 1.1"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-slate-600 mb-2">
                Compatible Machines
              </span>
              <div className="border border-slate-200 rounded-md p-3 h-48 overflow-y-auto bg-slate-50 grid grid-cols-2 gap-2">
                {machines.map((machine) => (
                  <label
                    key={machine.machineId}
                    className="flex items-center gap-2 p-1 hover:bg-white rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.machineIds.includes(machine.machineId)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((f) => ({
                          ...f,
                          machineIds: checked
                            ? [...f.machineIds, machine.machineId]
                            : f.machineIds.filter((id) => id !== machine.machineId),
                        }));
                      }}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">
                      {machine.machineName}{' '}
                      <span className="text-slate-400 text-xs">({machine.model})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-600 mb-1">Part Image</span>
              <div className="flex items-center gap-4">
                {form.imageUrl ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                    <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 shadow-sm">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        setUploading(true);
                        const formData = new FormData();
                        formData.append('file', file);

                        try {
                          const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData,
                            headers: getAuthHeader(),
                          });

                          if (!res.ok) throw new Error('Upload failed');

                          const data = await res.json();
                          setForm((f) => ({ ...f, imageUrl: data.url }));
                        } catch (err) {
                          console.error(err);
                          alert('Failed to upload image');
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                  <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG, WebP. Max 5MB.</p>
                </div>
              </div>
            </div>

            {saveMutation.isError && (
              <p className="text-red-500 text-sm">{(saveMutation.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

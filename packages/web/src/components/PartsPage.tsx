// packages/web/src/components/PartsPage.tsx
// Admin page for managing parts catalog

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuthHeader } from '../lib/auth';
import { Button } from './ui/button';
import { DataTable } from './ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

interface Part {
  partNumber: string;
  partName: string;
  productLine: string | null;
}

async function fetchParts(): Promise<Part[]> {
  const res = await fetch('/api/reference/parts');
  if (!res.ok) throw new Error('Failed to fetch parts');
  return res.json();
}

export function PartsPage({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data: parts = [], isLoading } = useQuery({ queryKey: ['parts'], queryFn: fetchParts });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [form, setForm] = useState({ partNumber: '', partName: '', productLine: '' });

  useEffect(() => {
    if (editingPart) {
      setForm({
        partNumber: editingPart.partNumber,
        partName: editingPart.partName,
        productLine: editingPart.productLine ?? '',
      });
    } else {
      setForm({ partNumber: '', partName: '', productLine: '' });
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
        accessorKey: 'partName',
        header: 'Part Name',
      },
      {
        accessorKey: 'productLine',
        header: 'Product Line',
        cell: ({ row }) => (
          <span className="text-slate-400">{row.getValue('productLine') || '-'}</span>
        ),
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
              className="h-8 w-8 text-slate-400 hover:text-white"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDelete(row.original.partNumber)}
              className="h-8 w-8 text-slate-400 hover:text-red-400"
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
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold">Parts Catalog</h1>
        </div>
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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={parts}
          searchKey="partNumber"
          searchPlaceholder="Search by part number..."
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPart ? 'Edit Part' : 'Add New Part'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Part Number
                <Input
                  value={form.partNumber}
                  onChange={(e) => setForm((f) => ({ ...f, partNumber: e.target.value }))}
                  placeholder="e.g., 141929-00"
                  disabled={!!editingPart}
                  required
                  className="mt-1"
                />
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Part Name
                <Input
                  value={form.partName}
                  onChange={(e) => setForm((f) => ({ ...f, partName: e.target.value }))}
                  placeholder="e.g., Lower Housing USB"
                  required
                  className="mt-1"
                />
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Product Line (optional)
                <Input
                  value={form.productLine}
                  onChange={(e) => setForm((f) => ({ ...f, productLine: e.target.value }))}
                  placeholder="e.g., Wave 1.1"
                  className="mt-1"
                />
              </label>
            </div>
            {saveMutation.isError && (
              <p className="text-red-400 text-sm">{(saveMutation.error as Error).message}</p>
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
    </div>
  );
}

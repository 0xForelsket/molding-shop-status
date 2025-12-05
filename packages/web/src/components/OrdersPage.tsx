// packages/web/src/components/OrdersPage.tsx
// Admin page for managing production orders

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuthHeader } from '../lib/auth';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { DataTable } from './ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

interface Part {
  partNumber: string;
  partName: string;
}

interface Order {
  production_orders: {
    orderNumber: string;
    partNumber: string;
    quantityRequired: number;
    quantityCompleted: number;
    status: string;
    machineId: number | null;
  };
  parts: Part | null;
  machines: { machineName: string } | null;
}

// Flatten order for DataTable
interface FlatOrder {
  orderNumber: string;
  partNumber: string;
  partName: string | null;
  quantityRequired: number;
  quantityCompleted: number;
  status: string;
  machineName: string | null;
}

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders');
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
}

async function fetchParts(): Promise<Part[]> {
  const res = await fetch('/api/reference/parts');
  if (!res.ok) throw new Error('Failed to fetch parts');
  return res.json();
}

export function OrdersPage({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data: ordersRaw = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });
  const { data: parts = [] } = useQuery({ queryKey: ['parts'], queryFn: fetchParts });

  // Flatten orders for the table
  const orders: FlatOrder[] = useMemo(
    () =>
      ordersRaw.map((o) => ({
        orderNumber: o.production_orders.orderNumber,
        partNumber: o.production_orders.partNumber,
        partName: o.parts?.partName ?? null,
        quantityRequired: o.production_orders.quantityRequired,
        quantityCompleted: o.production_orders.quantityCompleted,
        status: o.production_orders.status,
        machineName: o.machines?.machineName ?? null,
      })),
    [ordersRaw]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<FlatOrder | null>(null);
  const [form, setForm] = useState({
    orderNumber: '',
    partNumber: '',
    quantityRequired: '',
    status: 'pending',
  });
  const [importText, setImportText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (editingOrder) {
      setForm({
        orderNumber: editingOrder.orderNumber,
        partNumber: editingOrder.partNumber,
        quantityRequired: String(editingOrder.quantityRequired),
        status: editingOrder.status,
      });
    } else {
      setForm({ orderNumber: '', partNumber: '', quantityRequired: '', status: 'pending' });
    }
  }, [editingOrder]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const url = editingOrder
        ? `/api/orders/${encodeURIComponent(editingOrder.orderNumber)}`
        : '/api/orders';
      const method = editingOrder ? 'PATCH' : 'POST';

      const body = editingOrder
        ? { status: data.status }
        : {
            orderNumber: data.orderNumber,
            partNumber: data.partNumber,
            quantityRequired: Number(data.quantityRequired),
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save order');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setDialogOpen(false);
      setEditingOrder(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderNumber: string) => {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete order');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch('/api/orders/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', ...getAuthHeader() },
        body: text,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setImportDialogOpen(false);
      setImportText('');
      alert(`Imported ${data.imported} orders`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleDelete = useCallback(
    (orderNumber: string) => {
      if (confirm(`Delete order ${orderNumber}?`)) {
        deleteMutation.mutate(orderNumber);
      }
    },
    [deleteMutation]
  );

  const statusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-slate-700 text-slate-300';
      case 'assigned':
        return 'bg-blue-900/50 text-blue-400';
      case 'running':
        return 'bg-green-900/50 text-green-400';
      case 'completed':
        return 'bg-emerald-900/50 text-emerald-400';
      case 'cancelled':
        return 'bg-red-900/50 text-red-400';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  }, []);

  const columns = useMemo<ColumnDef<FlatOrder>[]>(
    () => [
      {
        accessorKey: 'orderNumber',
        header: 'Order #',
        cell: ({ row }) => <span className="font-mono">{row.getValue('orderNumber')}</span>,
      },
      {
        accessorKey: 'partNumber',
        header: 'Part #',
        cell: ({ row }) => (
          <div>
            <span className="font-mono text-sm">{row.getValue('partNumber')}</span>
            {row.original.partName && (
              <span className="block text-xs text-slate-400">{row.original.partName}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'quantityRequired',
        header: 'Quantity',
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.quantityCompleted.toLocaleString()} /{' '}
            {row.original.quantityRequired.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'progress',
        header: 'Progress',
        enableSorting: false,
        cell: ({ row }) => {
          const progress =
            row.original.quantityRequired > 0
              ? Math.round((row.original.quantityCompleted / row.original.quantityRequired) * 100)
              : 0;
          return (
            <div className="flex items-center gap-2">
              <div className="w-20 bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 w-8">{progress}%</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        filterFn: (row, id, filterValue) => {
          if (filterValue === 'all') return true;
          return row.getValue(id) === filterValue;
        },
        cell: ({ row }) => (
          <span
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium',
              statusColor(row.getValue('status'))
            )}
          >
            {row.getValue('status')}
          </span>
        ),
      },
      {
        accessorKey: 'machineName',
        header: 'Machine',
        cell: ({ row }) => (
          <span className="text-slate-400">{row.getValue('machineName') || '-'}</span>
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
                setEditingOrder(row.original);
                setDialogOpen(true);
              }}
              className="h-8 w-8 text-slate-400 hover:text-white"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDelete(row.original.orderNumber)}
              className="h-8 w-8 text-slate-400 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [handleDelete, statusColor]
  );

  // Filter orders by status
  const filteredOrders = useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter)),
    [orders, statusFilter]
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold">Production Orders</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button
            onClick={() => {
              setEditingOrder(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Order
          </Button>
        </div>
      </header>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'assigned', 'running', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            )}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({orders.filter((o) => o.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredOrders}
          searchKey="orderNumber"
          searchPlaceholder="Search by order number..."
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrder ? 'Edit Order' : 'Add New Order'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {!editingOrder && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Order Number
                    <Input
                      value={form.orderNumber}
                      onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
                      placeholder="e.g., 1354981"
                      required
                      className="mt-1"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Part
                    <select
                      value={form.partNumber}
                      onChange={(e) => setForm((f) => ({ ...f, partNumber: e.target.value }))}
                      className="mt-1 w-full h-9 rounded-md border border-slate-600 bg-slate-700 px-3 text-sm text-white"
                      required
                    >
                      <option value="">Select part...</option>
                      {parts.map((p) => (
                        <option key={p.partNumber} value={p.partNumber}>
                          {p.partNumber} - {p.partName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Quantity Required
                    <Input
                      type="number"
                      value={form.quantityRequired}
                      onChange={(e) => setForm((f) => ({ ...f, quantityRequired: e.target.value }))}
                      placeholder="e.g., 5000"
                      required
                      className="mt-1"
                    />
                  </label>
                </div>
              </>
            )}
            {editingOrder && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Status
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="mt-1 w-full h-9 rounded-md border border-slate-600 bg-slate-700 px-3 text-sm text-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="running">Running</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>
            )}
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

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Orders from Excel</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-400">
              Paste data with 3 columns: <strong>Order #</strong>, <strong>Part #</strong>,{' '}
              <strong>Quantity</strong> (tab-separated)
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'1354981\t141929-00\t5000\n1354982\t147933-00\t3000'}
              className="w-full h-40 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm font-mono resize-none"
            />
            {importMutation.isError && (
              <p className="text-red-400 text-sm">{(importMutation.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => importMutation.mutate(importText)}
                disabled={importMutation.isPending || !importText.trim()}
              >
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

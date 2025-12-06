// packages/web/src/components/OrdersPage.tsx
// Admin page for managing production orders

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
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
  defaultMachineId: number | null;
}

interface Machine {
  machineId: number;
  machineName: string;
}

interface Order {
  production_orders: {
    orderNumber: string;
    partNumber: string;
    quantityRequired: number;
    quantityCompleted: number;
    status: string;
    machineId: number | null;
    targetCycleTime: number | null;
    targetUtilization: number | null;
    dueDate: string | null;
    notes: string | null;
  };
  parts: Part | null;
  machines: { machineName: string; targetCycleTime: number | null } | null;
  machine_parts: { targetCycleTime: number | null; cavityPlan: number | null } | null;
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
  targetCycleTime: number | null;
  machineTargetCycleTime: number | null;
  targetUtilization: number | null;
  dueDate: string | null;
  notes: string | null;
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

async function fetchMachines(): Promise<Machine[]> {
  const res = await fetch('/api/machines');
  if (!res.ok) throw new Error('Failed to fetch machines');
  return res.json();
}

export function OrdersPage() {
  const queryClient = useQueryClient();
  const { data: ordersRaw = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
  });
  const { data: parts = [] } = useQuery({ queryKey: ['parts'], queryFn: fetchParts });
  const { data: machines = [] } = useQuery({ queryKey: ['machines'], queryFn: fetchMachines });

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
        targetCycleTime: o.production_orders.targetCycleTime,
        machineTargetCycleTime:
          o.machine_parts?.targetCycleTime ?? o.machines?.targetCycleTime ?? null,
        targetUtilization: o.production_orders.targetUtilization,
        dueDate: o.production_orders.dueDate,
        notes: o.production_orders.notes,
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
    machineId: '',
    targetCycleTime: '',
    targetUtilization: '',
    dueDate: '',
    notes: '',
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
        machineId: '', // We don't have machineId in FlatOrder easily available for editing yet, or we need to fetch it.
        // Actually, FlatOrder has machineName, but not ID.
        // For now, let's leave it empty or try to find it from machines list if needed.
        // But wait, the user wants to set it on CREATION.
        // If editing, we might want to show the assigned machine.
        // Let's just default to empty for now on edit, as assignment is usually done via drag/drop or specific assign action.
        // BUT, if we want to change the "preferred" machine for a new order, we need it.
        targetCycleTime: editingOrder.targetCycleTime ? String(editingOrder.targetCycleTime) : '',
        targetUtilization: editingOrder.targetUtilization
          ? String(editingOrder.targetUtilization)
          : '',
        dueDate: editingOrder.dueDate
          ? new Date(editingOrder.dueDate).toISOString().slice(0, 16)
          : '',
        notes: editingOrder.notes ?? '',
      });
    } else {
      setForm({
        orderNumber: '',
        partNumber: '',
        quantityRequired: '',
        status: 'pending',
        machineId: '',
        targetCycleTime: '',
        targetUtilization: '',
        dueDate: '',
        notes: '',
      });
    }
  }, [editingOrder]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const url = editingOrder
        ? `/api/orders/${encodeURIComponent(editingOrder.orderNumber)}`
        : '/api/orders';
      const method = editingOrder ? 'PATCH' : 'POST';

      const body = editingOrder
        ? {
            status: data.status,
            targetCycleTime: data.targetCycleTime ? Number(data.targetCycleTime) : null,
            targetUtilization: data.targetUtilization ? Number(data.targetUtilization) : null,
            dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
            notes: data.notes,
          }
        : {
            orderNumber: data.orderNumber,
            partNumber: data.partNumber,
            quantityRequired: Number(data.quantityRequired),
            machineId: data.machineId ? Number(data.machineId) : undefined,
            targetCycleTime: data.targetCycleTime ? Number(data.targetCycleTime) : undefined,
            targetUtilization: data.targetUtilization ? Number(data.targetUtilization) : undefined,
            dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
            notes: data.notes,
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
        return 'bg-slate-200 text-slate-700';
      case 'assigned':
        return 'bg-blue-100 text-blue-700';
      case 'running':
        return 'bg-emerald-100 text-emerald-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-200 text-slate-700';
    }
  }, []);

  const columns = useMemo<ColumnDef<FlatOrder>[]>(
    () => [
      {
        accessorKey: 'orderNumber',
        header: 'Job',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-slate-900">{row.getValue('orderNumber')}</div>
            <div className="text-xs text-slate-500">
              {row.original.partNumber}
              {row.original.partName && ` - ${row.original.partName}`}
            </div>
            {row.original.notes && (
              <div className="text-xs text-slate-400 italic mt-0.5">{row.original.notes}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'targetCycleTime',
        header: 'Target Cycle',
        cell: ({ row }) => {
          const val = row.original.targetCycleTime ?? row.original.machineTargetCycleTime;
          return (
            <div className="flex flex-col">
              <span className="font-mono">{val ? val.toFixed(1) : '-'}</span>
              {row.original.targetCycleTime && (
                <span className="text-[10px] text-amber-600 font-medium">Override</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'quantityRequired',
        header: 'Target Count',
        cell: ({ row }) => (
          <div className="font-mono">{row.original.quantityRequired.toLocaleString()}</div>
        ),
      },
      {
        accessorKey: 'targetUtilization',
        header: 'Target Utilization',
        cell: ({ row }) => (
          <div className="font-mono">
            {row.original.targetUtilization ? `${row.original.targetUtilization}%` : '-'}
          </div>
        ),
      },
      {
        accessorKey: 'dueDate',
        header: 'Due',
        cell: ({ row }) => {
          if (!row.original.dueDate) return <span className="text-slate-400">-</span>;
          const date = new Date(row.original.dueDate);
          return (
            <div className="text-sm">
              {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              <div className="text-xs text-slate-400">
                {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          );
        },
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
              <div className="w-20 bg-slate-200 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 w-8">{progress}%</span>
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
              className="h-8 w-8 text-slate-400 hover:text-slate-700"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDelete(row.original.orderNumber)}
              className="h-8 w-8 text-slate-400 hover:text-red-600"
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
    <>
      <header className="h-14 bg-white border-b border-slate-200 flex justify-between items-center px-6">
        <h1 className="text-lg font-semibold text-slate-800">Production Orders</h1>
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

      <div className="flex-1 p-6 overflow-auto">
        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {['all', 'pending', 'assigned', 'running', 'completed', 'cancelled'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors border',
                statusFilter === s
                  ? 'bg-white border-slate-300 text-slate-900 shadow-sm'
                  : 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200'
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
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-emerald-600" />
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
                    <label
                      htmlFor="orderNumber"
                      className="block text-sm font-medium text-slate-300 mb-1"
                    >
                      Order Number
                    </label>
                    <Input
                      id="orderNumber"
                      value={form.orderNumber}
                      onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
                      placeholder="e.g., 1354981"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="partNumber"
                      className="block text-sm font-medium text-slate-600 mb-1"
                    >
                      Part
                    </label>
                    <select
                      id="partNumber"
                      value={form.partNumber}
                      onChange={(e) => {
                        const part = parts.find((p) => p.partNumber === e.target.value);
                        setForm((f) => ({
                          ...f,
                          partNumber: e.target.value,
                          machineId: part?.defaultMachineId ? String(part.defaultMachineId) : '',
                        }));
                      }}
                      className="w-full h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      required
                    >
                      <option value="">Select part...</option>
                      {parts.map((p) => (
                        <option key={p.partNumber} value={p.partNumber}>
                          {p.partNumber} - {p.partName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="machineId"
                      className="block text-sm font-medium text-slate-600 mb-1"
                    >
                      Preferred Machine
                    </label>
                    <select
                      id="machineId"
                      value={form.machineId}
                      onChange={(e) => setForm((f) => ({ ...f, machineId: e.target.value }))}
                      className="w-full h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Auto-assign / None</option>
                      {machines.map((m) => (
                        <option key={m.machineId} value={m.machineId}>
                          {m.machineName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="targetCycleTime"
                        className="block text-sm font-medium text-slate-600 mb-1"
                      >
                        Target Cycle (s)
                      </label>
                      <Input
                        id="targetCycleTime"
                        type="number"
                        step="0.1"
                        value={form.targetCycleTime}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, targetCycleTime: e.target.value }))
                        }
                        placeholder="Default"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="targetUtilization"
                        className="block text-sm font-medium text-slate-600 mb-1"
                      >
                        Target Utilization (%)
                      </label>
                      <Input
                        id="targetUtilization"
                        type="number"
                        min="0"
                        max="100"
                        value={form.targetUtilization}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, targetUtilization: e.target.value }))
                        }
                        placeholder="e.g. 90"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="quantityRequired"
                        className="block text-sm font-medium text-slate-600 mb-1"
                      >
                        Quantity Required
                      </label>
                      <Input
                        id="quantityRequired"
                        type="number"
                        value={form.quantityRequired}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, quantityRequired: e.target.value }))
                        }
                        placeholder="e.g., 5000"
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="dueDate"
                        className="block text-sm font-medium text-slate-600 mb-1"
                      >
                        Due Date
                      </label>
                      <Input
                        id="dueDate"
                        type="datetime-local"
                        value={form.dueDate}
                        onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="notes"
                      className="block text-sm font-medium text-slate-600 mb-1"
                    >
                      Notes
                    </label>
                    <Input
                      id="notes"
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional notes..."
                    />
                  </div>
                </>
              )}
              {editingOrder && (
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="running">Running</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}
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
    </>
  );
}

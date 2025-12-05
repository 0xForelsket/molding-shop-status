// packages/web/src/components/OrdersPage.tsx
// Admin page for managing production orders

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAuthHeader } from '../lib/auth';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

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
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });
  const { data: parts = [] } = useQuery({ queryKey: ['parts'], queryFn: fetchParts });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order['production_orders'] | null>(null);
  const [form, setForm] = useState({
    orderNumber: '',
    partNumber: '',
    quantityRequired: '',
    status: 'pending',
  });
  const [importText, setImportText] = useState('');

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

  const handleDelete = (orderNumber: string) => {
    if (confirm(`Delete order ${orderNumber}?`)) {
      deleteMutation.mutate(orderNumber);
    }
  };

  const statusColor = (status: string) => {
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
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold">Production Orders</h1>
          <span className="text-slate-400 text-sm">{orders.length} orders</span>
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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-800/50 hover:bg-slate-800/50">
                <TableHead>Order #</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const o = order.production_orders;
                const progress =
                  o.quantityRequired > 0
                    ? Math.round((o.quantityCompleted / o.quantityRequired) * 100)
                    : 0;
                return (
                  <TableRow key={o.orderNumber}>
                    <TableCell className="font-mono">{o.orderNumber}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-mono text-sm">{o.partNumber}</span>
                        {order.parts && (
                          <span className="block text-xs text-slate-400">
                            {order.parts.partName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {o.quantityCompleted.toLocaleString()} / {o.quantityRequired.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="w-24 bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{progress}%</span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          statusColor(o.status)
                        )}
                      >
                        {o.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {order.machines?.machineName || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingOrder(o);
                            setDialogOpen(true);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(o.orderNumber)}
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
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

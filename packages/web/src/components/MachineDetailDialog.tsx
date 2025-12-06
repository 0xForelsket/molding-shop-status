import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Play, Square } from 'lucide-react';
import type { Machine } from '../lib/api';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Progress } from './ui/progress';

interface MachineDetailDialogProps {
  machine: Machine | null;
  isOpen: boolean;
  onClose: () => void;
}

interface QueueOrder {
  orderNumber: string;
  partNumber: string;
  partName: string | null;
  quantityRequired: number;
  dueDate: string | null;
}

interface OrderResponse {
  production_orders: {
    orderNumber: string;
    partNumber: string;
    machineId: number | null;
    status: string;
    quantityRequired: number;
    dueDate: string | null;
  };
  parts: { partName: string } | null;
}

// Fetch assigned orders for this machine
async function fetchMachineQueue(machineId: number | undefined): Promise<QueueOrder[]> {
  if (!machineId) return [];
  const res = await fetch('/api/orders');
  if (!res.ok) throw new Error('Failed to fetch orders');
  const allOrders: OrderResponse[] = await res.json();

  // Filter for this machine and 'assigned' status
  return allOrders
    .filter(
      (o) =>
        o.production_orders.machineId === machineId && o.production_orders.status === 'assigned'
    )
    .map((o) => ({
      orderNumber: o.production_orders.orderNumber,
      partNumber: o.production_orders.partNumber,
      partName: o.parts?.partName ?? null,
      quantityRequired: o.production_orders.quantityRequired,
      dueDate: o.production_orders.dueDate,
    }));
}

export function MachineDetailDialog({ machine, isOpen, onClose }: MachineDetailDialogProps) {
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading: isLoadingQueue } = useQuery({
    queryKey: ['machine-queue', machine?.machineId],
    queryFn: () => fetchMachineQueue(machine?.machineId),
    enabled: !!machine,
  });

  const startOrderMutation = useMutation({
    mutationFn: async (orderNumber: string) => {
      const res = await fetch(`/api/orders/${orderNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running', startedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Failed to start order');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['machine-queue'] });
      // Keep dialog open to show updated status
    },
  });

  if (!machine) return null;

  const activeOrder = machine.productionOrder
    ? {
        orderNumber: machine.productionOrder,
        partNumber: machine.partNumber,
        partName: machine.partName,
        quantityRequired: machine.quantityRequired,
        quantityCompleted: machine.quantityCompleted,
      }
    : null;

  const progress = activeOrder?.quantityRequired
    ? Math.min(((activeOrder.quantityCompleted || 0) / activeOrder.quantityRequired) * 100, 100)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl font-bold text-slate-900">
                {machine.machineName}
              </DialogTitle>
              <span
                className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider ${
                  machine.status === 'running'
                    ? 'bg-emerald-100 text-emerald-700'
                    : machine.status === 'idle'
                      ? 'bg-amber-100 text-amber-700'
                      : machine.status === 'fault'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                }`}
              >
                {machine.status}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Active Job Section */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Play className="w-4 h-4" /> Current Job
            </h3>

            {activeOrder ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-2xl font-bold text-slate-900">
                      {activeOrder.orderNumber}
                    </div>
                    <div className="text-slate-600 font-medium">
                      {activeOrder.partNumber} - {activeOrder.partName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-mono font-bold text-slate-900">
                      {(activeOrder.quantityCompleted || 0).toLocaleString()}
                      <span className="text-slate-400 text-lg mx-1">/</span>
                      <span className="text-slate-500 text-lg">
                        {activeOrder.quantityRequired?.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Units Produced</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-500">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="destructive" className="flex-1 gap-2">
                    <Square className="w-4 h-4" /> Stop / Complete
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                  >
                    <AlertTriangle className="w-4 h-4" /> Log Downtime
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 italic">
                No active order running on this machine.
              </div>
            )}
          </div>

          {/* Queue Section */}
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Up Next (Assigned)
            </h3>

            {isLoadingQueue ? (
              <div className="text-sm text-slate-400">Loading queue...</div>
            ) : queue.length > 0 ? (
              <div className="space-y-2">
                {queue.map((order) => (
                  <div
                    key={order.orderNumber}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 transition-colors group"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{order.orderNumber}</div>
                      <div className="text-sm text-slate-600">
                        {order.partNumber} - {order.partName}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-mono font-medium">
                          {order.quantityRequired.toLocaleString()} units
                        </div>
                        {order.dueDate && (
                          <div className="text-xs text-slate-400">
                            Due: {new Date(order.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {!activeOrder && (
                        <Button
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => startOrderMutation.mutate(order.orderNumber)}
                        >
                          <Play className="w-3 h-3 mr-1" /> Start
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic border border-dashed border-slate-200 rounded-lg p-4 text-center">
                No orders assigned to this machine.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

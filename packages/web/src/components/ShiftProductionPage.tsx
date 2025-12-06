// packages/web/src/components/ShiftProductionPage.tsx

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useState } from 'react';

interface Machine {
  machineId: number;
  machineName: string;
  status: string;
  productionOrder: string | null;
  partNumber: string | null;
  partName: string | null;
}

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

interface Order {
  production_orders: {
    orderNumber: string;
    partNumber: string;
    quantityRequired: number;
    quantityCompleted: number;
    status: string;
  };
  parts: { partName: string } | null;
}

interface ProductionLogEntry {
  productionLog: {
    id: number;
    quantityProduced: number;
    quantityScrap: number;
    status: string;
    notes: string | null;
  };
}

async function fetchMachines(): Promise<Machine[]> {
  const res = await fetch('/api/machines');
  if (!res.ok) throw new Error('Failed to fetch machines');
  return res.json();
}

async function fetchCurrentShift(): Promise<Shift | null> {
  const res = await fetch('/api/shifts/current');
  if (!res.ok) throw new Error('Failed to fetch shift');
  return res.json();
}

async function fetchAssignedOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders');
  if (!res.ok) throw new Error('Failed to fetch orders');
  const allOrders = await res.json();
  return allOrders.filter(
    (o: Order) =>
      o.production_orders.status === 'assigned' || o.production_orders.status === 'running'
  );
}

async function fetchTodayLogs(machineId: number): Promise<ProductionLogEntry[]> {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`/api/production-logs?machineId=${machineId}&shiftDate=${today}`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export function ShiftProductionPage() {
  const queryClient = useQueryClient();
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string>('');
  const [quantityProduced, setQuantityProduced] = useState<number>(0);
  const [quantityScrap, setQuantityScrap] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const { data: machines = [] } = useQuery({
    queryKey: ['machines'],
    queryFn: fetchMachines,
  });

  const { data: currentShift } = useQuery({
    queryKey: ['current-shift'],
    queryFn: fetchCurrentShift,
  });

  const { data: assignedOrders = [] } = useQuery({
    queryKey: ['assigned-orders', selectedMachineId],
    queryFn: fetchAssignedOrders,
    enabled: !!selectedMachineId,
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['today-logs', selectedMachineId],
    queryFn: () => (selectedMachineId ? fetchTodayLogs(selectedMachineId) : Promise.resolve([])),
    enabled: !!selectedMachineId,
  });

  const createLogMutation = useMutation({
    mutationFn: async (data: {
      machineId: number;
      orderNumber: string;
      shiftId: number;
      shiftDate: string;
      quantityProduced: number;
      quantityScrap: number;
      notes: string;
    }) => {
      const res = await fetch('/api/production-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create log');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-logs'] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      setQuantityProduced(0);
      setQuantityScrap(0);
      setNotes('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId || !selectedOrderNumber || !currentShift) return;

    createLogMutation.mutate({
      machineId: selectedMachineId,
      orderNumber: selectedOrderNumber,
      shiftId: currentShift.id,
      shiftDate: new Date().toISOString(),
      quantityProduced,
      quantityScrap,
      notes,
    });
  };

  const selectedMachine = machines.find((m) => m.machineId === selectedMachineId);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Shift Production Entry</h1>
        {currentShift ? (
          <div className="flex items-center gap-2 mt-2 text-indigo-600">
            <Clock className="h-4 w-4" />
            <span className="font-medium">{currentShift.name}</span>
            <span className="text-slate-400">
              ({currentShift.startTime} - {currentShift.endTime})
            </span>
          </div>
        ) : (
          <p className="text-amber-600 mt-2">No active shift detected</p>
        )}
      </header>

      {/* Machine Selection */}
      <section className="mb-6">
        <span className="block text-sm font-medium text-slate-700 mb-2">Select Machine</span>
        <div className="grid grid-cols-4 gap-2">
          {machines.map((machine) => (
            <button
              key={machine.machineId}
              type="button"
              onClick={() => setSelectedMachineId(machine.machineId)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedMachineId === machine.machineId
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="font-bold text-slate-900">{machine.machineName}</div>
              <div className="text-xs text-slate-500 capitalize">{machine.status}</div>
            </button>
          ))}
        </div>
      </section>

      {selectedMachine && (
        <>
          {/* Order Selection */}
          <section className="mb-6">
            <span className="block text-sm font-medium text-slate-700 mb-2">
              Select Production Order
            </span>
            {assignedOrders.length > 0 ? (
              <div className="space-y-2">
                {assignedOrders.map((order) => (
                  <button
                    key={order.production_orders.orderNumber}
                    type="button"
                    onClick={() => setSelectedOrderNumber(order.production_orders.orderNumber)}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      selectedOrderNumber === order.production_orders.orderNumber
                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-900">
                          Order: {order.production_orders.orderNumber}
                        </div>
                        <div className="text-sm text-slate-600">
                          {order.production_orders.partNumber} - {order.parts?.partName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-700">
                          {order.production_orders.quantityCompleted} /{' '}
                          {order.production_orders.quantityRequired}
                        </div>
                        <div className="text-xs text-slate-500">
                          {Math.round(
                            (order.production_orders.quantityCompleted /
                              order.production_orders.quantityRequired) *
                              100
                          )}
                          % complete
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic">No orders assigned to this machine</p>
            )}
          </section>

          {/* Production Entry Form */}
          {selectedOrderNumber && (
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-lg border border-slate-200 p-6 mb-6"
            >
              <h3 className="font-bold text-lg text-slate-900 mb-4">Log Production</h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="quantity-produced"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Parts Produced
                  </label>
                  <input
                    id="quantity-produced"
                    type="number"
                    min="0"
                    value={quantityProduced}
                    onChange={(e) => setQuantityProduced(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="quantity-scrap"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Scrap / Rejects
                  </label>
                  <input
                    id="quantity-scrap"
                    type="number"
                    min="0"
                    value={quantityScrap}
                    onChange={(e) => setQuantityScrap(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  placeholder="Any notes about this shift..."
                />
              </div>

              <button
                type="submit"
                disabled={createLogMutation.isPending || quantityProduced === 0}
                className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createLogMutation.isPending ? 'Saving...' : 'Log Production'}
              </button>
            </form>
          )}

          {/* Today's Logs */}
          <section>
            <h3 className="font-bold text-lg text-slate-900 mb-4">Today's Production Logs</h3>
            {todayLogs.length > 0 ? (
              <div className="space-y-2">
                {todayLogs.map((log) => (
                  <div
                    key={log.productionLog.id}
                    className="p-4 bg-white rounded-lg border border-slate-200"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-slate-900">
                          {log.productionLog.quantityProduced} parts
                        </span>
                        {log.productionLog.quantityScrap > 0 && (
                          <span className="text-red-600 ml-2">
                            ({log.productionLog.quantityScrap} scrap)
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          log.productionLog.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {log.productionLog.status}
                      </span>
                    </div>
                    {log.productionLog.notes && (
                      <p className="text-sm text-slate-500 mt-1">{log.productionLog.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic">No logs for today yet</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

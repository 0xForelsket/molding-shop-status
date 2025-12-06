// packages/web/src/components/ShiftProductionPage.tsx
// Redesigned with improved 2-panel layout, modern styling, and better UX

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Copy, Factory, Package, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DowntimeSlideout } from './DowntimeSlideout';
import { ShiftDaySelector } from './ShiftDaySelector';
import { ShiftTimeline } from './ShiftTimeline';
import { ProgressRing } from './ui/ProgressRing';

// Types
interface Machine {
  machineId: number;
  machineName: string;
  status: 'running' | 'idle' | 'fault' | 'offline';
  productionOrder: string | null;
  quantityCompleted: number | null;
  quantityRequired: number | null;
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

interface ProductionLog {
  productionLog: {
    id: number;
    shiftId: number;
    shiftDate: string;
    quantityProduced: number;
    quantityScrap: number;
    status: string;
    notes: string | null;
  };
}

interface DowntimeReason {
  code: string;
  name: string;
  category: string;
}

interface ScrapReason {
  id: number;
  code: string;
  name: string;
  category: string;
}

interface ScrapEntry {
  id: string;
  reasonId: number;
  quantity: number;
}

// API functions
async function fetchMachines(): Promise<Machine[]> {
  const res = await fetch('/api/machines');
  if (!res.ok) throw new Error('Failed to fetch machines');
  return res.json();
}

async function fetchShifts(): Promise<Shift[]> {
  const res = await fetch('/api/shifts');
  if (!res.ok) throw new Error('Failed to fetch shifts');
  return res.json();
}

async function fetchCurrentShift(): Promise<Shift | null> {
  const res = await fetch('/api/shifts/current');
  if (!res.ok) throw new Error('Failed to fetch current shift');
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

async function fetchRecentLogs(machineId: number): Promise<ProductionLog[]> {
  const res = await fetch(`/api/production-logs?machineId=${machineId}`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

async function fetchDowntimeReasons(): Promise<DowntimeReason[]> {
  const res = await fetch('/api/reference/downtime-reasons');
  if (!res.ok) return [];
  return res.json();
}

async function fetchScrapReasons(): Promise<ScrapReason[]> {
  const res = await fetch('/api/reference/scrap-reasons');
  if (!res.ok) return [];
  return res.json();
}

// Helper functions
function getStatusColor(status: string): 'emerald' | 'amber' | 'red' | 'slate' {
  switch (status) {
    case 'running':
      return 'emerald';
    case 'idle':
      return 'amber';
    case 'fault':
      return 'red';
    default:
      return 'slate';
  }
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-emerald-500';
    case 'idle':
      return 'bg-amber-500';
    case 'fault':
      return 'bg-red-500';
    default:
      return 'bg-slate-400';
  }
}

export function ShiftProductionPage() {
  const queryClient = useQueryClient();

  // Selection state
  const [selectedMachineId, setSelectedMachineId] = useState<number | null>(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [timeFrom, setTimeFrom] = useState('06:00');
  const [timeTo, setTimeTo] = useState('18:00');

  // Form state
  const [quantityProduced, setQuantityProduced] = useState(0);
  const [scrapEntries, setScrapEntries] = useState<ScrapEntry[]>([]);
  const [notes, setNotes] = useState('');

  // UI state
  const [showDowntime, setShowDowntime] = useState(false);

  // Queries
  const { data: machines = [] } = useQuery({
    queryKey: ['machines'],
    queryFn: fetchMachines,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: fetchShifts,
  });

  const { data: currentShift } = useQuery({
    queryKey: ['current-shift'],
    queryFn: fetchCurrentShift,
  });

  const { data: assignedOrders = [] } = useQuery({
    queryKey: ['assigned-orders'],
    queryFn: fetchAssignedOrders,
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ['recent-logs', selectedMachineId],
    queryFn: () => (selectedMachineId ? fetchRecentLogs(selectedMachineId) : Promise.resolve([])),
    enabled: !!selectedMachineId,
  });

  const { data: downtimeReasons = [] } = useQuery({
    queryKey: ['downtime-reasons'],
    queryFn: fetchDowntimeReasons,
  });

  const { data: scrapReasons = [] } = useQuery({
    queryKey: ['scrap-reasons'],
    queryFn: fetchScrapReasons,
  });

  // Set initial shift when loaded
  useMemo(() => {
    if (currentShift && !selectedShiftId) {
      setSelectedShiftId(currentShift.id);
      setTimeFrom(currentShift.startTime);
      setTimeTo(currentShift.endTime);
    }
  }, [currentShift, selectedShiftId]);

  // Create log mutation
  const createLogMutation = useMutation({
    mutationFn: async (data: {
      machineId: number;
      orderNumber: string;
      shiftId: number;
      shiftDate: string;
      quantityProduced: number;
      scraps: ScrapEntry[];
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
      queryClient.invalidateQueries({ queryKey: ['recent-logs'] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      setQuantityProduced(0);
      setScrapEntries([]);
      setNotes('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId || !selectedOrderNumber || !selectedShiftId) return;

    createLogMutation.mutate({
      machineId: selectedMachineId,
      orderNumber: selectedOrderNumber,
      shiftId: selectedShiftId,
      shiftDate: selectedDate.toISOString(),
      quantityProduced,
      scraps: scrapEntries.map(({ reasonId, quantity }) => ({ reasonId, quantity })),
      notes,
    });
  };

  // Derived state
  const selectedMachine = machines.find((m) => m.machineId === selectedMachineId);
  const selectedOrder = assignedOrders.find(
    (o) => o.production_orders.orderNumber === selectedOrderNumber
  );

  const totalScrap = scrapEntries.reduce((sum, s) => sum + s.quantity, 0);

  // Previous shift logs (for summary)
  const previousShiftLogs = useMemo(() => {
    if (!selectedMachineId || !recentLogs.length) return null;

    // Find logs from previous shift
    const validLogs = recentLogs.filter((l) => l.productionLog);
    const sorted = [...validLogs].sort(
      (a, b) =>
        new Date(b.productionLog.shiftDate).getTime() -
        new Date(a.productionLog.shiftDate).getTime()
    );

    // Get earliest distinct shift
    const currentKey = `${selectedDate.toISOString().split('T')[0]}-${selectedShiftId}`;
    const previousLogs = sorted.filter((log) => {
      const logKey = `${log.productionLog.shiftDate.split('T')[0]}-${log.productionLog.shiftId}`;
      return logKey !== currentKey;
    });

    if (!previousLogs.length) return null;

    const firstPrevious = previousLogs[0];
    const prevShiftId = firstPrevious.productionLog.shiftId;
    const prevDate = firstPrevious.productionLog.shiftDate.split('T')[0];

    const allPreviousShiftLogs = previousLogs.filter(
      (log) =>
        log.productionLog.shiftId === prevShiftId &&
        log.productionLog.shiftDate.startsWith(prevDate)
    );

    const totalProduced = allPreviousShiftLogs.reduce(
      (sum, l) => sum + (l.productionLog.quantityProduced || 0),
      0
    );
    const totalScrap = allPreviousShiftLogs.reduce(
      (sum, l) => sum + (l.productionLog.quantityScrap || 0),
      0
    );
    const prevShift = shifts.find((s) => s.id === prevShiftId);

    return {
      shiftName: prevShift?.name || 'Previous Shift',
      date: prevDate,
      totalProduced,
      totalScrap,
      scrapRate:
        totalProduced > 0 ? ((totalScrap / (totalProduced + totalScrap)) * 100).toFixed(1) : '0',
    };
  }, [selectedMachineId, recentLogs, selectedDate, selectedShiftId, shifts]);

  // Running totals calculation
  const runningTotals = useMemo(() => {
    if (!selectedOrder) return null;

    const current = selectedOrder.production_orders.quantityCompleted;
    const required = selectedOrder.production_orders.quantityRequired;
    const afterEntry = current + quantityProduced;
    const currentPercent = (current / required) * 100;
    const afterPercent = (afterEntry / required) * 100;
    const remaining = required - afterEntry;

    // Estimate shifts remaining (assume ~1000 parts per shift average)
    const avgPerShift = 1000;
    const shiftsRemaining = remaining > 0 ? Math.ceil(remaining / avgPerShift) : 0;

    return {
      current,
      afterEntry,
      required,
      currentPercent,
      afterPercent,
      remaining,
      shiftsRemaining,
    };
  }, [selectedOrder, quantityProduced]);

  // Copy previous shift values
  const copyPreviousValues = () => {
    if (previousShiftLogs) {
      setQuantityProduced(previousShiftLogs.totalProduced);
      // We can't easily copy scrap details, so we just reset them
      setScrapEntries([]);
    }
  };

  const addScrapEntry = () => {
    if (scrapReasons.length > 0) {
      setScrapEntries([
        ...scrapEntries,
        { id: crypto.randomUUID(), reasonId: scrapReasons[0].id, quantity: 1 },
      ]);
    }
  };

  const updateScrapEntry = (index: number, field: keyof ScrapEntry, value: number) => {
    const newEntries = [...scrapEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setScrapEntries(newEntries);
  };

  const removeScrapEntry = (index: number) => {
    setScrapEntries(scrapEntries.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left Panel - Machine List */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Machines</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {machines.map((machine) => {
            const progress = machine.quantityRequired
              ? ((machine.quantityCompleted || 0) / machine.quantityRequired) * 100
              : 0;
            const isSelected = selectedMachineId === machine.machineId;

            return (
              <button
                key={machine.machineId}
                type="button"
                onClick={() => {
                  setSelectedMachineId(machine.machineId);
                  setSelectedOrderNumber('');
                }}
                className={`w-full p-3 rounded-lg transition-all text-left group border ${
                  isSelected
                    ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300'
                    : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <ProgressRing
                    progress={progress}
                    size={36}
                    strokeWidth={4}
                    color={getStatusColor(machine.status)}
                    showPercentage={false}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-bold text-slate-800 truncate">
                      {machine.machineName}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${getStatusBg(machine.status)}`} />
                      <span
                        className={`text-xs capitalize font-medium ${
                          machine.status === 'running'
                            ? 'text-emerald-700'
                            : machine.status === 'idle'
                              ? 'text-amber-700'
                              : machine.status === 'fault'
                                ? 'text-red-700'
                                : 'text-slate-500'
                        }`}
                      >
                        {machine.status}
                      </span>
                    </div>
                  </div>
                </div>
                {machine.quantityRequired && (
                  <div className="text-xs text-slate-500 pl-[48px]">
                    <span className="font-medium text-slate-700">
                      {(machine.quantityCompleted || 0).toLocaleString()}
                    </span>{' '}
                    / {machine.quantityRequired.toLocaleString()}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Panel - Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Factory className="w-6 h-6 text-blue-700" />
              </div>
              Shift Production Entry
            </h1>
            {currentShift && (
              <div className="flex items-center gap-2 mt-2 text-slate-600 ml-14">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-700">{currentShift.name}</span>
                <span className="text-slate-400">
                  ({currentShift.startTime} - {currentShift.endTime})
                </span>
              </div>
            )}
          </header>

          {/* Shift Timeline */}
          <ShiftTimeline
            shifts={shifts}
            logs={recentLogs
              .filter((l) => l.productionLog)
              .map((l) => ({
                shiftId: l.productionLog.shiftId,
                shiftDate: l.productionLog.shiftDate,
                quantityProduced: l.productionLog.quantityProduced,
              }))}
            selectedDate={selectedDate}
            selectedShiftId={selectedShiftId}
            onSelect={(date, shiftId) => {
              setSelectedDate(date);
              setSelectedShiftId(shiftId);
              const shift = shifts.find((s) => s.id === shiftId);
              if (shift) {
                setTimeFrom(shift.startTime);
                setTimeTo(shift.endTime);
              }
            }}
          />

          {/* Shift/Day Selector */}
          <ShiftDaySelector
            shifts={shifts}
            selectedDate={selectedDate}
            selectedShiftId={selectedShiftId}
            timeFrom={timeFrom}
            timeTo={timeTo}
            onDateChange={setSelectedDate}
            onShiftChange={(shiftId) => {
              setSelectedShiftId(shiftId);
              const shift = shifts.find((s) => s.id === shiftId);
              if (shift) {
                setTimeFrom(shift.startTime);
                setTimeTo(shift.endTime);
              }
            }}
            onTimeChange={(from, to) => {
              setTimeFrom(from);
              setTimeTo(to);
            }}
          />

          {selectedMachine ? (
            <>
              {/* Order Selection */}
              <div className="mb-8">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5 text-slate-500" />
                  Select Production Order
                </h3>
                {assignedOrders.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {assignedOrders
                      .filter(
                        (o) =>
                          o.production_orders.status === 'running' ||
                          o.production_orders.status === 'assigned'
                      )
                      .map((order) => {
                        const isSelected =
                          selectedOrderNumber === order.production_orders.orderNumber;
                        const progress =
                          (order.production_orders.quantityCompleted /
                            order.production_orders.quantityRequired) *
                          100;

                        return (
                          <button
                            key={order.production_orders.orderNumber}
                            type="button"
                            onClick={() =>
                              setSelectedOrderNumber(order.production_orders.orderNumber)
                            }
                            className={`p-5 rounded-xl border text-left transition-all flex items-center gap-5 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-200'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            <ProgressRing
                              progress={progress}
                              size={52}
                              strokeWidth={5}
                              color="indigo"
                              showPercentage={true}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-900 text-xl mb-1">
                                {order.production_orders.orderNumber}
                              </div>
                              <div className="text-sm text-slate-600 truncate font-medium">
                                {order.production_orders.partNumber}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 truncate">
                                {order.parts?.partName}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-slate-700">
                                {order.production_orders.quantityCompleted.toLocaleString()}
                              </div>
                              <div className="text-xs text-slate-400">
                                / {order.production_orders.quantityRequired.toLocaleString()}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <div className="bg-slate-100 rounded-xl border border-slate-200 p-8 text-center">
                    <Package className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                    <p className="font-medium text-slate-500">No orders assigned</p>
                  </div>
                )}
              </div>

              {/* Previous Shift Summary */}
              {previousShiftLogs && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                        Last Shift Performance
                      </div>
                      <div className="text-sm text-amber-900 mt-0.5">
                        <span className="font-medium">{previousShiftLogs.shiftName}</span>
                        <span className="mx-2 text-amber-300">|</span>
                        Produced:{' '}
                        <strong>{previousShiftLogs.totalProduced.toLocaleString()}</strong>
                        <span className="mx-2 text-amber-300">|</span>
                        Scrap: <strong>{previousShiftLogs.totalScrap}</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={copyPreviousValues}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-amber-200 text-amber-800 hover:bg-amber-50 font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Values
                  </button>
                </div>
              )}

              {/* Production Entry Form */}
              {selectedOrderNumber && (
                <form
                  onSubmit={handleSubmit}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-lg">Log Production Data</h3>
                  </div>

                  <div className="p-6 space-y-8">
                    {/* Good Parts */}
                    <div>
                      <label
                        htmlFor="qty-produced"
                        className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide"
                      >
                        Good Parts Produced
                      </label>
                      <input
                        id="qty-produced"
                        type="number"
                        min="0"
                        value={quantityProduced}
                        onChange={(e) => setQuantityProduced(Number(e.target.value))}
                        className="w-full px-4 py-4 bg-white border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-3xl font-bold text-slate-800 transition-all placeholder:text-slate-200"
                        placeholder="0"
                      />
                    </div>

                    {/* Scrap Section */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                          Scrap / Rejects
                        </span>
                        <button
                          type="button"
                          onClick={addScrapEntry}
                          className="text-sm flex items-center gap-1 text-blue-600 font-semibold hover:text-blue-700"
                        >
                          <Plus className="w-4 h-4" />
                          Add Scrap Reason
                        </button>
                      </div>

                      {scrapEntries.length > 0 ? (
                        <div className="space-y-3">
                          {scrapEntries.map((entry, index) => (
                            <div key={entry.id} className="flex gap-3">
                              <select
                                id={`scrap-reason-${entry.id}`}
                                value={entry.reasonId}
                                onChange={(e) =>
                                  updateScrapEntry(index, 'reasonId', Number(e.target.value))
                                }
                                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm font-medium"
                                aria-label="Scrap Reason"
                              >
                                {scrapReasons.map((reason) => (
                                  <option key={reason.id} value={reason.id}>
                                    {reason.name} ({reason.code})
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="1"
                                value={entry.quantity}
                                onChange={(e) =>
                                  updateScrapEntry(index, 'quantity', Number(e.target.value))
                                }
                                className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm font-bold text-center"
                              />
                              <button
                                type="button"
                                onClick={() => removeScrapEntry(index)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <div className="pt-3 mt-3 border-t border-slate-200 flex justify-end text-sm font-medium text-slate-600">
                            Total Scrap:{' '}
                            <span className="ml-2 font-bold text-slate-900">{totalScrap}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-slate-400 text-sm italic">
                          No scrap recorded. Click "Add Scrap Reason" to log defects.
                        </div>
                      )}
                    </div>

                    {/* Running Totals */}
                    {runningTotals && quantityProduced > 0 && (
                      <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                        <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">
                          Projected Progress
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-lg font-medium">
                              {runningTotals.current.toLocaleString()}
                            </span>
                            <span className="text-blue-400">→</span>
                            <span className="font-bold text-slate-900 text-2xl">
                              {runningTotals.afterEntry.toLocaleString()}
                            </span>
                            <span className="text-slate-400 text-sm">
                              / {runningTotals.required.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex-1 h-2.5 bg-white rounded-full overflow-hidden shadow-inner">
                            <div
                              className="h-full bg-blue-500 transition-all rounded-full"
                              style={{ width: `${Math.min(runningTotals.afterPercent, 100)}%` }}
                            />
                          </div>
                          <div className="text-lg font-bold text-blue-700">
                            {Math.round(runningTotals.afterPercent)}%
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="notes"
                        className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide"
                      >
                        Notes
                      </label>
                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-colors placeholder:text-slate-300"
                        placeholder="Any notes about this shift..."
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-4">
                    <button
                      type="submit"
                      disabled={createLogMutation.isPending || quantityProduced === 0}
                      className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-200 text-lg"
                    >
                      {createLogMutation.isPending ? 'Saving...' : 'Log Production'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDowntime(true)}
                      className="py-4 px-8 bg-white border border-amber-300 text-amber-700 font-bold rounded-xl hover:bg-amber-50 transition-colors shadow-sm"
                    >
                      Log Downtime
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <Factory className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">Ready to Log</h3>
              <p className="text-slate-500 max-w-xs">
                Select a machine from the sidebar to begin logging production data.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Downtime Slideout */}
      {selectedMachine && selectedShiftId && (
        <DowntimeSlideout
          isOpen={showDowntime}
          onClose={() => setShowDowntime(false)}
          machineId={selectedMachine.machineId}
          machineName={selectedMachine.machineName}
          shiftId={selectedShiftId}
          shiftDate={selectedDate}
          downtimeReasons={downtimeReasons}
        />
      )}
    </div>
  );
}

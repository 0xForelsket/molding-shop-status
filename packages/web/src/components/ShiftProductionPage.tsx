// packages/web/src/components/ShiftProductionPage.tsx
// Redesigned with 2-panel layout, progress rings, timeline, and running totals

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Copy } from 'lucide-react';
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
  const [quantityScrap, setQuantityScrap] = useState(0);
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
      queryClient.invalidateQueries({ queryKey: ['recent-logs'] });
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      setQuantityProduced(0);
      setQuantityScrap(0);
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
      quantityScrap,
      notes,
    });
  };

  // Derived state
  const selectedMachine = machines.find((m) => m.machineId === selectedMachineId);
  const selectedOrder = assignedOrders.find(
    (o) => o.production_orders.orderNumber === selectedOrderNumber
  );

  // Previous shift logs (for summary)
  const previousShiftLogs = useMemo(() => {
    if (!selectedMachineId || !recentLogs.length) return null;

    // Find logs from previous shift
    const sorted = [...recentLogs].sort(
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
      setQuantityScrap(previousShiftLogs.totalScrap);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Machine List */}
      <div className="w-52 bg-slate-50 border-r border-slate-200 p-3 overflow-y-auto">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Machines</h2>
        <div className="space-y-2">
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
                className={`w-full p-2 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <ProgressRing
                  progress={progress}
                  size={48}
                  strokeWidth={4}
                  color={getStatusColor(machine.status)}
                  showPercentage={true}
                />
                <div className="mt-1 text-sm font-bold text-slate-800">{machine.machineName}</div>
                <div
                  className={`text-xs capitalize ${
                    machine.status === 'running'
                      ? 'text-emerald-600'
                      : machine.status === 'idle'
                        ? 'text-amber-600'
                        : machine.status === 'fault'
                          ? 'text-red-600'
                          : 'text-slate-500'
                  }`}
                >
                  {machine.status}
                </div>
                {machine.quantityRequired && (
                  <div className="text-xs text-slate-500 mt-1">
                    {(machine.quantityCompleted || 0).toLocaleString()} /{' '}
                    {machine.quantityRequired.toLocaleString()}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Panel - Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">Shift Production Entry</h1>
          {currentShift && (
            <div className="flex items-center gap-2 mt-1 text-indigo-600">
              <Clock className="h-4 w-4" />
              <span className="font-medium">{currentShift.name}</span>
              <span className="text-slate-400">
                ({currentShift.startTime} - {currentShift.endTime})
              </span>
            </div>
          )}
        </header>

        {/* Shift Timeline */}
        <ShiftTimeline
          shifts={shifts}
          logs={recentLogs.map((l) => ({
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
            <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
              <h3 className="font-bold text-slate-800 mb-3">Select Production Order</h3>
              {assignedOrders.length > 0 ? (
                <div className="space-y-2">
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
                          className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-4 ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <ProgressRing
                            progress={progress}
                            size={40}
                            strokeWidth={3}
                            color="indigo"
                            showPercentage={false}
                          />
                          <div className="flex-1">
                            <div className="font-bold text-slate-900">
                              {order.production_orders.orderNumber}
                            </div>
                            <div className="text-sm text-slate-600">
                              {order.production_orders.partNumber} - {order.parts?.partName}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-slate-700">
                              {order.production_orders.quantityCompleted.toLocaleString()} /{' '}
                              {order.production_orders.quantityRequired.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">
                              {Math.round(progress)}% complete
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              ) : (
                <p className="text-slate-500 italic">No orders assigned</p>
              )}
            </div>

            {/* Previous Shift Summary */}
            {previousShiftLogs && (
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-800">
                      Last Shift ({previousShiftLogs.shiftName}, {previousShiftLogs.date})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyPreviousValues}
                    className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium"
                  >
                    <Copy className="w-3 h-3" />
                    Copy Values
                  </button>
                </div>
                <div className="text-sm text-amber-900">
                  Produced:{' '}
                  <span className="font-bold">
                    {previousShiftLogs.totalProduced.toLocaleString()}
                  </span>
                  {' | '}
                  Scrap: <span className="font-bold">{previousShiftLogs.totalScrap}</span> (
                  {previousShiftLogs.scrapRate}%)
                </div>
              </div>
            )}

            {/* Production Entry Form */}
            {selectedOrderNumber && (
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-lg border border-slate-200 p-4 mb-4"
              >
                <h3 className="font-bold text-slate-800 mb-4">Log Production</h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label
                      htmlFor="qty-produced"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Parts Produced
                    </label>
                    <input
                      id="qty-produced"
                      type="number"
                      min="0"
                      value={quantityProduced}
                      onChange={(e) => setQuantityProduced(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 text-lg font-bold"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="qty-scrap"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Scrap / Rejects
                    </label>
                    <input
                      id="qty-scrap"
                      type="number"
                      min="0"
                      value={quantityScrap}
                      onChange={(e) => setQuantityScrap(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Running Totals */}
                {runningTotals && quantityProduced > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3 mb-4">
                    <div className="text-sm text-slate-600 mb-2">After this entry:</div>
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-slate-500">
                          {runningTotals.current.toLocaleString()}
                        </span>
                        <span className="mx-2 text-indigo-600 font-bold">→</span>
                        <span className="font-bold text-slate-900">
                          {runningTotals.afterEntry.toLocaleString()}
                        </span>
                        <span className="text-slate-400">
                          {' '}
                          / {runningTotals.required.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all"
                          style={{ width: `${Math.min(runningTotals.afterPercent, 100)}%` }}
                        />
                      </div>
                      <div className="text-sm font-bold text-slate-700">
                        {Math.round(runningTotals.afterPercent)}%
                      </div>
                    </div>
                    {runningTotals.shiftsRemaining > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        ~{runningTotals.shiftsRemaining} shift
                        {runningTotals.shiftsRemaining > 1 ? 's' : ''} remaining
                      </div>
                    )}
                  </div>
                )}

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

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createLogMutation.isPending || quantityProduced === 0}
                    className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createLogMutation.isPending ? 'Saving...' : 'Log Production'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDowntime(true)}
                    className="py-3 px-4 border border-amber-300 text-amber-700 font-medium rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    Log Downtime →
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center">
            <div className="text-slate-400 text-lg">← Select a machine to start logging</div>
          </div>
        )}
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

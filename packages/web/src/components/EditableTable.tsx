// packages/web/src/components/EditableTable.tsx
// Simple editable table - order-based assignment with auto-fill

import { Pencil, Save, X } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import type { Machine } from '../lib/api';
import { getAuthHeader } from '../lib/auth';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

interface AvailableOrder {
  orderNumber: string;
  partNumber: string;
  partName: string | null;
}

interface PartWithOrders {
  partNumber: string;
  partName: string | null;
  lowestOrder: string;
  orderCount: number;
}

interface AvailableData {
  orders: AvailableOrder[];
  byPart: PartWithOrders[];
}

// Memoized row component
const MachineRow = memo(function MachineRow({
  machine,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  availableData,
  isSaving,
}: {
  machine: Machine;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (orderNumber: string | null) => void;
  onCancel: () => void;
  availableData: AvailableData | null;
  isSaving: boolean;
}) {
  const [selectedOrder, setSelectedOrder] = useState(machine.productionOrder ?? '');
  const [selectMode, setSelectMode] = useState<'order' | 'part'>('order');

  // Reset when editing starts
  useEffect(() => {
    if (isEditing) {
      setSelectedOrder(machine.productionOrder ?? '');
      setSelectMode('order');
    }
  }, [isEditing, machine.productionOrder]);

  // Handle part selection - auto-pick lowest order for that part
  const handlePartSelect = (partNumber: string) => {
    if (!availableData) return;
    const partData = availableData.byPart.find((p) => p.partNumber === partNumber);
    if (partData) {
      setSelectedOrder(partData.lowestOrder);
    }
  };

  // Find part info for display when order is selected
  const selectedOrderData = availableData?.orders.find((o) => o.orderNumber === selectedOrder);

  return (
    <tr
      className={cn(
        'border-b border-slate-700/50 transition-colors',
        isEditing ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'
      )}
    >
      <td className="px-3 py-2 font-medium text-white">{machine.machineName}</td>
      <td className="px-3 py-2">
        <span
          className={cn(
            'px-2 py-0.5 rounded text-xs font-bold uppercase',
            machine.status === 'running' && 'bg-green-900/50 text-green-400',
            machine.status === 'idle' && 'bg-yellow-900/50 text-yellow-400',
            machine.status === 'fault' && 'bg-red-900/50 text-red-400',
            machine.status === 'offline' && 'bg-slate-700 text-slate-400'
          )}
        >
          {machine.status}
        </span>
      </td>
      <td className="px-3 py-2" colSpan={isEditing ? 2 : 1}>
        {isEditing ? (
          <div className="flex gap-2 items-center">
            {/* Toggle between Order and Part selection */}
            <div className="flex bg-slate-700 rounded text-xs">
              <button
                type="button"
                onClick={() => setSelectMode('order')}
                className={cn('px-2 py-1 rounded-l', selectMode === 'order' && 'bg-blue-600')}
              >
                Order
              </button>
              <button
                type="button"
                onClick={() => setSelectMode('part')}
                className={cn('px-2 py-1 rounded-r', selectMode === 'part' && 'bg-blue-600')}
              >
                Part
              </button>
            </div>

            {selectMode === 'order' ? (
              <select
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
                className="h-8 text-xs flex-1 rounded-md border border-slate-600 bg-slate-700 px-2 text-white"
              >
                <option value="">Clear assignment</option>
                {availableData?.orders.map((o) => (
                  <option key={o.orderNumber} value={o.orderNumber}>
                    {o.orderNumber} → {o.partNumber}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedOrderData?.partNumber ?? ''}
                onChange={(e) => handlePartSelect(e.target.value)}
                className="h-8 text-xs flex-1 rounded-md border border-slate-600 bg-slate-700 px-2 text-white"
              >
                <option value="">Select part...</option>
                {availableData?.byPart.map((p) => (
                  <option key={p.partNumber} value={p.partNumber}>
                    {p.partNumber} - {p.partName} ({p.orderCount} orders)
                  </option>
                ))}
              </select>
            )}

            {selectedOrder && (
              <span className="text-xs text-slate-400">→ {selectedOrderData?.partNumber}</span>
            )}
          </div>
        ) : (
          <span className="font-mono text-xs">{machine.productionOrder || '-'}</span>
        )}
      </td>
      {!isEditing && (
        <td className="px-3 py-2">
          <span className="truncate max-w-[200px] block">{machine.partNumber || '-'}</span>
        </td>
      )}
      <td className="px-3 py-2">{machine.targetCycleTime ?? '-'}</td>
      <td className="px-3 py-2 font-mono">{machine.cycleCount?.toLocaleString() ?? '0'}</td>
      <td className="px-3 py-2">
        <span className={machine.inputMode === 'manual' ? 'text-blue-400' : 'text-slate-500'}>
          {machine.inputMode}
        </span>
      </td>
      <td className="px-3 py-2">
        {isEditing ? (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onSave(selectedOrder || null)}
              disabled={isSaving}
              className="h-7 w-7 text-green-400 hover:text-green-300"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onCancel}
              className="h-7 w-7 text-red-400 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            className="h-7 w-7 text-slate-400 hover:text-white"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
});

export function EditableTable({
  machines,
  onRefresh,
}: { machines: Machine[]; onRefresh: () => void }) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [availableData, setAvailableData] = useState<AvailableData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch available orders on mount
  useEffect(() => {
    fetch('/api/orders/available')
      .then((res) => res.json())
      .then((data) => setAvailableData(data))
      .catch(console.error);
  }, []);

  const handleSave = useCallback(
    async (machineId: number, orderNumber: string | null) => {
      setIsSaving(true);
      try {
        const res = await fetch(`/api/machines/${machineId}/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify({ productionOrder: orderNumber }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save');
        }

        setEditingRow(null);
        onRefresh();

        // Refresh available orders (one may now be assigned)
        fetch('/api/orders/available')
          .then((res) => res.json())
          .then((data) => setAvailableData(data))
          .catch(console.error);
      } catch (err) {
        console.error('Save error:', err);
        alert(err instanceof Error ? err.message : 'Failed to save changes');
      } finally {
        setIsSaving(false);
      }
    },
    [onRefresh]
  );

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/50">
            <th className="text-left text-slate-400 font-medium px-3 py-3">Machine</th>
            <th className="text-left text-slate-400 font-medium px-3 py-3">Status</th>
            <th className="text-left text-slate-400 font-medium px-3 py-3">Order</th>
            <th className="text-left text-slate-400 font-medium px-3 py-3">Part #</th>
            <th className="text-left text-slate-400 font-medium px-3 py-3">Cycle Time</th>
            <th className="text-left text-slate-400 font-medium px-3 py-3">Cycles</th>
            <th className="text-left text-slate-400 font-medium px-3 py-3">Mode</th>
            <th className="text-left text-slate-400 font-medium px-3 py-3 w-20" />
          </tr>
        </thead>
        <tbody>
          {machines.map((machine) => (
            <MachineRow
              key={machine.machineId}
              machine={machine}
              isEditing={editingRow === machine.machineId}
              onEdit={() => setEditingRow(machine.machineId)}
              onSave={(order) => handleSave(machine.machineId, order)}
              onCancel={() => setEditingRow(null)}
              availableData={availableData}
              isSaving={isSaving}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

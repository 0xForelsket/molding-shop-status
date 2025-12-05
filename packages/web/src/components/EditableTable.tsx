// packages/web/src/components/EditableTable.tsx
// Industrial Precision Style - Light mode editable table

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
  compatibility: Record<string, number[]>;
}

// Status badge styles - solid colors
const statusBadgeStyles: Record<string, string> = {
  running: 'bg-emerald-600 text-white',
  idle: 'bg-amber-500 text-white',
  fault: 'bg-red-600 text-white',
  offline: 'bg-slate-400 text-white',
};

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

  useEffect(() => {
    if (isEditing) {
      setSelectedOrder(machine.productionOrder ?? '');
      setSelectMode('order');
    }
  }, [isEditing, machine.productionOrder]);

  const handlePartSelect = (partNumber: string) => {
    if (!availableData) return;
    const partData = availableData.byPart.find((p) => p.partNumber === partNumber);
    if (partData) {
      setSelectedOrder(partData.lowestOrder);
    }
  };

  const selectedOrderData = availableData?.orders.find((o) => o.orderNumber === selectedOrder);

  return (
    <tr className={cn('border-b border-slate-100', isEditing ? 'bg-blue-50' : 'hover:bg-slate-50')}>
      <td className="px-3 py-2.5 font-semibold text-slate-900">{machine.machineName}</td>
      <td className="px-3 py-2.5">
        <span
          className={cn(
            'px-2 py-0.5 rounded text-xs font-semibold uppercase',
            statusBadgeStyles[machine.status]
          )}
        >
          {machine.status}
        </span>
      </td>
      <td className="px-3 py-2.5" colSpan={isEditing ? 2 : 1}>
        {isEditing ? (
          <div className="flex gap-2 items-center">
            <div className="flex bg-slate-200 rounded text-xs">
              <button
                type="button"
                onClick={() => setSelectMode('order')}
                className={cn(
                  'px-2 py-1 rounded-l text-slate-700',
                  selectMode === 'order' && 'bg-white shadow-sm'
                )}
              >
                Order
              </button>
              <button
                type="button"
                onClick={() => setSelectMode('part')}
                className={cn(
                  'px-2 py-1 rounded-r text-slate-700',
                  selectMode === 'part' && 'bg-white shadow-sm'
                )}
              >
                Part
              </button>
            </div>

            {selectMode === 'order' ? (
              <select
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
                className="h-8 text-xs flex-1 rounded border border-slate-300 bg-white px-2 text-slate-800"
              >
                <option value="">Clear assignment</option>
                {availableData?.orders
                  .filter(
                    (o) => !!availableData.compatibility[o.partNumber]?.includes(machine.machineId)
                  )
                  .map((o) => (
                    <option key={o.orderNumber} value={o.orderNumber}>
                      {o.orderNumber} → {o.partNumber}
                    </option>
                  ))}
              </select>
            ) : (
              <select
                value={selectedOrderData?.partNumber ?? ''}
                onChange={(e) => handlePartSelect(e.target.value)}
                className="h-8 text-xs flex-1 rounded border border-slate-300 bg-white px-2 text-slate-800"
              >
                <option value="">Select part...</option>
                {availableData?.byPart
                  .filter(
                    (p) => !!availableData.compatibility[p.partNumber]?.includes(machine.machineId)
                  )
                  .map((p) => (
                    <option key={p.partNumber} value={p.partNumber}>
                      {p.partNumber} - {p.partName} ({p.orderCount} orders)
                    </option>
                  ))}
              </select>
            )}

            {selectedOrder && (
              <span className="text-xs text-slate-500">→ {selectedOrderData?.partNumber}</span>
            )}
          </div>
        ) : (
          <span className="font-mono text-xs text-slate-700">{machine.productionOrder || '-'}</span>
        )}
      </td>
      {!isEditing && (
        <td className="px-3 py-2.5 text-slate-700">
          <span className="truncate max-w-[200px] block">{machine.partNumber || '-'}</span>
        </td>
      )}
      <td className="px-3 py-2.5 tabular-nums text-slate-700">{machine.targetCycleTime ?? '-'}</td>
      <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">
        {machine.cycleCount?.toLocaleString() ?? '0'}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={
            machine.inputMode === 'manual' ? 'text-blue-600 font-medium' : 'text-slate-500'
          }
        >
          {machine.inputMode === 'manual' ? 'Manual' : 'Running'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {isEditing ? (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onSave(selectedOrder || null)}
              disabled={isSaving}
              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onCancel}
              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            className="h-7 w-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
    <div className="bg-white rounded border border-slate-200 overflow-hidden">
      <table className="w-full text-sm table-industrial">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left text-slate-700 font-semibold px-3 py-3 uppercase text-xs tracking-wide">
              Machine
            </th>
            <th className="text-left text-slate-700 font-semibold px-3 py-3 uppercase text-xs tracking-wide">
              Status
            </th>
            <th className="text-left text-slate-700 font-semibold px-3 py-3 uppercase text-xs tracking-wide">
              Order
            </th>
            <th className="text-left text-slate-700 font-semibold px-3 py-3 uppercase text-xs tracking-wide">
              Part #
            </th>
            <th className="text-left text-slate-700 font-semibold px-3 py-3 uppercase text-xs tracking-wide">
              Cycle Time
            </th>
            <th className="text-left text-slate-700 font-semibold px-3 py-3 uppercase text-xs tracking-wide">
              Cycles
            </th>
            <th className="text-left text-slate-700 font-semibold px-3 py-3 uppercase text-xs tracking-wide">
              Mode
            </th>
            <th className="text-left text-slate-700 font-semibold px-3 py-3 w-20" />
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

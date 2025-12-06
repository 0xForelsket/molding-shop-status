import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { getAuthHeader } from '../../lib/auth';
import { Badge } from '../ui/badge';
import { CrudTable } from '../ui/crud-table';
import { Modal } from '../ui/modal';

interface DowntimeReason {
  code: string;
  name: string;
  category: string;
  isActive: boolean;
}

export function DowntimeReasonsTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DowntimeReason | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { data: reasons = [], isLoading } = useQuery<DowntimeReason[]>({
    queryKey: ['downtime-reasons-all'],
    queryFn: async () => {
      const res = await fetch('/api/reference/downtime-reasons');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<DowntimeReason> & { code: string; isNew?: boolean }) => {
      const url = data.isNew
        ? '/api/reference/downtime-reasons'
        : `/api/reference/downtime-reasons/${data.code}`;
      const method = data.isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downtime-reasons-all'] });
      setEditing(null);
      setIsAdding(false);
    },
  });

  const planned = reasons.filter((r) => r.category === 'planned');
  const unplanned = reasons.filter((r) => r.category === 'unplanned');

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Reason
        </button>
      </div>

      {/* Planned */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Planned Downtime</h3>
        <CrudTable
          data={planned}
          keyField="code"
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            {
              key: 'isActive',
              label: 'Status',
              render: (v) =>
                v ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="neutral">Inactive</Badge>
                ),
            },
          ]}
          isLoading={isLoading}
          onEdit={(r) => setEditing(r)}
        />
      </div>

      {/* Unplanned */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Unplanned Downtime</h3>
        <CrudTable
          data={unplanned}
          keyField="code"
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Name' },
            {
              key: 'isActive',
              label: 'Status',
              render: (v) =>
                v ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="neutral">Inactive</Badge>
                ),
            },
          ]}
          isLoading={isLoading}
          onEdit={(r) => setEditing(r)}
        />
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isAdding || !!editing}
        onClose={() => {
          setIsAdding(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Downtime Reason' : 'Add Downtime Reason'}
      >
        <DowntimeReasonForm
          reason={editing}
          onSave={(data) => saveMutation.mutate({ ...data, isNew: !editing })}
          onCancel={() => {
            setIsAdding(false);
            setEditing(null);
          }}
          isLoading={saveMutation.isPending}
        />
      </Modal>
    </div>
  );
}

function DowntimeReasonForm({
  reason,
  onSave,
  onCancel,
  isLoading,
}: {
  reason: DowntimeReason | null;
  onSave: (data: { code: string; name: string; category: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [code, setCode] = useState(reason?.code || '');
  const [name, setName] = useState(reason?.name || '');
  const [category, setCategory] = useState(reason?.category || 'planned');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ code, name, category });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="reason-code" className="block text-sm font-medium text-slate-700 mb-1">
          Code
        </label>
        <input
          id="reason-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, '_'))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="e.g. MOLD_CHANGE"
          disabled={!!reason}
          required
        />
      </div>
      <div>
        <label htmlFor="reason-name" className="block text-sm font-medium text-slate-700 mb-1">
          Name
        </label>
        <input
          id="reason-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="e.g. Mold Change"
          required
        />
      </div>
      <div>
        <label htmlFor="reason-category" className="block text-sm font-medium text-slate-700 mb-1">
          Category
        </label>
        <select
          id="reason-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
        >
          <option value="planned">Planned</option>
          <option value="unplanned">Unplanned</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

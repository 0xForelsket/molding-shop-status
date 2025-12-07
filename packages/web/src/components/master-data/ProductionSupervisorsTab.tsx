import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { getAuthHeader } from '../../lib/auth';
import { Badge } from '../ui/badge';
import { CrudTable } from '../ui/crud-table';
import { Modal } from '../ui/modal';

interface ProductionSupervisor {
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export function ProductionSupervisorsTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProductionSupervisor | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { data: supervisors = [], isLoading } = useQuery<ProductionSupervisor[]>({
    queryKey: ['production-supervisors'],
    queryFn: async () => {
      const res = await fetch('/api/reference/production-supervisors');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ProductionSupervisor> & { code: string; isNew?: boolean }) => {
      const url = data.isNew
        ? '/api/reference/production-supervisors'
        : `/api/reference/production-supervisors/${data.code}`;
      const method = data.isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-supervisors'] });
      setEditing(null);
      setIsAdding(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`/api/reference/production-supervisors/${code}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-supervisors'] });
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Production Supervisors</h3>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Supervisor
        </button>
      </div>

      <CrudTable
        data={supervisors}
        keyField="code"
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'description', label: 'Description', render: (v) => v || '—' },
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
        onEdit={(s) => setEditing(s)}
        onDelete={(s) => {
          if (confirm(`Delete supervisor "${s.name}"?`)) {
            deleteMutation.mutate(s.code);
          }
        }}
      />

      {deleteMutation.error && (
        <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded">
          {deleteMutation.error.message}
        </div>
      )}

      {/* Edit/Add Modal */}
      <Modal
        isOpen={isAdding || !!editing}
        onClose={() => {
          setIsAdding(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Supervisor' : 'Add Supervisor'}
      >
        <SupervisorForm
          supervisor={editing}
          onSave={(data) => saveMutation.mutate({ ...data, isNew: !editing })}
          onCancel={() => {
            setIsAdding(false);
            setEditing(null);
          }}
          isLoading={saveMutation.isPending}
          error={saveMutation.error?.message}
        />
      </Modal>
    </div>
  );
}

function SupervisorForm({
  supervisor,
  onSave,
  onCancel,
  isLoading,
  error,
}: {
  supervisor: ProductionSupervisor | null;
  onSave: (data: { code: string; name: string; description?: string; isActive?: boolean }) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const [code, setCode] = useState(supervisor?.code || '');
  const [name, setName] = useState(supervisor?.name || '');
  const [description, setDescription] = useState(supervisor?.description || '');
  const [isActive, setIsActive] = useState(supervisor?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ code, name, description: description || undefined, isActive });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}

      <div>
        <label htmlFor="supervisor-code" className="block text-sm font-medium text-slate-700 mb-1">
          Code
        </label>
        <input
          id="supervisor-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g. P01"
          disabled={!!supervisor}
          required
          maxLength={10}
        />
      </div>

      <div>
        <label htmlFor="supervisor-name" className="block text-sm font-medium text-slate-700 mb-1">
          Name
        </label>
        <input
          id="supervisor-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g. Molding"
          required
        />
      </div>

      <div>
        <label
          htmlFor="supervisor-description"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Description
        </label>
        <input
          id="supervisor-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Optional description"
        />
      </div>

      {supervisor && (
        <div className="flex items-center gap-2">
          <input
            id="supervisor-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="supervisor-active" className="text-sm text-slate-700">
            Active
          </label>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

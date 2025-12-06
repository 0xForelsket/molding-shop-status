import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { getAuthHeader } from '../../lib/auth';
import { Badge } from '../ui/badge';
import { CrudTable } from '../ui/crud-table';
import { Modal } from '../ui/modal';

interface ProductLine {
  code: string;
  name: string;
  isActive: boolean;
}

export function ProductLinesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProductLine | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { data: lines = [], isLoading } = useQuery<ProductLine[]>({
    queryKey: ['product-lines-all'],
    queryFn: async () => {
      const res = await fetch('/api/reference/product-lines');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<ProductLine> & { code: string; isNew?: boolean }) => {
      const url = data.isNew
        ? '/api/reference/product-lines'
        : `/api/reference/product-lines/${data.code}`;
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
      queryClient.invalidateQueries({ queryKey: ['product-lines-all'] });
      setEditing(null);
      setIsAdding(false);
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Product Lines</h3>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Product Line
        </button>
      </div>
      <CrudTable
        data={lines}
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
        onEdit={(l) => setEditing(l)}
      />

      {/* Edit Modal */}
      <Modal
        isOpen={isAdding || !!editing}
        onClose={() => {
          setIsAdding(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Product Line' : 'Add Product Line'}
      >
        <ProductLineForm
          line={editing}
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

function ProductLineForm({
  line,
  onSave,
  onCancel,
  isLoading,
}: {
  line: ProductLine | null;
  onSave: (data: { code: string; name: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [code, setCode] = useState(line?.code || '');
  const [name, setName] = useState(line?.name || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ code, name });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="line-code" className="block text-sm font-medium text-slate-700 mb-1">
          Code
        </label>
        <input
          id="line-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, '_'))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="e.g. WAVE_1"
          disabled={!!line}
          required
        />
      </div>
      <div>
        <label htmlFor="line-name" className="block text-sm font-medium text-slate-700 mb-1">
          Name
        </label>
        <input
          id="line-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="e.g. Wave 1"
          required
        />
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

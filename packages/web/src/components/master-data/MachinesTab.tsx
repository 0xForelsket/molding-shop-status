import { useQuery } from '@tanstack/react-query';
import { Badge } from '../ui/badge';
import { CrudTable } from '../ui/crud-table';

import type { WorkCenter } from '../../lib/api';

export function MachinesTab() {
  const { data: machines = [], isLoading } = useQuery<WorkCenter[]>({
    queryKey: ['machines-all'],
    queryFn: async () => {
      const res = await fetch('/api/work-centers');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800">Machines</h3>
        <span className="text-sm text-slate-500">
          Machine management is available in the Machine Admin page
        </span>
      </div>
      <CrudTable
        data={machines}
        keyField="id"
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'tonnage', label: 'Tonnage', render: (v) => (v ? `${v}T` : '-') },
          { key: 'type', label: 'Type' },
          {
            key: 'status',
            label: 'Status',
            render: (v) => (
              <Badge variant={v === 'running' ? 'success' : v === 'idle' ? 'warning' : 'neutral'}>
                {String(v)}
              </Badge>
            ),
          },
        ]}
        isLoading={isLoading}
      />
    </div>
  );
}

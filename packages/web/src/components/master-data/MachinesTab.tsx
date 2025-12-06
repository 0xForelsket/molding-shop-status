import { useQuery } from '@tanstack/react-query';
import { Badge } from '../ui/badge';
import { CrudTable } from '../ui/crud-table';

interface Machine {
  machineId: number;
  machineName: string;
  status: string;
  tonnage: number | null;
  machineType: string | null;
  isActive: boolean;
}

export function MachinesTab() {
  const { data: machines = [], isLoading } = useQuery<Machine[]>({
    queryKey: ['machines-all'],
    queryFn: async () => {
      const res = await fetch('/api/machines');
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
        keyField="machineId"
        columns={[
          { key: 'machineName', label: 'Name' },
          { key: 'tonnage', label: 'Tonnage', render: (v) => (v ? `${v}T` : '-') },
          { key: 'machineType', label: 'Type' },
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

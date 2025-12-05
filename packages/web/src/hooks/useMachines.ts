// packages/web/src/hooks/useMachines.ts

import { useQuery } from '@tanstack/react-query';
import { fetchMachines, fetchSummary } from '../lib/api';

export function useMachines() {
  return useQuery({
    queryKey: ['machines'],
    queryFn: fetchMachines,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

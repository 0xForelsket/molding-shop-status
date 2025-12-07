// packages/web/src/hooks/useMachines.ts

import { useQuery } from '@tanstack/react-query';
import { fetchSummary, fetchWorkCenters } from '../lib/api';

export function useWorkCenters() {
  return useQuery({
    queryKey: ['work-centers'],
    queryFn: fetchWorkCenters,
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

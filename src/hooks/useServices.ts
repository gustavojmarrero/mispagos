import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import type { Service } from '@/lib/types';

export function useServices() {
  const { services: rawServices, loading, errors, refetchServices } = useData();

  const services = useMemo(
    () => [...rawServices].sort((a: Service, b: Service) => a.name.localeCompare(b.name)),
    [rawServices]
  );

  return { services, loading, error: errors.services ?? null, refetch: refetchServices };
}

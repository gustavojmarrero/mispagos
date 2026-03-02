import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import type { ServiceLine } from '@/lib/types';

interface UseServiceLinesOptions {
  serviceId?: string;
  activeOnly?: boolean;
}

export function useServiceLines(options: UseServiceLinesOptions = {}) {
  const { serviceId, activeOnly = true } = options;
  const { serviceLines: rawServiceLines, loading, errors, refetchServiceLines } = useData();

  const serviceLines = useMemo(() => {
    let result = [...rawServiceLines];

    if (serviceId) {
      result = result.filter(line => line.serviceId === serviceId);
    }

    if (activeOnly) {
      result = result.filter(line => line.isActive);
    }

    return result.sort((a: ServiceLine, b: ServiceLine) => a.name.localeCompare(b.name));
  }, [rawServiceLines, serviceId, activeOnly]);

  return { serviceLines, loading, error: errors.serviceLines ?? null, refetch: refetchServiceLines };
}

export function useServiceLinesGrouped() {
  const { serviceLines, loading, error, refetch } = useServiceLines({ activeOnly: false });

  const { groupedByService, linesCountByService } = useMemo(() => {
    const grouped: Record<string, ServiceLine[]> = {};
    const counts: Record<string, number> = {};
    for (const line of serviceLines) {
      if (!grouped[line.serviceId]) { grouped[line.serviceId] = []; counts[line.serviceId] = 0; }
      grouped[line.serviceId].push(line);
      if (line.isActive) counts[line.serviceId]++;
    }
    return { groupedByService: grouped, linesCountByService: counts };
  }, [serviceLines]);

  return {
    serviceLines,
    groupedByService,
    linesCountByService,
    loading,
    error,
    refetch
  };
}

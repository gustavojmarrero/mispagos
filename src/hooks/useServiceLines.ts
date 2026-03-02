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

  const groupedByService = useMemo(() => {
    return serviceLines.reduce((acc, line) => {
      if (!acc[line.serviceId]) {
        acc[line.serviceId] = [];
      }
      acc[line.serviceId].push(line);
      return acc;
    }, {} as Record<string, ServiceLine[]>);
  }, [serviceLines]);

  const linesCountByService = useMemo(() => {
    return Object.entries(groupedByService).reduce((acc, [serviceId, lines]) => {
      acc[serviceId] = lines.filter(l => l.isActive).length;
      return acc;
    }, {} as Record<string, number>);
  }, [groupedByService]);

  return {
    serviceLines,
    groupedByService,
    linesCountByService,
    loading,
    error,
    refetch
  };
}

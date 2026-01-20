import { useMemo } from 'react';
import { useFirestoreCollection } from './useFirestoreCollection';
import type { ServiceLine } from '@/lib/types';

interface UseServiceLinesOptions {
  serviceId?: string;
  activeOnly?: boolean;
}

export function useServiceLines(options: UseServiceLinesOptions = {}) {
  const { serviceId, activeOnly = true } = options;

  const transform = useMemo(() => (data: ServiceLine[]): ServiceLine[] => {
    let result = data;

    if (serviceId) {
      result = result.filter(line => line.serviceId === serviceId);
    }

    if (activeOnly) {
      result = result.filter(line => line.isActive);
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [serviceId, activeOnly]);

  const { data: serviceLines, loading, error, refetch } = useFirestoreCollection<ServiceLine>({
    collectionName: 'service_lines',
    transform,
    errorMessage: 'Error al cargar líneas de servicio'
  });

  return { serviceLines, loading, error, refetch };
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

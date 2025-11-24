import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { ServiceLine } from '@/lib/types';

interface UseServiceLinesOptions {
  serviceId?: string; // Filtrar por servicio específico
  activeOnly?: boolean; // Solo líneas activas (default: true)
}

export function useServiceLines(options: UseServiceLinesOptions = {}) {
  const { serviceId, activeOnly = true } = options;
  const { currentUser } = useAuth();
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServiceLines = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Query base por householdId
      let linesQuery = query(
        collection(db, 'service_lines'),
        where('householdId', '==', currentUser.householdId)
      );

      const snapshot = await getDocs(linesQuery);
      let linesData = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as ServiceLine[];

      // Filtrar por serviceId si se proporciona
      if (serviceId) {
        linesData = linesData.filter(line => line.serviceId === serviceId);
      }

      // Filtrar solo activas si se requiere
      if (activeOnly) {
        linesData = linesData.filter(line => line.isActive);
      }

      // Ordenar por nombre
      setServiceLines(linesData.sort((a, b) => a.name.localeCompare(b.name)));
      setError(null);
    } catch (err) {
      console.error('Error fetching service lines:', err);
      setError('Error al cargar líneas de servicio');
    } finally {
      setLoading(false);
    }
  }, [currentUser, serviceId, activeOnly]);

  useEffect(() => {
    fetchServiceLines();
  }, [fetchServiceLines]);

  return {
    serviceLines,
    loading,
    error,
    refetch: fetchServiceLines
  };
}

// Hook para obtener líneas agrupadas por servicio
export function useServiceLinesGrouped() {
  const { serviceLines, loading, error, refetch } = useServiceLines({ activeOnly: false });

  const groupedByService = serviceLines.reduce((acc, line) => {
    if (!acc[line.serviceId]) {
      acc[line.serviceId] = [];
    }
    acc[line.serviceId].push(line);
    return acc;
  }, {} as Record<string, ServiceLine[]>);

  // Contar líneas por servicio
  const linesCountByService = Object.entries(groupedByService).reduce((acc, [serviceId, lines]) => {
    acc[serviceId] = lines.filter(l => l.isActive).length;
    return acc;
  }, {} as Record<string, number>);

  return {
    serviceLines,
    groupedByService,
    linesCountByService,
    loading,
    error,
    refetch
  };
}

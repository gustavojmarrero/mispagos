import { useFirestoreCollection } from './useFirestoreCollection';
import type { Service } from '@/lib/types';

export function useServices() {
  const { data: services, loading, error } = useFirestoreCollection<Service>({
    collectionName: 'services',
    transform: (data) => data.sort((a, b) => a.name.localeCompare(b.name)),
    errorMessage: 'Error al cargar servicios'
  });

  return { services, loading, error };
}

import { useFirestoreCollection } from './useFirestoreCollection';
import type { Service } from '@/lib/types';

const sortByName = (data: Service[]) => data.sort((a, b) => a.name.localeCompare(b.name));

export function useServices() {
  const { data: services, loading, error } = useFirestoreCollection<Service>({
    collectionName: 'services',
    transform: sortByName,
    errorMessage: 'Error al cargar servicios'
  });

  return { services, loading, error };
}

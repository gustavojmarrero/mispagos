import { useFirestoreCollection } from './useFirestoreCollection';
import type { Bank } from '@/lib/types';

export function useBanks() {
  const { data: banks, loading, error } = useFirestoreCollection<Bank>({
    collectionName: 'banks',
    transform: (data) => data.sort((a, b) => a.name.localeCompare(b.name)),
    errorMessage: 'Error al cargar bancos'
  });

  return { banks, loading, error };
}

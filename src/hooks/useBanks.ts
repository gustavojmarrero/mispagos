import { useFirestoreCollection } from './useFirestoreCollection';
import type { Bank } from '@/lib/types';

const sortByName = (data: Bank[]) => data.sort((a, b) => a.name.localeCompare(b.name));

export function useBanks() {
  const { data: banks, loading, error } = useFirestoreCollection<Bank>({
    collectionName: 'banks',
    transform: sortByName,
    errorMessage: 'Error al cargar bancos'
  });

  return { banks, loading, error };
}

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, getDocs, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface UseFirestoreCollectionOptions<T> {
  collectionName: string;
  additionalConstraints?: QueryConstraint[];
  transform?: (data: T[]) => T[];
  enabled?: boolean;
  errorMessage?: string;
}

interface UseFirestoreCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook genérico para obtener colecciones de Firestore filtradas por householdId
 */
export function useFirestoreCollection<T extends { id: string }>(
  options: UseFirestoreCollectionOptions<T>
): UseFirestoreCollectionResult<T> {
  const {
    collectionName,
    additionalConstraints = [],
    transform,
    enabled = true,
    errorMessage = `Error al cargar ${collectionName}`
  } = options;

  const { currentUser } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentUser || !enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const constraints: QueryConstraint[] = [
        where('householdId', '==', currentUser.householdId),
        ...additionalConstraints
      ];

      const dataQuery = query(collection(db, collectionName), ...constraints);
      const snapshot = await getDocs(dataQuery);

      let result = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as unknown as T;
      });

      if (transform) {
        result = transform(result);
      }

      setData(result);
      setError(null);
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentUser, collectionName, additionalConstraints, transform, enabled, errorMessage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

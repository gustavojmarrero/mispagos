import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface UseFirestoreCollectionOptions<T> {
  collectionName: string;
  additionalConstraints?: QueryConstraint[];
  /** Clave estable que representa el estado actual de los constraints.
   *  Cuando cambia, se re-ejecuta la query. Usar para filtros dinámicos,
   *  e.g. constraintsKey: `status:${statusFilter}` */
  constraintsKey?: string;
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
 * Hook genérico para obtener colecciones de Firestore filtradas por householdId.
 * Usa refs para additionalConstraints y transform para evitar bucles infinitos
 * de re-fetch causados por referencias inestables en cada render.
 */
export function useFirestoreCollection<T extends { id: string }>(
  options: UseFirestoreCollectionOptions<T>
): UseFirestoreCollectionResult<T> {
  const {
    collectionName,
    additionalConstraints,
    constraintsKey,
    transform,
    enabled = true,
    errorMessage = `Error al cargar ${collectionName}`
  } = options;

  const { currentUser } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs para valores con referencias inestables (arrays/funciones nuevas cada render).
  // Se leen dentro de fetchData sin ser dependencias de useCallback.
  const additionalConstraintsRef = useRef(additionalConstraints);
  additionalConstraintsRef.current = additionalConstraints;
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const fetchData = useCallback(async () => {
    if (!currentUser || !enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const constraints: QueryConstraint[] = [
        where('householdId', '==', currentUser.householdId),
        ...(additionalConstraintsRef.current || [])
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

      if (transformRef.current) {
        result = transformRef.current(result);
      }

      setData(result);
      setError(null);
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentUser, collectionName, enabled, errorMessage, constraintsKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

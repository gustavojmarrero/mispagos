import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
 *
 * Separa fetch (costoso, va a Firestore) de transform (barato, en memoria):
 * - additionalConstraints se lee via ref para no disparar re-fetch por refs inestables.
 *   Para filtros dinámicos de query, pasar constraintsKey.
 * - transform se aplica como valor derivado (useMemo) sobre los datos cacheados.
 *   Callers que memorizan su transform (useMemo/useCallback) obtienen re-aplicación
 *   automática cuando sus dependencias cambian, sin re-fetch.
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
  const [rawData, setRawData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref para constraints con referencias inestables (array nuevo cada render).
  const additionalConstraintsRef = useRef(additionalConstraints);
  additionalConstraintsRef.current = additionalConstraints;

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

      const result = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as unknown as T;
      });

      setRawData(result);
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

  // Transform se aplica como valor derivado sobre datos cacheados.
  // Cuando transform cambia (e.g. useServiceLines cambia serviceId/activeOnly),
  // se re-computa sin disparar re-fetch a Firestore.
  const data = useMemo(() => {
    if (!transform) return rawData;
    try {
      return transform([...rawData]);
    } catch (err) {
      console.error(`Error in transform for ${collectionName}:`, err);
      return rawData;
    }
  }, [rawData, transform, collectionName]);

  return { data, loading, error, refetch: fetchData };
}

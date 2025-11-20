import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { Bank } from '@/lib/types';

export function useBanks() {
  const { currentUser } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchBanks = async () => {
      try {
        const banksQuery = query(
          collection(db, 'banks'),
          where('householdId', '==', currentUser.householdId)
        );
        const snapshot = await getDocs(banksQuery);
        const banksData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Bank[];

        setBanks(banksData.sort((a, b) => a.name.localeCompare(b.name)));
        setError(null);
      } catch (err) {
        console.error('Error fetching banks:', err);
        setError('Error al cargar bancos');
      } finally {
        setLoading(false);
      }
    };

    fetchBanks();
  }, [currentUser]);

  return { banks, loading, error };
}

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { Service } from '@/lib/types';

export function useServices() {
  const { currentUser } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchServices = async () => {
      try {
        const servicesQuery = query(
          collection(db, 'services'),
          where('userId', '==', currentUser.id)
        );
        const snapshot = await getDocs(servicesQuery);
        const servicesData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Service[];

        setServices(servicesData.sort((a, b) => a.name.localeCompare(b.name)));
        setError(null);
      } catch (err) {
        console.error('Error fetching services:', err);
        setError('Error al cargar servicios');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [currentUser]);

  return { services, loading, error };
}

import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import type { Bank } from '@/lib/types';

export function useBanks() {
  const { banks: rawBanks, loading, errors } = useData();

  const banks = useMemo(
    () => [...rawBanks].sort((a: Bank, b: Bank) => a.name.localeCompare(b.name)),
    [rawBanks]
  );

  return { banks, loading, error: errors.banks ?? null };
}
